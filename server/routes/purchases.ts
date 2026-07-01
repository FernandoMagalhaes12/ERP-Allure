import { Router } from "express";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { financialEntries, products, purchaseItems, purchases, stockMovements, suppliers } from "../../drizzle/schema";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

const router = Router();

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

const purchaseSchema = z.object({
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  documentNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1),
});

router.get("/suppliers", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where = q
      ? and(eq(suppliers.companyId, companyId), ilike(suppliers.legalName, `%${q}%`))
      : eq(suppliers.companyId, companyId);

    const rows = await db
      .select()
      .from(suppliers)
      .where(where)
      .orderBy(suppliers.legalName)
      .limit(50);

    res.json(rows);
  } catch (error) {
    console.error("Error listing suppliers", error);
    res.status(500).json({ message: "Erro ao listar fornecedores" });
  }
});

router.get("/", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const rows = await db
      .select({
        id: purchases.id,
        supplierId: purchases.supplierId,
        supplierName: purchases.supplierName,
        documentNumber: purchases.documentNumber,
        status: purchases.status,
        totalAmount: purchases.totalAmount,
        notes: purchases.notes,
        createdBy: purchases.createdBy,
        createdAt: purchases.createdAt,
        itemCount: sql<number>`count(${purchaseItems.id})::int`,
      })
      .from(purchases)
      .leftJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
      .where(eq(purchases.companyId, companyId))
      .groupBy(
        purchases.id,
        purchases.supplierId,
        purchases.supplierName,
        purchases.documentNumber,
        purchases.status,
        purchases.totalAmount,
        purchases.notes,
        purchases.createdBy,
        purchases.createdAt,
      )
      .orderBy(desc(purchases.createdAt));

    res.json(rows);
  } catch (error) {
    console.error("Error listing purchases", error);
    res.status(500).json({ message: "Erro ao listar compras" });
  }
});

router.post("/", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const userId = req.user?.id ?? null;
    const payload = purchaseSchema.parse(req.body);

    const uniqueProductIds = [...new Set(payload.items.map((item) => item.productId))];
    const existingProducts = await db
      .select({ id: products.id, name: products.name, stock: products.stock, cost: products.cost })
      .from(products)
      .where(and(eq(products.companyId, companyId), inArray(products.id, uniqueProductIds)));

    if (existingProducts.length !== uniqueProductIds.length) {
      return res.status(400).json({ message: "Um ou mais produtos não pertencem à empresa selecionada" });
    }

    const productMap = new Map(existingProducts.map((product) => [product.id, product]));
    const purchaseId = randomUUID();
    const normalizedItems = payload.items.map((item) => ({
      id: randomUUID(),
      purchaseId,
      productId: item.productId,
      quantity: Math.round(Number(item.quantity)),
      unitCost: Number(item.unitCost).toFixed(2),
      totalCost: (Number(item.quantity) * Number(item.unitCost)).toFixed(2),
    }));

    const totalAmount = normalizedItems
      .reduce((acc, item) => acc + Number(item.totalCost), 0)
      .toFixed(2);

    await db.transaction(async (tx) => {
      await tx.insert(purchases).values({
        id: purchaseId,
        companyId,
        supplierId: payload.supplierId || null,
        supplierName: payload.supplierName || null,
        documentNumber: payload.documentNumber || null,
        status: "received",
        totalAmount,
        notes: payload.notes || null,
        createdBy: userId,
      });

      await tx.insert(purchaseItems).values(normalizedItems);

      for (const item of normalizedItems) {
        const current = productMap.get(item.productId)!;
        await tx
          .update(products)
          .set({
            stock: Number(current.stock ?? 0) + Number(item.quantity),
            cost: item.unitCost,
            updatedAt: new Date(),
          })
          .where(and(eq(products.id, item.productId), eq(products.companyId, companyId)));

        await tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: item.productId,
          type: "input",
          quantity: Number(item.quantity),
          reason: `Entrada por compra ${payload.documentNumber || purchaseId}`,
          referenceType: "purchase",
          referenceId: purchaseId,
          createdBy: userId,
        });
      }

      await tx.insert(financialEntries).values({
        id: randomUUID(),
        companyId,
        type: "expense",
        description: `Compra ${payload.documentNumber || purchaseId}`,
        amount: totalAmount,
        category: "Compras e Estoque",
        status: "pending",
        dueDate: new Date().toISOString().slice(0, 10),
        paymentDate: null,
        supplierId: payload.supplierId || null,
        sourceType: "purchase",
        sourceId: purchaseId,
        createdBy: userId,
      });
    });

    await logAudit({
      companyId,
      userId,
      entityType: "purchase",
      entityId: purchaseId,
      action: "create",
      description: `Compra lançada com ${normalizedItems.length} item(ns)`,
      metadata: {
        supplierId: payload.supplierId || null,
        supplierName: payload.supplierName || null,
        totalAmount,
      },
    });

    res.status(201).json({ id: purchaseId, totalAmount, items: normalizedItems.length });
  } catch (error) {
    console.error("Error creating purchase", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados da compra inválidos", issues: error.issues });
    }
    res.status(500).json({ message: "Erro ao registrar compra" });
  }
});

export default router;
