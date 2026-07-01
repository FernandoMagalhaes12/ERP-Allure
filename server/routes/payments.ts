import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companySettings } from "../../drizzle/schema";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const [company] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
    res.json({
      pixKey: company?.pixKey || "",
      paymentProvider: company?.paymentProvider || "manual",
      paymentProviderToken: company?.paymentProviderToken || "",
      paymentWebhookSecret: company?.paymentWebhookSecret || "",
      availableProviders: ["manual", "mercado_pago", "pagarme", "asaas"],
    });
  } catch (error) {
    console.error("Payment integration get error", error);
    res.status(500).json({ error: "Falha ao carregar integrações de pagamento" });
  }
});

router.put("/", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const [updated] = await db
      .update(companySettings)
      .set({
        pixKey: req.body.pixKey ?? null,
        paymentProvider: req.body.paymentProvider ?? "manual",
        paymentProviderToken: req.body.paymentProviderToken ?? null,
        paymentWebhookSecret: req.body.paymentWebhookSecret ?? null,
        updatedAt: new Date(),
      })
      .where(eq(companySettings.id, companyId))
      .returning();

    await logAudit({
      companyId,
      userId: req.user?.id ?? null,
      entityType: "payment_integration",
      entityId: companyId,
      action: "update",
      description: "Integrações de pagamento atualizadas",
      metadata: { paymentProvider: updated?.paymentProvider || "manual" },
    });

    res.json({
      pixKey: updated?.pixKey || "",
      paymentProvider: updated?.paymentProvider || "manual",
      paymentProviderToken: updated?.paymentProviderToken || "",
      paymentWebhookSecret: updated?.paymentWebhookSecret || "",
      availableProviders: ["manual", "mercado_pago", "pagarme", "asaas"],
    });
  } catch (error) {
    console.error("Payment integration update error", error);
    res.status(500).json({ error: "Falha ao salvar integrações de pagamento" });
  }
});

export default router;
