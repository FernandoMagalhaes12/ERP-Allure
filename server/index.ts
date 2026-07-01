import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleLogout, handleMe } from "./routes/auth";
import { handleDashboardMetrics } from "./routes/dashboard";
import { listProducts, createProduct, updateProduct, deleteProduct } from "./routes/products";
import { createSale, listSales, getSaleById, getSalesContext } from "./routes/sales";
import { createStockMovement, listStockMovements, getStockMovementsByProduct } from "./routes/stock";
import { createFinancialEntry, listFinancialEntries, updateFinancialEntry, deleteFinancialEntry } from "./routes/financial";
import {
  emitInvoice,
  listInvoices,
  getInvoiceById,
  downloadInvoicePDF,
  downloadInvoiceXML,
  getFiscalOverview,
  listFiscalOperationProfiles,
  listFiscalProductRules,
  upsertFiscalCompanyProfile,
  upsertFiscalOperationProfile,
  upsertFiscalProductRule,
  reprocessInvoice,
  cancelInvoice,
  uploadFiscalCertificate,
  getFiscalCertificateStatus,
  transmitInvoiceById,
  syncInvoiceStatus,
} from "./routes/fiscal";
import { getCompanySettings, updateCompanySettings, getLabelSettings, saveLabelSettings, printLabelTest } from "./routes/settings";
import { createUser, listUsers, updateUser } from "./routes/users";
import { createClient, listClients, updateClient } from "./routes/clients";
import { createSupplier, listSuppliers, updateSupplier } from "./routes/suppliers";
import purchasesRouter from "./routes/purchases";
import auditRouter from "./routes/audit";
import importsRouter from "./routes/imports";
import accountantRouter from "./routes/accountant";
import paymentsRouter from "./routes/payments";
import { authenticate, authorize, authorizePermission } from "./auth";
import { ensureEnterpriseInfrastructure } from "./platform";

export function createServer() {
  const app = express();
  void ensureEnterpriseInfrastructure();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    res.json({ message: process.env.PING_MESSAGE ?? "pong" });
  });

  app.get("/api/demo", handleDemo);

  app.post("/api/v1/auth/login", handleLogin);
  app.post("/api/v1/auth/logout", handleLogout);
  app.get("/api/v1/auth/me", authenticate, handleMe);

  app.use("/api/v1", authenticate);

  app.get("/api/v1/dashboard/metrics", authorize("admin"), handleDashboardMetrics);

  app.get("/api/v1/products", authorizePermission("products.view"), listProducts);
  app.post("/api/v1/products", authorize("admin"), createProduct);
  app.put("/api/v1/products/:id", authorize("admin"), updateProduct);
  app.delete("/api/v1/products/:id", authorize("admin"), deleteProduct);

  app.get("/api/v1/clients", authorizePermission("clients.view", "accountant.view", "financial.view", "fiscal.view"), listClients);
  app.post("/api/v1/clients", authorize("admin"), createClient);
  app.put("/api/v1/clients/:id", authorize("admin"), updateClient);

  app.get("/api/v1/suppliers", authorizePermission("accountant.view", "financial.view", "purchases.view"), listSuppliers);
  app.post("/api/v1/suppliers", authorize("admin"), createSupplier);
  app.put("/api/v1/suppliers/:id", authorize("admin"), updateSupplier);

  app.get("/api/v1/sales/context", authorizePermission("sales.view"), getSalesContext);
  app.post("/api/v1/sales", authorizePermission("sales.create"), createSale);
  app.get("/api/v1/sales", authorizePermission("sales.view", "fiscal.view", "accountant.view"), listSales);
  app.get("/api/v1/sales/:id", authorizePermission("sales.view", "fiscal.view", "accountant.view"), getSaleById);

  app.post("/api/v1/stock/movements", authorize("admin"), createStockMovement);
  app.get("/api/v1/stock/movements", authorize("admin"), listStockMovements);
  app.get("/api/v1/stock/movements/:productId", authorize("admin"), getStockMovementsByProduct);

  app.post("/api/v1/financial/entries", authorize("admin"), createFinancialEntry);
  app.get("/api/v1/financial/entries", authorizePermission("financial.view", "accountant.view"), listFinancialEntries);
  app.put("/api/v1/financial/entries/:id", authorize("admin"), updateFinancialEntry);
  app.delete("/api/v1/financial/entries/:id", authorize("admin"), deleteFinancialEntry);

  app.get("/api/v1/fiscal/overview", authorizePermission("fiscal.view"), getFiscalOverview);
  app.get("/api/v1/fiscal/product-rules", authorizePermission("fiscal.view"), listFiscalProductRules);
  app.put("/api/v1/fiscal/product-rules/:productId", authorizePermission("fiscal.manage"), upsertFiscalProductRule);
  app.get("/api/v1/fiscal/operation-profiles", authorizePermission("fiscal.view"), listFiscalOperationProfiles);
  app.post("/api/v1/fiscal/operation-profiles", authorizePermission("fiscal.manage"), upsertFiscalOperationProfile);
  app.put("/api/v1/fiscal/operation-profiles/:id", authorizePermission("fiscal.manage"), upsertFiscalOperationProfile);
  app.put("/api/v1/fiscal/company-profile", authorizePermission("fiscal.manage"), upsertFiscalCompanyProfile);
  app.post("/api/v1/fiscal/certificate", authorizePermission("fiscal.manage"), uploadFiscalCertificate);
  app.get("/api/v1/fiscal/certificate", authorizePermission("fiscal.view"), getFiscalCertificateStatus);
  app.post("/api/v1/fiscal/invoice", authorizePermission("fiscal.emit"), emitInvoice);
  app.post("/api/v1/fiscal/invoices/:id/transmit", authorizePermission("fiscal.emit"), transmitInvoiceById);
  app.post("/api/v1/fiscal/invoices/:id/sync", authorizePermission("fiscal.view", "fiscal.emit"), syncInvoiceStatus);
  app.post("/api/v1/fiscal/invoices/:id/reprocess", authorizePermission("fiscal.manage"), reprocessInvoice);
  app.post("/api/v1/fiscal/invoices/:id/cancel", authorizePermission("fiscal.manage"), cancelInvoice);
  app.get("/api/v1/fiscal/invoices", authorizePermission("fiscal.view"), listInvoices);
  app.get("/api/v1/fiscal/invoices/:id", authorizePermission("fiscal.view"), getInvoiceById);
  app.get("/api/v1/fiscal/invoices/:id/pdf", authorizePermission("fiscal.view"), downloadInvoicePDF);
  app.get("/api/v1/fiscal/invoices/:id/xml", authorizePermission("fiscal.view"), downloadInvoiceXML);

  app.get("/api/v1/settings/company", authorizePermission("fiscal.view", "fiscal.manage"), getCompanySettings);
  app.put("/api/v1/settings/company", authorize("admin"), updateCompanySettings);
  app.get("/api/v1/label-settings", authorizePermission("settings.labels.view"), getLabelSettings);
  app.post("/api/v1/label-settings", authorizePermission("settings.labels.manage", "settings.labels.print"), saveLabelSettings);
  app.post("/api/v1/label-settings/print-test", authorizePermission("settings.labels.print"), printLabelTest);

  app.get("/api/v1/users", authorize("admin"), listUsers);
  app.post("/api/v1/users", authorize("admin"), createUser);
  app.put("/api/v1/users/:id", authorize("admin"), updateUser);

  app.use("/api/v1/purchases", authorize("admin"), purchasesRouter);
  app.use("/api/v1/audit", authorize("admin"), auditRouter);
  app.use("/api/v1/imports", authorize("admin"), importsRouter);
  app.use("/api/v1/accountant", authorizePermission("accountant.view"), accountantRouter);
  app.use("/api/v1/payment-integrations", authorize("admin"), paymentsRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled server error", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
