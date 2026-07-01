import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { clients, products, stockMovements, suppliers } from "../../drizzle/schema";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

const router = Router();

const importSchema = z.object({
  entity: z.enum(["clients", "suppliers", "products", "stock"]),
  rows: z.array(z.record(z.any())).default([]),
});

function pick(row: Record<string, any>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return fallback;
}

router.post("/preview", async (req, res) => {
  try {
    const payload = importSchema.parse(req.body);
    const preview = payload.rows.slice(0, 5);
    res.json({
      entity: payload.entity,
      received: payload.rows.length,
      preview,
      acceptedEntities: ["clients", "suppliers", "products", "stock"],
      message: "Prévia recebida. Confirme o commit para aplicar na base.",
    });
  } catch (error) {
    console.error("Error importing preview", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Payload de importação inválido", issues: error.issues });
    }
    res.status(500).json({ message: "Erro ao processar prévia de importação" });
  }
});

router.post("/commit", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const payload = importSchema.parse(req.body);

    let created = 0;
    let updated = 0;

    if (payload.entity === "clients") {
      for (const row of payload.rows) {
        const document = pick(row, ["document", "cpf", "cnpj"]);
        const name = pick(row, ["name", "nome", "client", "cliente"]);
        if (!name) continue;

        const [existing] = document
          ? await db.select().from(clients).where(and(eq(clients.companyId, companyId), eq(clients.document, document))).limit(1)
          : [];

        if (existing) {
          await db.update(clients).set({
            name,
            email: pick(row, ["email"] ) || existing.email,
            phone: pick(row, ["phone", "telefone"]) || existing.phone,
            city: pick(row, ["city", "cidade"]) || existing.city,
            state: pick(row, ["state", "uf"]) || existing.state,
            updatedAt: new Date(),
          }).where(eq(clients.id, existing.id));
          updated += 1;
        } else {
          await db.insert(clients).values({
            id: randomUUID(),
            companyId,
            name,
            document: document || null,
            email: pick(row, ["email"]) || null,
            phone: pick(row, ["phone", "telefone"]) || null,
            city: pick(row, ["city", "cidade"]) || null,
            state: pick(row, ["state", "uf"]) || null,
            cashbackOptIn: true,
            isActive: true,
          });
          created += 1;
        }
      }
    }

    if (payload.entity === "suppliers") {
      for (const row of payload.rows) {
        const document = pick(row, ["document", "cnpj", "cpf"]);
        const legalName = pick(row, ["legalName", "razao_social", "name", "nome"]);
        if (!legalName) continue;

        const [existing] = document
          ? await db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.document, document))).limit(1)
          : [];

        if (existing) {
          await db.update(suppliers).set({
            legalName,
            tradeName: pick(row, ["tradeName", "fantasia"]) || existing.tradeName,
            email: pick(row, ["email"]) || existing.email,
            phone: pick(row, ["phone", "telefone"]) || existing.phone,
            updatedAt: new Date(),
          }).where(eq(suppliers.id, existing.id));
          updated += 1;
        } else {
          await db.insert(suppliers).values({
            id: randomUUID(),
            companyId,
            legalName,
            tradeName: pick(row, ["tradeName", "fantasia"]) || null,
            document: document || null,
            email: pick(row, ["email"]) || null,
            phone: pick(row, ["phone", "telefone"]) || null,
            isActive: true,
          });
          created += 1;
        }
      }
    }

    if (payload.entity === "products") {
      for (const row of payload.rows) {
        const code = pick(row, ["code", "sku", "codigo"]);
        const name = pick(row, ["name", "nome", "produto"]);
        if (!code || !name) continue;

        const [existing] = await db.select().from(products).where(and(eq(products.companyId, companyId), eq(products.code, code))).limit(1);
        const cost = Number(pick(row, ["cost", "custo"], "0") || 0);
        const price = Number(pick(row, ["price", "preco", "valor"], "0") || 0);
        const margin = price > 0 ? Number((((price - cost) / price) * 100).toFixed(2)) : 0;
        const stock = Number(pick(row, ["stock", "estoque"], "0") || 0);

        if (existing) {
          await db.update(products).set({
            name,
            category: pick(row, ["category", "categoria"], existing.category),
            size: pick(row, ["size", "tamanho"], existing.size),
            cost: cost ? cost.toFixed(2) : existing.cost,
            price: price ? price.toFixed(2) : existing.price,
            margin: margin.toFixed(2),
            stock,
            updatedAt: new Date(),
          }).where(eq(products.id, existing.id));
          await logAudit({
            companyId,
            userId: req.user?.id ?? null,
            entityType: "product",
            entityId: existing.id,
            action: "import_update",
            description: `Produto atualizado por importação: ${name}`,
            metadata: { changedFields: ["name", "category", "size", "cost", "price", "margin", "stock"] },
          });
          updated += 1;
        } else {
          const id = randomUUID();
          await db.insert(products).values({
            id,
            companyId,
            code,
            name,
            category: pick(row, ["category", "categoria"], "Geral"),
            size: pick(row, ["size", "tamanho"], "Único"),
            cost: cost.toFixed(2),
            price: price.toFixed(2),
            margin: margin.toFixed(2),
            stock,
            minStock: Number(pick(row, ["minStock", "estoque_minimo"], "0") || 0),
            isActive: true,
          });
          await logAudit({
            companyId,
            userId: req.user?.id ?? null,
            entityType: "product",
            entityId: id,
            action: "import_create",
            description: `Produto criado por importação: ${name}`,
            metadata: { changedFields: ["name", "category", "size", "cost", "price", "margin", "stock"] },
          });
          created += 1;
        }
      }
    }

    if (payload.entity === "stock") {
      for (const row of payload.rows) {
        const code = pick(row, ["code", "sku", "codigo"]);
        if (!code) continue;
        const quantity = Number(pick(row, ["stock", "estoque", "quantity", "quantidade"], "0") || 0);
        const [existing] = await db.select().from(products).where(and(eq(products.companyId, companyId), eq(products.code, code))).limit(1);
        if (!existing) continue;
        await db.update(products).set({ stock: quantity, updatedAt: new Date() }).where(eq(products.id, existing.id));
        await db.insert(stockMovements).values({
          id: randomUUID(),
          productId: existing.id,
          type: "adjustment",
          quantity,
          reason: "Ajuste via importação",
          referenceType: "import",
          referenceId: existing.id,
          createdBy: req.user?.id ?? null,
        });
        await logAudit({
          companyId,
          userId: req.user?.id ?? null,
          entityType: "product",
          entityId: existing.id,
          action: "import_stock",
          description: `Estoque atualizado por importação: ${existing.name}`,
          metadata: { changedFields: ["stock"], quantity },
        });
        updated += 1;
      }
    }

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "import",
      action: "commit",
      description: `Importação concluída para ${payload.entity}`,
      metadata: { entity: payload.entity, received: payload.rows.length, created, updated },
    });

    res.json({
      entity: payload.entity,
      imported: payload.rows.length,
      created,
      updated,
      message: "Importação aplicada com sucesso.",
    });
  } catch (error) {
    console.error("Error importing commit", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Payload de importação inválido", issues: error.issues });
    }
    res.status(500).json({ message: "Erro ao registrar importação" });
  }
});

export default router;
