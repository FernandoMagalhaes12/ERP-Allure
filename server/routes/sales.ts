import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, desc, eq, gte, inArray, lte, count } from "drizzle-orm";
import { db } from "../db";
import {
  clients,
  companySettings,
  customerCashbackLedger,
  financialEntries,
  products,
  saleItems,
  sales,
  stockMovements,
  users,
} from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";
import { logAudit } from "../audit";

const VALID_PAYMENT_METHODS = ["money", "pix", "credit_card", "debit_card"];

function money(value: number) {
  return Number(value.toFixed(2));
}

async function getAvailableCashback(companyId: string, clientId: string) {
  const rows = await db
    .select()
    .from(customerCashbackLedger)
    .where(and(eq(customerCashbackLedger.companyId, companyId), eq(customerCashbackLedger.clientId, clientId), eq(customerCashbackLedger.status, "active")));

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

export const createSale: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { clientId, clientName, items, discount = 0, paymentMethod, cashbackRedeemed = 0, cashbackPercentOverride } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Adicione pelo menos um item" });
    }

    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: "Forma de pagamento inválida" });
    }

    let client = null;
    if (clientId) {
      const [clientRow] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, String(clientId)), eq(clients.companyId, companyId), eq(clients.isActive, true)))
        .limit(1);
      if (!clientRow) {
        return res.status(400).json({ error: "Cliente informado não foi encontrado" });
      }
      client = clientRow;
    }

    const productIds = items.map((item) => item.productId);
    const productRows = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.companyId, companyId), eq(products.isActive, true)));

    if (productRows.length !== productIds.length) {
      return res.status(400).json({ error: "Um ou mais produtos estão inativos, excluídos ou não foram encontrados" });
    }

    const [company] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
    const productMap = new Map(productRows.map((product) => [product.id, product]));
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      const quantity = Number(item.quantity || 0);

      if (!product || quantity <= 0) {
        return res.status(400).json({ error: "Item de venda inválido" });
      }

      if ((company?.blockSaleWithoutStock ?? true) && product.stock < quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para ${product.name}` });
      }

      subtotal += Number(product.price) * quantity;
    }

    const normalizedDiscount = money(Number(discount || 0));
    const requestedCashback = money(Number(cashbackRedeemed || 0));

    if (requestedCashback > 0 && !client) {
      return res.status(400).json({ error: "Selecione um cliente para resgatar cashback" });
    }

    const availableCashback = client ? await getAvailableCashback(companyId, client.id) : 0;
    if (requestedCashback > availableCashback) {
      return res.status(400).json({ error: "Saldo de cashback insuficiente para resgate" });
    }

    const totalDiscount = money(normalizedDiscount + requestedCashback);
    const total = money(subtotal - totalDiscount);

    if (total < 0) {
      return res.status(400).json({ error: "Desconto maior do que o subtotal" });
    }

    const cashbackEnabled = Boolean(company?.cashbackEnabled);
    const companyCashbackPercent = Number(company?.cashbackPercent || 0);
    const requestedCashbackPercent = cashbackPercentOverride === undefined || cashbackPercentOverride === null
      ? companyCashbackPercent
      : Math.max(0, Math.min(100, Number(cashbackPercentOverride)));
    const cashbackPercent = cashbackEnabled ? requestedCashbackPercent : 0;
    const cashbackExpiryDays = Number(company?.cashbackExpiryDays || 45);
    const cashbackEarned = client && cashbackEnabled && client.cashbackOptIn ? money(total * cashbackPercent / 100) : 0;

    const saleId = randomUUID();
    const now = new Date();
    const nowDate = now.toISOString().slice(0, 10);
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + cashbackExpiryDays);

    const sale = await db.transaction(async (tx) => {
      const [createdSale] = await tx
        .insert(sales)
        .values({
          id: saleId,
          companyId,
          userId: req.user!.id,
          clientId: client?.id || null,
          clientName: client?.name || (clientName ? String(clientName).trim() : null),
          subtotal: subtotal.toFixed(2),
          discount: normalizedDiscount.toFixed(2),
          cashbackRedeemed: requestedCashback.toFixed(2),
          cashbackEarned: cashbackEarned.toFixed(2),
          total: total.toFixed(2),
          paymentMethod,
          status: "completed",
        })
        .returning();

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const quantity = Number(item.quantity);
        const unitPrice = money(Number(product.price));
        const totalPrice = money(unitPrice * quantity);

        await tx.insert(saleItems).values({
          id: randomUUID(),
          saleId,
          productId: product.id,
          quantity,
          unitPrice: unitPrice.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
        });

        await tx.update(products).set({ stock: Math.max(0, product.stock - quantity), updatedAt: now }).where(eq(products.id, product.id));

        await tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: product.id,
          type: "output",
          quantity,
          reason: "Venda PDV",
          referenceType: "sale",
          referenceId: saleId,
          createdBy: req.user!.id,
        });
      }

      await tx.insert(financialEntries).values({
        id: randomUUID(),
        companyId,
        type: "revenue",
        description: `Venda ${saleId}`,
        amount: total.toFixed(2),
        category: "Venda de Produtos",
        status: "paid",
        dueDate: nowDate,
        paymentDate: nowDate,
        clientId: client?.id || null,
        sourceType: "sale",
        sourceId: saleId,
        createdBy: req.user!.id,
      });

      if (client && requestedCashback > 0) {
        await tx.insert(customerCashbackLedger).values({
          id: randomUUID(),
          companyId,
          clientId: client.id,
          saleId,
          type: "redeem",
          amount: `-${requestedCashback.toFixed(2)}`,
          description: `Resgate aplicado na venda ${saleId}`,
          status: "active",
        });
      }

      if (client && cashbackEarned > 0) {
        await tx.insert(customerCashbackLedger).values({
          id: randomUUID(),
          companyId,
          clientId: client.id,
          saleId,
          type: "earn",
          amount: cashbackEarned.toFixed(2),
          description: `Cashback gerado na venda ${saleId}`,
          expiresAt: expiresAt.toISOString().slice(0, 10),
          status: "active",
        });
      }


      return createdSale;
    });

    const saleItemsRows = await db
      .select({
        productId: saleItems.productId,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        totalPrice: saleItems.totalPrice,
        productName: products.name,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, saleId));

    await logAudit({
      companyId,
      userId: req.user.id,
      entityType: "sale",
      entityId: saleId,
      action: "create",
      description: `Venda concluída com ${items.length} item(ns)`,
      metadata: { total, cashbackPercent, cashbackEarned, cashbackRedeemed: requestedCashback, autoInvoiceOnSale: Boolean(company?.autoInvoiceOnSale), fiscalAutoEmissionDeferred: Boolean(company?.autoInvoiceOnSale) },
    });

    res.status(201).json({
      ...sale,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      cashbackRedeemed: Number(sale.cashbackRedeemed),
      cashbackEarned: Number(sale.cashbackEarned),
      total: Number(sale.total),
      items: saleItemsRows.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), totalPrice: Number(item.totalPrice) })),
    });
  } catch (error) {
    console.error("Create sale error", error);
    res.status(500).json({ error: "Falha ao criar venda" });
  }
};

export const getSalesContext: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const [company] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
    res.json({
      cashbackEnabled: Boolean(company?.cashbackEnabled),
      cashbackPercent: Number(company?.cashbackPercent || 0),
      cashbackExpiryDays: Number(company?.cashbackExpiryDays || 45),
      paymentMethods: VALID_PAYMENT_METHODS,
    });
  } catch (error) {
    console.error("Get sales context error", error);
    res.status(500).json({ error: "Falha ao carregar contexto de vendas" });
  }
};

export const listSales: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { startDate, endDate, paymentMethod, userId, clientId } = req.query;
    const filters: any[] = [eq(sales.companyId, companyId)];

    if (paymentMethod) filters.push(eq(sales.paymentMethod, String(paymentMethod)));
    if (userId) filters.push(eq(sales.userId, String(userId)));
    if (clientId) filters.push(eq(sales.clientId, String(clientId)));
    if (startDate) filters.push(gte(sales.createdAt, new Date(`${String(startDate)}T00:00:00.000Z`)));
    if (endDate) filters.push(lte(sales.createdAt, new Date(`${String(endDate)}T23:59:59.999Z`)));

    const rows = await db
      .select({
        id: sales.id,
        userId: sales.userId,
        clientId: sales.clientId,
        sellerName: users.name,
        clientName: sales.clientName,
        subtotal: sales.subtotal,
        discount: sales.discount,
        cashbackRedeemed: sales.cashbackRedeemed,
        cashbackEarned: sales.cashbackEarned,
        total: sales.total,
        paymentMethod: sales.paymentMethod,
        status: sales.status,
        createdAt: sales.createdAt,
        itemsCount: count(saleItems.id),
      })
      .from(sales)
      .leftJoin(saleItems, eq(sales.id, saleItems.saleId))
      .leftJoin(users, eq(sales.userId, users.id))
      .where(and(...filters))
      .groupBy(sales.id, users.name)
      .orderBy(desc(sales.createdAt));

    const saleIds = rows.map((row) => row.id);
    const itemsRows = saleIds.length
      ? await db
          .select({
            saleId: saleItems.saleId,
            productId: saleItems.productId,
            quantity: saleItems.quantity,
            unitPrice: saleItems.unitPrice,
            totalPrice: saleItems.totalPrice,
            productName: products.name,
            category: products.category,
          })
          .from(saleItems)
          .innerJoin(products, eq(saleItems.productId, products.id))
          .where(inArray(saleItems.saleId, saleIds))
      : [];

    const itemsBySaleId = new Map<string, Array<any>>();
    for (const item of itemsRows) {
      const current = itemsBySaleId.get(item.saleId) || [];
      current.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        total: Number(item.totalPrice),
        productName: item.productName,
        category: item.category,
      });
      itemsBySaleId.set(item.saleId, current);
    }

    res.json(
      rows.map((row) => ({
        ...row,
        sellerId: row.userId,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        cashbackRedeemed: Number(row.cashbackRedeemed),
        cashbackEarned: Number(row.cashbackEarned),
        total: Number(row.total),
        itemsCount: Number(row.itemsCount || 0),
        items: itemsBySaleId.get(row.id) || [],
      }))
    );
  } catch (error) {
    console.error("List sales error", error);
    res.status(500).json({ error: "Falha ao listar vendas" });
  }
};

export const getSaleById: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params;
    const [sale] = await db.select().from(sales).where(and(eq(sales.id, String(id)), eq(sales.companyId, companyId))).limit(1);

    if (!sale) {
      return res.status(404).json({ error: "Venda não encontrada" });
    }

    const items = await db
      .select({
        id: saleItems.id,
        productId: saleItems.productId,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        totalPrice: saleItems.totalPrice,
        productName: products.name,
      })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, String(id)));

    res.json({
      ...sale,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      cashbackRedeemed: Number(sale.cashbackRedeemed),
      cashbackEarned: Number(sale.cashbackEarned),
      total: Number(sale.total),
      items: items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), totalPrice: Number(item.totalPrice) })),
    });
  } catch (error) {
    console.error("Get sale error", error);
    res.status(500).json({ error: "Falha ao buscar venda" });
  }
};
