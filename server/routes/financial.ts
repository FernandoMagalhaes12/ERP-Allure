import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { financialEntries } from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

function serializeEntry(entry: typeof financialEntries.$inferSelect) {
  return {
    ...entry,
    amount: Number(entry.amount),
  };
}

export const createFinancialEntry: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { type, description, amount, category, status, dueDate, paymentDate, clientId, supplierId } = req.body;

    if (!type || !description || amount === undefined || !category || !status || !dueDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["revenue", "expense"].includes(type)) {
      return res.status(400).json({ error: "Invalid entry type" });
    }

    if (!["paid", "pending", "canceled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [entry] = await db
      .insert(financialEntries)
      .values({
        id: randomUUID(),
        companyId,
        type,
        description: String(description),
        amount: Number(amount).toFixed(2),
        category: String(category),
        status,
        dueDate: String(dueDate),
        paymentDate: paymentDate ? String(paymentDate) : null,
        clientId: clientId || null,
        supplierId: supplierId || null,
        sourceType: "manual",
        sourceId: null,
        createdBy: req.user?.id ?? null,
      })
      .returning();

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "financial_entry",
      entityId: entry.id,
      action: "create",
      description: `Lançamento financeiro criado: ${entry.description}`,
      metadata: { type, amount },
    });
    res.status(201).json(serializeEntry(entry));
  } catch (error) {
    console.error("Create financial entry error", error);
    res.status(500).json({ error: "Failed to create financial entry" });
  }
};

export const listFinancialEntries: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { type, status, startDate, endDate } = req.query;
    const filters: any[] = [eq(financialEntries.companyId, companyId)];

    if (type) filters.push(eq(financialEntries.type, String(type)));
    if (status) filters.push(eq(financialEntries.status, String(status)));
    if (startDate) filters.push(gte(financialEntries.dueDate, String(startDate)));
    if (endDate) filters.push(lte(financialEntries.dueDate, String(endDate)));

    const rows = await db
      .select()
      .from(financialEntries)
      .where(and(...filters))
      .orderBy(desc(financialEntries.dueDate), asc(financialEntries.description));

    res.json(rows.map(serializeEntry));
  } catch (error) {
    console.error("List financial entries error", error);
    res.status(500).json({ error: "Failed to list financial entries" });
  }
};

export const updateFinancialEntry: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params;
    const [existing] = await db
      .select()
      .from(financialEntries)
      .where(and(eq(financialEntries.id, String(id)), eq(financialEntries.companyId, companyId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Entry not found" });
    }

    const [updated] = await db
      .update(financialEntries)
      .set({
        type: req.body.type ?? existing.type,
        description: req.body.description ?? existing.description,
        amount: req.body.amount !== undefined ? Number(req.body.amount).toFixed(2) : existing.amount,
        category: req.body.category ?? existing.category,
        status: req.body.status ?? existing.status,
        dueDate: req.body.dueDate ?? existing.dueDate,
        paymentDate: req.body.paymentDate !== undefined ? req.body.paymentDate : existing.paymentDate,
        clientId: req.body.clientId !== undefined ? req.body.clientId : existing.clientId,
        supplierId: req.body.supplierId !== undefined ? req.body.supplierId : existing.supplierId,
        updatedAt: new Date(),
      })
      .where(eq(financialEntries.id, String(id)))
      .returning();

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "financial_entry",
      entityId: updated.id,
      action: "update",
      description: `Lançamento financeiro atualizado: ${updated.description}`,
      metadata: { status: updated.status, amount: updated.amount },
    });
    res.json(serializeEntry(updated));
  } catch (error) {
    console.error("Update financial entry error", error);
    res.status(500).json({ error: "Failed to update financial entry" });
  }
};

export const deleteFinancialEntry: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params;
    const [deleted] = await db
      .delete(financialEntries)
      .where(and(eq(financialEntries.id, String(id)), eq(financialEntries.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Entry not found" });
    }

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "financial_entry",
      entityId: deleted.id,
      action: "delete",
      description: `Lançamento financeiro removido: ${deleted.description}`,
      metadata: { status: deleted.status, amount: deleted.amount },
    });
    res.json(serializeEntry(deleted));
  } catch (error) {
    console.error("Delete financial entry error", error);
    res.status(500).json({ error: "Failed to delete financial entry" });
  }
};
