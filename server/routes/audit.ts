import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { auditLogs } from "../../drizzle/schema";
import { requireTenantCompanyId } from "../tenant";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.companyId, companyId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(300);

    res.json(
      rows.map((row) => ({
        ...row,
        metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null,
      }))
    );
  } catch (error) {
    console.error("Error listing audit logs", error);
    res.status(500).json({ message: "Erro ao listar auditoria" });
  }
});

export default router;
