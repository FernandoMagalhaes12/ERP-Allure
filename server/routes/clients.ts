import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { clients, customerCashbackLedger } from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";

function money(value: number) {
  return Number(value.toFixed(2));
}

function computeAvailableCashback(rows: Array<typeof customerCashbackLedger.$inferSelect>) {
  const today = new Date().toISOString().slice(0, 10);
  return money(
    rows.reduce((sum, row) => {
      const amount = Number(row.amount);
      if (amount >= 0) {
        if (!row.expiresAt || row.expiresAt >= today) return sum + amount;
        return sum;
      }
      return sum + amount;
    }, 0)
  );
}

export const listClients: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const rows = await db
      .select()
      .from(clients)
      .where(and(eq(clients.companyId, companyId), eq(clients.isActive, true)))
      .orderBy(asc(clients.name));

    const ledger = await db
      .select()
      .from(customerCashbackLedger)
      .where(eq(customerCashbackLedger.companyId, companyId));

    res.json(
      rows.map((client) => {
        const clientLedger = ledger.filter((item) => item.clientId === client.id && item.status === "active");
        const balance = computeAvailableCashback(clientLedger);
        const expiringSoon = clientLedger
          .filter((item) => Number(item.amount) > 0 && item.expiresAt)
          .some((item) => {
            const diff = Math.ceil((new Date(String(item.expiresAt)).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return diff >= 0 && diff <= 7;
          });
        return {
          ...client,
          availableCashback: balance,
          cashbackExpiringSoon: expiringSoon,
        };
      })
    );
  } catch (error) {
    console.error("List clients error", error);
    res.status(500).json({ error: "Falha ao listar clientes" });
  }
};

export const createClient: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { name, document, email, phone, birthDate, city, state, segment, notes, cashbackOptIn } = req.body;
    if (!name) return res.status(400).json({ error: "Nome do cliente é obrigatório" });

    const [created] = await db
      .insert(clients)
      .values({
        id: randomUUID(),
        companyId,
        name: String(name).trim(),
        document: document ? String(document).trim() : null,
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        birthDate: birthDate || null,
        city: city ? String(city).trim() : null,
        state: state ? String(state).trim() : null,
        segment: segment ? String(segment).trim() : null,
        notes: notes ? String(notes).trim() : null,
        cashbackOptIn: cashbackOptIn !== false,
        isActive: true,
      })
      .returning();

    res.status(201).json({ ...created, availableCashback: 0, cashbackExpiringSoon: false });
  } catch (error) {
    console.error("Create client error", error);
    res.status(500).json({ error: "Falha ao criar cliente" });
  }
};

export const updateClient: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const id = String(req.params.id);
    const [existing] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.companyId, companyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Cliente não encontrado" });

    const [updated] = await db
      .update(clients)
      .set({
        name: req.body.name ?? existing.name,
        document: req.body.document ?? existing.document,
        email: req.body.email ?? existing.email,
        phone: req.body.phone ?? existing.phone,
        birthDate: req.body.birthDate ?? existing.birthDate,
        city: req.body.city ?? existing.city,
        state: req.body.state ?? existing.state,
        segment: req.body.segment ?? existing.segment,
        notes: req.body.notes ?? existing.notes,
        cashbackOptIn: req.body.cashbackOptIn ?? existing.cashbackOptIn,
        isActive: req.body.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id))
      .returning();

    const ledger = await db.select().from(customerCashbackLedger).where(eq(customerCashbackLedger.clientId, id));
    res.json({ ...updated, availableCashback: computeAvailableCashback(ledger), cashbackExpiringSoon: false });
  } catch (error) {
    console.error("Update client error", error);
    res.status(500).json({ error: "Falha ao atualizar cliente" });
  }
};
