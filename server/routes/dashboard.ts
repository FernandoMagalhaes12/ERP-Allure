import { RequestHandler } from "express";
import { db } from "../db";
import { clients, customerCashbackLedger, financialEntries, invoices, products, saleItems, sales, suppliers } from "../../drizzle/schema";
import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";

function numberValue(value: unknown) {
  return Number(value || 0);
}

export const handleDashboardMetrics: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const [revenueRow] = await db
      .select({ total: sql<string>`coalesce(sum(${financialEntries.amount}), 0)` })
      .from(financialEntries)
      .where(and(eq(financialEntries.companyId, companyId), eq(financialEntries.type, "revenue"), eq(financialEntries.status, "paid")));

    const [expenseRow] = await db
      .select({ total: sql<string>`coalesce(sum(${financialEntries.amount}), 0)` })
      .from(financialEntries)
      .where(and(eq(financialEntries.companyId, companyId), eq(financialEntries.type, "expense"), eq(financialEntries.status, "paid")));

    const [salesCountRow] = await db.select({ total: count() }).from(sales).where(eq(sales.companyId, companyId));
    const [productsCountRow] = await db.select({ total: count() }).from(products).where(and(eq(products.companyId, companyId), eq(products.isActive, true)));
    const [clientsCountRow] = await db.select({ total: count() }).from(clients).where(and(eq(clients.companyId, companyId), eq(clients.isActive, true)));
    const [suppliersCountRow] = await db.select({ total: count() }).from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true)));
    const [lowStockRow] = await db.select({ total: count() }).from(products).where(and(eq(products.companyId, companyId), eq(products.isActive, true), lte(products.stock, products.minStock)));
    const [pendingInvoiceRow] = await db
      .select({
        total: sql<string>`coalesce(sum(case when ${invoices.status} <> 'authorized' or ${invoices.fiscalStatus} in ('critical', 'error', 'warning', 'processing', 'pending_config', 'pending') then 1 else 0 end), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.companyId, companyId));

    const [marginRow] = await db
      .select({ average: sql<string>`coalesce(avg(${products.margin}), 0)` })
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.isActive, true)));

    const [topProductRow] = await db
      .select({
        id: products.id,
        code: products.code,
        name: products.name,
        category: products.category,
        size: products.size,
        cost: products.cost,
        margin: products.margin,
        price: products.price,
        stock: products.stock,
        minStock: products.minStock,
        quantitySold: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(eq(sales.companyId, companyId), eq(products.isActive, true)))
      .groupBy(products.id)
      .orderBy(desc(sql`coalesce(sum(${saleItems.quantity}), 0)`))
      .limit(1);

    const revenueSeries = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${financialEntries.createdAt}), 'DD/MM')`,
        revenue: sql<string>`coalesce(sum(case when ${financialEntries.type} = 'revenue' then ${financialEntries.amount} else 0 end), 0)`,
        expenses: sql<string>`coalesce(sum(case when ${financialEntries.type} = 'expense' then ${financialEntries.amount} else 0 end), 0)`,
      })
      .from(financialEntries)
      .where(and(eq(financialEntries.companyId, companyId), eq(financialEntries.status, "paid")))
      .groupBy(sql`date_trunc('day', ${financialEntries.createdAt})`)
      .orderBy(sql`date_trunc('day', ${financialEntries.createdAt}) desc`)
      .limit(7);

    const salesSeries = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${sales.createdAt}), 'TMMon')`,
        sales: count(),
      })
      .from(sales)
      .where(eq(sales.companyId, companyId))
      .groupBy(sql`date_trunc('month', ${sales.createdAt})`)
      .orderBy(sql`date_trunc('month', ${sales.createdAt}) desc`)
      .limit(6);

    const cashbackRows = await db.select().from(customerCashbackLedger).where(eq(customerCashbackLedger.companyId, companyId));
    const today = new Date();
    const cashbackLiability = cashbackRows.reduce((sum, row) => {
      const amount = Number(row.amount);
      if (amount < 0) return sum + amount;
      if (!row.expiresAt || new Date(String(row.expiresAt)) >= today) return sum + amount;
      return sum;
    }, 0);
    const cashbackExpiringSoon = cashbackRows.filter((row) => {
      if (Number(row.amount) <= 0 || !row.expiresAt) return false;
      const diff = Math.ceil((new Date(String(row.expiresAt)).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;

    const lowStockProducts = Number(lowStockRow?.total || 0);
    const pendingInvoices = Number(pendingInvoiceRow?.total || 0);
    const operationalAlerts = [
      lowStockProducts > 0
        ? { severity: "warning", title: "Ruptura em potencial", description: `${lowStockProducts} produto(s) no limite mínimo de estoque.` }
        : null,
      pendingInvoices > 0
        ? { severity: "warning", title: "Fiscal em revisão", description: `${pendingInvoices} nota(s) exigem complementação fiscal.` }
        : null,
      cashbackExpiringSoon > 0
        ? { severity: "info", title: "Cashback expirando", description: `${cashbackExpiringSoon} lançamento(s) de cashback vencem nos próximos 7 dias.` }
        : null,
    ].filter(Boolean);

    const totalRevenue = numberValue(revenueRow?.total);
    const totalExpenses = numberValue(expenseRow?.total);

    const monthMap: Record<string, string> = {
      jan: "Jan",
      fev: "Fev",
      mar: "Mar",
      abr: "Abr",
      mai: "Mai",
      jun: "Jun",
      jul: "Jul",
      ago: "Ago",
      set: "Set",
      out: "Out",
      nov: "Nov",
      dez: "Dez",
      january: "Jan",
      february: "Fev",
      march: "Mar",
      april: "Abr",
      may: "Mai",
      june: "Jun",
      july: "Jul",
      august: "Ago",
      september: "Set",
      october: "Out",
      november: "Nov",
      december: "Dez",
    };

    res.json({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      salesCount: Number(salesCountRow?.total || 0),
      productsInStock: Number(productsCountRow?.total || 0),
      lowStockProducts,
      averageMargin: Math.round(numberValue(marginRow?.average) * 100) / 100,
      activeClients: Number(clientsCountRow?.total || 0),
      activeSuppliers: Number(suppliersCountRow?.total || 0),
      cashbackLiability: Math.max(0, Number(cashbackLiability.toFixed(2))),
      cashbackExpiringSoon,
      pendingInvoices,
      operationalAlerts,
      topProduct: topProductRow
        ? {
            id: topProductRow.id,
            code: topProductRow.code,
            name: topProductRow.name,
            category: topProductRow.category,
            size: topProductRow.size,
            cost: numberValue(topProductRow.cost),
            margin: numberValue(topProductRow.margin),
            price: numberValue(topProductRow.price),
            stock: topProductRow.stock,
            minStock: topProductRow.minStock,
          }
        : null,
      revenueSeries: revenueSeries.reverse().map((row) => ({
        date: row.date,
        revenue: numberValue(row.revenue),
        expenses: numberValue(row.expenses),
      })),
      salesSeries: salesSeries.reverse().map((row) => ({
        month: monthMap[String(row.month || "").trim().toLowerCase().replace('.', '')] || String(row.month || "").trim(),
        sales: Number(row.sales),
      })),
    });
  } catch (error) {
    console.error("Dashboard metrics error", error);
    res.status(500).json({ error: "Failed to load dashboard metrics" });
  }
};
