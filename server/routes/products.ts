import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, products, stockMovements, users } from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

function parseMoney(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function slugLetters(input: string) {
  return (
    input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.slice(0, 3).toUpperCase())
      .join("") || "SKU"
  );
}

async function generateSku(companyId: string, name: string, size: string) {
  const prefix = slugLetters(name);
  const suffix = String(size || "UN").toUpperCase().replace(/\s+/g, "").slice(0, 3) || "UN";
  const base = `${prefix}-${suffix}`;

  const existing = await db.select().from(products).where(eq(products.companyId, companyId)).orderBy(asc(products.code));
  let counter = 1;
  let sku = `${base}-${String(counter).padStart(3, "0")}`;

  while (existing.some((product) => product.code === sku)) {
    counter += 1;
    sku = `${base}-${String(counter).padStart(3, "0")}`;
  }

  return sku;
}

function serializeProduct(
  product: typeof products.$inferSelect,
  extras?: {
    lastChangedAt?: string | null;
    lastChangedBy?: string | null;
    lastPriceChangedAt?: string | null;
    lastPriceChangedBy?: string | null;
    lastStockChangedAt?: string | null;
    lastStockChangedBy?: string | null;
    stalledDays?: number | null;
  }
) {
  return {
    ...product,
    cost: Number(product.cost),
    margin: Number(product.margin),
    price: Number(product.price),
    status: product.stock <= 0 ? "Sem estoque" : product.stock <= product.minStock ? "Baixo" : "Normal",
    lastChangedAt: extras?.lastChangedAt ?? null,
    lastChangedBy: extras?.lastChangedBy ?? null,
    lastPriceChangedAt: extras?.lastPriceChangedAt ?? null,
    lastPriceChangedBy: extras?.lastPriceChangedBy ?? null,
    lastStockChangedAt: extras?.lastStockChangedAt ?? null,
    lastStockChangedBy: extras?.lastStockChangedBy ?? null,
    stalledDays: extras?.stalledDays ?? null,
  };
}

export const listProducts: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { search = "", category = "", active = "true", lowStock = "false" } = req.query;
    const filters = [eq(products.companyId, companyId)];
    if (active !== "false") filters.push(eq(products.isActive, true));

    const rows = await db.select().from(products).where(and(...filters)).orderBy(asc(products.name));

    const searchText = String(search).trim().toLowerCase();
    const categoryText = String(category).trim().toLowerCase();

    let serialized = rows.map((row) => serializeProduct(row));

    if (rows.length > 0) {
      const productIds = rows.map((row) => row.id);
      const movementRows = await db
        .select({
          productId: stockMovements.productId,
          createdAt: stockMovements.createdAt,
          userName: users.name,
        })
        .from(stockMovements)
        .leftJoin(users, eq(stockMovements.createdBy, users.id))
        .where(inArray(stockMovements.productId, productIds))
        .orderBy(desc(stockMovements.createdAt));

      const auditRows = await db
        .select({
          entityId: auditLogs.entityId,
          createdAt: auditLogs.createdAt,
          userName: users.name,
          metadataJson: auditLogs.metadataJson,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(and(eq(auditLogs.companyId, companyId), eq(auditLogs.entityType, "product"), inArray(auditLogs.entityId, productIds)))
        .orderBy(desc(auditLogs.createdAt));

      const movementMap = new Map<string, { createdAt: string; userName: string | null }>();
      for (const row of movementRows) {
        if (!movementMap.has(row.productId)) {
          movementMap.set(row.productId, {
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
            userName: row.userName || null,
          });
        }
      }

      const generalAuditMap = new Map<string, { createdAt: string; userName: string | null }>();
      const priceAuditMap = new Map<string, { createdAt: string; userName: string | null }>();
      const stockAuditMap = new Map<string, { createdAt: string; userName: string | null }>();

      for (const row of auditRows) {
        const entityId = row.entityId || "";
        if (!entityId) continue;
        const stamp = row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString();
        const payload = (() => {
          try {
            return row.metadataJson ? JSON.parse(String(row.metadataJson)) : null;
          } catch {
            return null;
          }
        })();
        const changedFields = Array.isArray(payload?.changedFields) ? payload.changedFields.map((item: unknown) => String(item)) : [];
        if (!generalAuditMap.has(entityId)) {
          generalAuditMap.set(entityId, { createdAt: stamp, userName: row.userName || null });
        }
        if (!priceAuditMap.has(entityId) && changedFields.some((field) => ["price", "cost", "margin"].includes(field))) {
          priceAuditMap.set(entityId, { createdAt: stamp, userName: row.userName || null });
        }
        if (!stockAuditMap.has(entityId) && changedFields.includes("stock")) {
          stockAuditMap.set(entityId, { createdAt: stamp, userName: row.userName || null });
        }
      }

      serialized = rows.map((row) => {
        const movement = movementMap.get(row.id);
        const generalAudit = generalAuditMap.get(row.id);
        const priceAudit = priceAuditMap.get(row.id);
        const stockAudit = stockAuditMap.get(row.id) || movement;
        const referenceDate = stockAudit?.createdAt || row.updatedAt?.toISOString?.() || (row.updatedAt ? new Date(row.updatedAt).toISOString() : null) || (row.createdAt ? new Date(row.createdAt).toISOString() : null);
        const stalledDays = row.stock > 0 && referenceDate ? Math.floor((Date.now() - new Date(referenceDate).getTime()) / 86400000) : null;
        return serializeProduct(row, {
          lastChangedAt: generalAudit?.createdAt || (row.updatedAt ? new Date(row.updatedAt).toISOString() : null),
          lastChangedBy: generalAudit?.userName || null,
          lastPriceChangedAt: priceAudit?.createdAt || null,
          lastPriceChangedBy: priceAudit?.userName || null,
          lastStockChangedAt: stockAudit?.createdAt || null,
          lastStockChangedBy: stockAudit?.userName || null,
          stalledDays,
        });
      });
    }

    if (searchText) {
      serialized = serialized.filter(
        (product) =>
          product.name.toLowerCase().includes(searchText) ||
          product.code.toLowerCase().includes(searchText) ||
          product.size.toLowerCase().includes(searchText)
      );
    }

    if (categoryText) {
      serialized = serialized.filter((product) => product.category.toLowerCase() === categoryText);
    }

    if (lowStock === "true") {
      serialized = serialized.filter((product) => product.stock <= product.minStock);
    }

    res.json(serialized);
  } catch (error) {
    console.error("List products error", error);
    res.status(500).json({ error: "Falha ao listar produtos" });
  }
};

export const createProduct: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { code, name, category, size, cost, margin, stock, minStock, supplierId, ean, ncm, cest, taxOrigin, taxCategory } = req.body;

    if (!name || !category || !size || cost === undefined || margin === undefined) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    const generatedCode = code?.trim() || (await generateSku(companyId, String(name), String(size)));
    const [existing] = await db.select().from(products).where(eq(products.code, generatedCode)).limit(1);

    if (existing) {
      return res.status(409).json({ error: "SKU já existe" });
    }

    const normalizedCost = parseMoney(cost);
    const normalizedMargin = parseMoney(margin);
    const price = parseMoney(normalizedCost * (1 + normalizedMargin / 100));

    const [created] = await db
      .insert(products)
      .values({
        id: randomUUID(),
        companyId,
        supplierId: supplierId || null,
        code: generatedCode,
        name: String(name).trim(),
        category: String(category).trim(),
        size: String(size).trim(),
        ean: ean ? String(ean).trim() : null,
        ncm: ncm ? String(ncm).trim() : null,
        cest: cest ? String(cest).trim() : null,
        taxOrigin: taxOrigin ? String(taxOrigin).trim() : null,
        taxCategory: taxCategory ? String(taxCategory).trim() : null,
        cost: normalizedCost.toFixed(2),
        margin: normalizedMargin.toFixed(2),
        price: price.toFixed(2),
        stock: Number(stock || 0),
        minStock: Number(minStock || 0),
        isActive: true,
      })
      .returning();

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "product",
      entityId: created.id,
      action: "create",
      description: `Produto criado: ${created.name}`,
      metadata: { changedFields: ["name", "category", "size", "cost", "margin", "price", "stock", "minStock", "ean"], code: created.code },
    });

    res.status(201).json(serializeProduct(created));
  } catch (error) {
    console.error("Create product error", error);
    res.status(500).json({ error: "Falha ao criar produto" });
  }
};

export const updateProduct: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params;
    const [existing] = await db.select().from(products).where(and(eq(products.id, String(id)), eq(products.companyId, companyId))).limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const nextCost = req.body.cost !== undefined ? parseMoney(req.body.cost) : Number(existing.cost);
    const nextMargin = req.body.margin !== undefined ? parseMoney(req.body.margin) : Number(existing.margin);
    const nextPrice = parseMoney(nextCost * (1 + nextMargin / 100));
    const nextStock = req.body.stock ?? existing.stock;
    const nextMinStock = req.body.minStock ?? existing.minStock;
    const nextName = req.body.name ?? existing.name;
    const nextCategory = req.body.category ?? existing.category;
    const nextSize = req.body.size ?? existing.size;
    const nextCode = req.body.code ?? existing.code;
    const nextEan = req.body.ean ?? existing.ean;
    const nextSupplierId = req.body.supplierId ?? existing.supplierId;
    const changedFields = [
      nextName !== existing.name ? "name" : null,
      nextCategory !== existing.category ? "category" : null,
      nextSize !== existing.size ? "size" : null,
      nextCode !== existing.code ? "code" : null,
      nextEan !== existing.ean ? "ean" : null,
      nextSupplierId !== existing.supplierId ? "supplierId" : null,
      nextCost !== Number(existing.cost) ? "cost" : null,
      nextMargin !== Number(existing.margin) ? "margin" : null,
      nextPrice !== Number(existing.price) ? "price" : null,
      Number(nextStock) !== existing.stock ? "stock" : null,
      Number(nextMinStock) !== existing.minStock ? "minStock" : null,
    ].filter(Boolean);

    const [updated] = await db
      .update(products)
      .set({
        supplierId: nextSupplierId,
        code: nextCode,
        name: nextName,
        category: nextCategory,
        size: nextSize,
        ean: nextEan,
        ncm: req.body.ncm ?? existing.ncm,
        cest: req.body.cest ?? existing.cest,
        taxOrigin: req.body.taxOrigin ?? existing.taxOrigin,
        taxCategory: req.body.taxCategory ?? existing.taxCategory,
        cost: nextCost.toFixed(2),
        margin: nextMargin.toFixed(2),
        price: nextPrice.toFixed(2),
        stock: nextStock,
        minStock: nextMinStock,
        isActive: req.body.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(products.id, String(id)))
      .returning();

    if (changedFields.length > 0) {
      await logAudit({
        companyId,
        userId: req.user?.id ?? null,
        entityType: "product",
        entityId: updated.id,
        action: "update",
        description: `Produto atualizado: ${updated.name}`,
        metadata: { changedFields, code: updated.code, stock: updated.stock, price: updated.price },
      });
    }

    res.json(serializeProduct(updated));
  } catch (error) {
    console.error("Update product error", error);
    res.status(500).json({ error: "Falha ao atualizar produto" });
  }
};

export const deleteProduct: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params;
    const [updated] = await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(products.id, String(id)), eq(products.companyId, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "product",
      entityId: updated.id,
      action: "delete",
      description: `Produto inativado: ${updated.name}`,
      metadata: { changedFields: ["isActive"], code: updated.code },
    });

    res.json(serializeProduct(updated));
  } catch (error) {
    console.error("Delete product error", error);
    res.status(500).json({ error: "Falha ao excluir produto" });
  }
};
