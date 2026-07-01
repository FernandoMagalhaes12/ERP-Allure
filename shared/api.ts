export type UserRole = "admin" | "contador" | "vendedor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  permissions?: string[];
}

export type SizeVariant = "PP" | "P" | "M" | "G" | "GG" | "XG" | "Plus Size" | "Único";

export interface Supplier {
  id: string;
  legalName: string;
  tradeName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  category?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface Client {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  notes?: string | null;
  cashbackOptIn?: boolean;
  isActive?: boolean;
  availableCashback?: number;
  cashbackExpiringSoon?: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  size: SizeVariant | string;
  supplierId?: string | null;
  ean?: string | null;
  ncm?: string | null;
  cest?: string | null;
  taxOrigin?: string | null;
  taxCategory?: string | null;
  cost: number;
  margin: number;
  price: number;
  stock: number;
  minStock: number;
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastChangedAt?: string | null;
  lastChangedBy?: string | null;
  lastPriceChangedAt?: string | null;
  lastPriceChangedBy?: string | null;
  lastStockChangedAt?: string | null;
  lastStockChangedBy?: string | null;
  stalledDays?: number | null;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  productName?: string;
}

export interface Sale {
  id: string;
  userId: string;
  sellerName?: string;
  sellerId?: string;
  clientId?: string | null;
  clientName?: string | null;
  items?: SaleItem[];
  subtotal: number;
  discount: number;
  cashbackRedeemed?: number;
  cashbackEarned?: number;
  total: number;
  paymentMethod: "money" | "pix" | "credit_card" | "debit_card";
  status?: string;
  createdAt: string;
  itemsCount?: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  type: "input" | "output" | "adjustment";
  quantity: number;
  reason: string;
  createdAt: string;
  createdByName?: string | null;
}

export interface FinancialEntry {
  id: string;
  type: "revenue" | "expense";
  description: string;
  amount: number;
  category: string;
  status: "paid" | "pending" | "canceled";
  dueDate: string;
  paymentDate?: string | null;
  clientId?: string | null;
  supplierId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FiscalValidationIssue {
  code: string;
  message: string;
  severity: "warning" | "error" | "critical";
  blocking: boolean;
}

export interface Invoice {
  id: string;
  saleId?: string | null;
  clientId?: string | null;
  number: string;
  series?: string;
  type: "NFe" | "NFC-e" | "NFS-e";
  clientName: string;
  operationNature?: string | null;
  amount: number;
  status: string;
  fiscalStatus?: string;
  environment?: string;
  emissionDate: string;
  accessKey?: string | null;
  createdAt?: string;
  validationMessages?: string[];
  validationIssues?: FiscalValidationIssue[];
  resolvedCfop?: string | null;
  sentAt?: string | null;
  authorizedAt?: string | null;
  canceledAt?: string | null;
}

export interface DashboardSeriesPoint {
  date?: string;
  month?: string;
  revenue?: number;
  expenses?: number;
  sales?: number;
}

export interface OperationalAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  salesCount: number;
  productsInStock: number;
  lowStockProducts: number;
  averageMargin: number;
  activeClients?: number;
  activeSuppliers?: number;
  cashbackLiability?: number;
  cashbackExpiringSoon?: number;
  pendingInvoices?: number;
  operationalAlerts?: OperationalAlert[];
  topProduct?: Product | null;
  revenueSeries?: DashboardSeriesPoint[];
  salesSeries?: DashboardSeriesPoint[];
}

export interface Purchase {
  id: string;
  supplierId?: string | null;
  supplierName?: string | null;
  documentNumber?: string | null;
  status: string;
  totalAmount: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  itemCount?: number;
}

export interface AuditLog {
  id: string;
  companyId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  metadata?: any;
  createdAt: string;
}


export interface FiscalReadinessCheck {
  key: string;
  title: string;
  ok: boolean;
  detail: string;
  severity?: "warning" | "error" | "critical";
  dependsOnAccountant?: boolean;
}

export interface FiscalCompanyProfile {
  id: string;
  companyId: string;
  crtCode?: string | null;
  cnaePrimary?: string | null;
  cnaeSecondary?: string | null;
  ieSubstitute?: string | null;
  accountingEmail?: string | null;
  accountantName?: string | null;
  accountantPhone?: string | null;
  ibptVersion?: string | null;
  lastIbptSync?: string | null;
  nfseEnvironment?: string | null;
  nfseMunicipalityCode?: string | null;
  nfseSeries?: string | null;
  defaultOperationProfileId?: string | null;
  additionalInfo?: string | null;
  decisionMode?: string | null;
}

export interface FiscalProductRule {
  id: string;
  productId: string;
  productName?: string;
  productCode?: string;
  ncm?: string | null;
  cest?: string | null;
  taxOrigin?: string | null;
  cfopInternal?: string | null;
  cfopInterstate?: string | null;
  cfopConsumer?: string | null;
  cstIcms?: string | null;
  csosn?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  cstIpi?: string | null;
  icmsRate?: number | null;
  pisRate?: number | null;
  cofinsRate?: number | null;
  ipiRate?: number | null;
  benefitCode?: string | null;
  serviceCode?: string | null;
  ibptCode?: string | null;
  notes?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  ruleVersion?: number | null;
  isComplete?: boolean;
  updatedAt?: string;
}

export interface FiscalOperationProfile {
  id: string;
  name: string;
  documentModel: string;
  direction: string;
  destination: string;
  finalConsumer: boolean;
  taxpayerType: string;
  purpose: string;
  presenca: string;
  cfop: string;
  operationNature: string;
  validFrom?: string | null;
  validTo?: string | null;
  priority?: number | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface FiscalOverview {
  company: any;
  fiscalProfile: FiscalCompanyProfile | null;
  checks: FiscalReadinessCheck[];
  invoices: Invoice[];
  pendingSales: Array<{
    id: string;
    clientId?: string | null;
    clientName?: string | null;
    total: number;
    createdAt: string;
    itemsCount: number;
  }>;
  productRules: FiscalProductRule[];
  operationProfiles: FiscalOperationProfile[];
  summary: {
    configuredProducts: number;
    totalProducts: number;
    configuredOperations: number;
    totalOperations: number;
    readyDocuments: number;
    pendingDocuments: number;
    readinessScore: number;
    warningCount: number;
    errorCount: number;
    criticalCount: number;
  };
}

export interface AccountantSummary {
  company?: any;
  recentSales: Array<any>;
  recentPurchases: Array<any>;
  fiscalDocuments: Array<any>;
  openFinancial: Array<any>;
  cashbackBalance: number;
  fiscalContact?: string;
}

export interface PaymentIntegrationSettings {
  pixKey: string;
  paymentProvider: string;
  paymentProviderToken: string;
  paymentWebhookSecret: string;
  availableProviders: string[];
}

export interface LoginResponse {
  user: User;
  sessionId?: string;
}
