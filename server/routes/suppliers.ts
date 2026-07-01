import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { suppliers } from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";

export const listSuppliers: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const rows = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true)))
      .orderBy(asc(suppliers.legalName));

    res.json(rows);
  } catch (error) {
    console.error("List suppliers error", error);
    res.status(500).json({ error: "Falha ao listar fornecedores" });
  }
};

export const createSupplier: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { legalName, tradeName, document, email, phone, contactName, category, notes } = req.body;
    if (!legalName) return res.status(400).json({ error: "Razão social é obrigatória" });

    const [created] = await db
      .insert(suppliers)
      .values({
        id: randomUUID(),
        companyId,
        legalName: String(legalName).trim(),
        tradeName: tradeName ? String(tradeName).trim() : null,
        document: document ? String(document).trim() : null,
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        contactName: contactName ? String(contactName).trim() : null,
        category: category ? String(category).trim() : null,
        notes: notes ? String(notes).trim() : null,
        isActive: true,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Create supplier error", error);
    res.status(500).json({ error: "Falha ao criar fornecedor" });
  }
};

export const updateSupplier: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const id = String(req.params.id);
    const [existing] = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Fornecedor não encontrado" });

    const [updated] = await db
      .update(suppliers)
      .set({
        legalName: req.body.legalName ?? existing.legalName,
        tradeName: req.body.tradeName ?? existing.tradeName,
        document: req.body.document ?? existing.document,
        email: req.body.email ?? existing.email,
        phone: req.body.phone ?? existing.phone,
        contactName: req.body.contactName ?? existing.contactName,
        category: req.body.category ?? existing.category,
        notes: req.body.notes ?? existing.notes,
        isActive: req.body.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Update supplier error", error);
    res.status(500).json({ error: "Falha ao atualizar fornecedor" });
  }
};
