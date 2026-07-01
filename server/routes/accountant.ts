import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { companySettings, financialEntries, invoices, sales, purchases, customerCashbackLedger } from "../../drizzle/schema";
import { requireTenantCompanyId } from "../tenant";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const [company] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.id, companyId))
      .limit(1);

    const recentSales = await db
      .select({ id: sales.id, customerName: sales.clientName, total: sales.total, createdAt: sales.createdAt })
      .from(sales)
      .where(eq(sales.companyId, companyId))
      .orderBy(desc(sales.createdAt))
      .limit(10);

    const recentPurchases = await db
      .select({ id: purchases.id, supplierName: purchases.supplierName, totalAmount: purchases.totalAmount, createdAt: purchases.createdAt })
      .from(purchases)
      .where(eq(purchases.companyId, companyId))
      .orderBy(desc(purchases.createdAt))
      .limit(10);

    const fiscalDocuments = await db
      .select({ id: invoices.id, number: invoices.number, clientName: invoices.clientName, amount: invoices.amount, emissionDate: invoices.emissionDate, fiscalStatus: invoices.fiscalStatus })
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.emissionDate))
      .limit(20);

    const openFinancial = await db
      .select({ id: financialEntries.id, type: financialEntries.type, description: financialEntries.description, amount: financialEntries.amount, dueDate: financialEntries.dueDate, status: financialEntries.status })
      .from(financialEntries)
      .where(eq(financialEntries.companyId, companyId))
      .orderBy(desc(financialEntries.dueDate))
      .limit(20);

    const cashbackOpen = await db
      .select()
      .from(customerCashbackLedger)
      .where(and(eq(customerCashbackLedger.companyId, companyId), eq(customerCashbackLedger.status, "active")));

    const cashbackBalance = cashbackOpen.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

    res.json({
      company,
      recentSales,
      recentPurchases,
      fiscalDocuments,
      openFinancial,
      cashbackBalance,
      fiscalContact: company?.taxEnvironment || "homologacao",
    });
  } catch (error) {
    console.error("Error accountant summary", error);
    res.status(500).json({ message: "Erro ao gerar portal do contador" });
  }
});

router.get("/exports/fiscal", async (req, res) => {
  try {
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const docs = await db
      .select({
        number: invoices.number,
        series: invoices.series,
        type: invoices.type,
        clientName: invoices.clientName,
        amount: invoices.amount,
        status: invoices.status,
        fiscalStatus: invoices.fiscalStatus,
        emissionDate: invoices.emissionDate,
        accessKey: invoices.accessKey,
      })
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.emissionDate));

    res.json({ generatedAt: new Date().toISOString(), total: docs.length, documents: docs });
  } catch (error) {
    console.error("Error fiscal export", error);
    res.status(500).json({ message: "Erro ao exportar dados fiscais" });
  }
});

export default router;
