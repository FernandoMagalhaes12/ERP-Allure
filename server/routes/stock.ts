import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { products, stockMovements, users } from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

export const createStockMovement: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { productId, type, quantity, reason } = req.body;
    if (!productId || !type || !quantity || !reason) return res.status(400).json({ error: "Missing required fields" });
    if (!["input", "output", "adjustment"].includes(type)) return res.status(400).json({ error: "Invalid movement type" });

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "Quantity must be positive" });

    const result = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(and(eq(products.id, String(productId)), eq(products.companyId, companyId))).limit(1);
      if (!product) throw new Error("Product not found");

      let nextStock = product.stock;
      if (type === "input") nextStock += qty;
      if (type === "output") nextStock -= qty;
      if (type === "adjustment") nextStock = qty;
      if (nextStock < 0) throw new Error("Insufficient stock for this movement");

      await tx.update(products).set({ stock: nextStock, updatedAt: new Date() }).where(eq(products.id, product.id));

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          id: randomUUID(),
          productId: product.id,
          type,
          quantity: qty,
          reason: String(reason),
          referenceType: "manual",
          referenceId: null,
          createdBy: req.user?.id ?? null,
        })
        .returning();

      return { movement, productName: product.name };
    });

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "product",
      entityId: result.movement.productId,
      action: "stock_adjustment",
      description: `Estoque ajustado manualmente: ${result.productName}`,
      metadata: { changedFields: ["stock"], movementType: type, quantity: qty },
    });

    res.status(201).json({ ...result.movement, productName: result.productName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create stock movement";
    const status = message === "Product not found" ? 404 : 400;
    res.status(status).json({ error: message });
  }
};

export const listStockMovements: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { productId, type, startDate, endDate } = req.query;
    const filters: any[] = [eq(products.companyId, companyId)];
    if (productId) filters.push(eq(stockMovements.productId, String(productId)));
    if (type) filters.push(eq(stockMovements.type, String(type)));
    if (startDate) filters.push(gte(stockMovements.createdAt, new Date(String(startDate))));
    if (endDate) filters.push(lte(stockMovements.createdAt, new Date(`${String(endDate)}T23:59:59.999Z`)));

    const rows = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
        productName: products.name,
        createdByName: users.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(and(...filters))
      .orderBy(desc(stockMovements.createdAt), asc(products.name));

    res.json(rows);
  } catch (error) {
    console.error("List stock movements error", error);
    res.status(500).json({ error: "Failed to list stock movements" });
  }
};

export const getStockMovementsByProduct: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const productId = String(req.params.productId);
    const rows = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
        productName: products.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(and(eq(stockMovements.productId, productId), eq(products.companyId, companyId)))
      .orderBy(desc(stockMovements.createdAt));

    res.json(rows);
  } catch (error) {
    console.error("Get stock movements by product error", error);
    res.status(500).json({ error: "Failed to list stock movements" });
  }
};
