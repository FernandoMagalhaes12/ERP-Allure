import {
  pgTable,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const companySettings = pgTable(
  "company_settings",
  {
    id: text("id").primaryKey(),
    tenantCode: text("tenant_code"),
    tenantStatus: text("tenant_status").notNull().default("active"),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    cnpj: text("cnpj").notNull(),
    stateRegistration: text("state_registration"),
    municipalRegistration: text("municipal_registration"),
    taxRegime: text("tax_regime"),
    taxEnvironment: text("tax_environment").notNull().default("homologacao"),
    fiscalApiProvider: text("fiscal_api_provider"),
    fiscalApiToken: text("fiscal_api_token"),
    certificateAlias: text("certificate_alias"),
    certificateEncrypted: text("certificate_encrypted"),
    certificateSubject: text("certificate_subject"),
    certificateUpdatedAt: timestamp("certificate_updated_at", { withTimezone: true }),
    certificateExpiresAt: timestamp("certificate_expires_at", { withTimezone: true }),
    taxAuthorityCode: text("tax_authority_code"),
    sefazAuthorizationUrl: text("sefaz_authorization_url"),
    sefazReturnUrl: text("sefaz_return_url"),
    sefazStatusUrl: text("sefaz_status_url"),
    addressCityCode: text("address_city_code"),
    cscId: text("csc_id"),
    cscCode: text("csc_code"),
    invoiceSeries: text("invoice_series").notNull().default("1"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    cashbackEnabled: boolean("cashback_enabled").notNull().default(true),
    cashbackPercent: numeric("cashback_percent", { precision: 6, scale: 2 }).notNull().default("5.00"),
    cashbackExpiryDays: integer("cashback_expiry_days").notNull().default(45),
    email: text("email"),
    phone: text("phone"),
    addressZipcode: text("address_zipcode"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressNeighborhood: text("address_neighborhood"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    blockSaleWithoutStock: boolean("block_sale_without_stock").notNull().default(true),
    autoInvoiceOnSale: boolean("auto_invoice_on_sale").notNull().default(false),
    defaultSellerName: text("default_seller_name"),
    pixKey: text("pix_key"),
    paymentProvider: text("payment_provider"),
    paymentProviderToken: text("payment_provider_token"),
    paymentWebhookSecret: text("payment_webhook_secret"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTenantCodeIdx: uniqueIndex("company_tenant_code_idx").on(table.tenantCode),
    companyCnpjIdx: index("company_cnpj_idx").on(table.cnpj),
  })
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    permissionsJson: text("permissions_json"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    usersEmailIdx: uniqueIndex("users_email_idx").on(table.email),
    usersCompanyIdx: index("users_company_idx").on(table.companyId),
  })
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    document: text("document"),
    email: text("email"),
    phone: text("phone"),
    contactName: text("contact_name"),
    category: text("category"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    suppliersCompanyIdx: index("suppliers_company_idx").on(table.companyId),
    suppliersDocumentIdx: index("suppliers_document_idx").on(table.document),
  })
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    name: text("name").notNull(),
    document: text("document"),
    email: text("email"),
    phone: text("phone"),
    birthDate: date("birth_date"),
    city: text("city"),
    state: text("state"),
    segment: text("segment"),
    notes: text("notes"),
    cashbackOptIn: boolean("cashback_opt_in").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientsCompanyIdx: index("clients_company_idx").on(table.companyId),
    clientsDocumentIdx: index("clients_document_idx").on(table.document),
    clientsNameIdx: index("clients_name_idx").on(table.name),
  })
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    supplierId: text("supplier_id").references(() => suppliers.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    size: text("size").notNull(),
    ean: text("ean"),
    ncm: text("ncm"),
    cest: text("cest"),
    taxOrigin: text("tax_origin"),
    taxCategory: text("tax_category"),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
    margin: numeric("margin", { precision: 8, scale: 2 }).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productsCompanyCodeIdx: uniqueIndex("products_company_code_idx").on(table.companyId, table.code),
    productsNameIdx: index("products_name_idx").on(table.name),
    productsCompanyIdx: index("products_company_idx").on(table.companyId),
  })
);

export const sales = pgTable(
  "sales",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    userId: text("user_id").notNull().references(() => users.id),
    clientId: text("client_id").references(() => clients.id),
    clientName: text("client_name"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    cashbackRedeemed: numeric("cashback_redeemed", { precision: 12, scale: 2 }).notNull().default("0.00"),
    cashbackEarned: numeric("cashback_earned", { precision: 12, scale: 2 }).notNull().default("0.00"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    salesCompanyIdx: index("sales_company_idx").on(table.companyId),
    salesUserIdx: index("sales_user_idx").on(table.userId),
    salesClientIdx: index("sales_client_idx").on(table.clientId),
    salesCreatedAtIdx: index("sales_created_at_idx").on(table.createdAt),
  })
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => ({
    saleItemsSaleIdx: index("sale_items_sale_idx").on(table.saleId),
    saleItemsProductIdx: index("sale_items_product_idx").on(table.productId),
  })
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id),
    type: text("type").notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    stockMovementsProductIdx: index("stock_movements_product_idx").on(table.productId),
    stockMovementsCreatedAtIdx: index("stock_movements_created_at_idx").on(table.createdAt),
  })
);

export const financialEntries = pgTable(
  "financial_entries",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    type: text("type").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
    dueDate: date("due_date").notNull(),
    paymentDate: date("payment_date"),
    clientId: text("client_id").references(() => clients.id),
    supplierId: text("supplier_id").references(() => suppliers.id),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    financialEntriesCompanyIdx: index("financial_entries_company_idx").on(table.companyId),
    financialEntriesStatusIdx: index("financial_entries_status_idx").on(table.status),
    financialEntriesDueDateIdx: index("financial_entries_due_date_idx").on(table.dueDate),
  })
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    saleId: text("sale_id").references(() => sales.id),
    clientId: text("client_id").references(() => clients.id),
    number: text("number").notNull(),
    series: text("series").notNull().default("1"),
    type: text("type").notNull(),
    clientName: text("client_name").notNull(),
    operationNature: text("operation_nature"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: text("status").notNull().default("emitted"),
    fiscalStatus: text("fiscal_status").notNull().default("draft"),
    environment: text("environment").notNull().default("homologacao"),
    emissionDate: date("emission_date").notNull(),
    accessKey: text("access_key"),
    xmlContent: text("xml_content"),
    signedXmlContent: text("signed_xml_content"),
    validationMessagesJson: text("validation_messages_json"),
    validationIssuesJson: text("validation_issues_json"),
    fiscalDecisionJson: text("fiscal_decision_json"),
    sefazReceipt: text("sefaz_receipt"),
    sefazProtocol: text("sefaz_protocol"),
    sefazStatusCode: text("sefaz_status_code"),
    sefazStatusMessage: text("sefaz_status_message"),
    sefazResponseXml: text("sefaz_response_xml"),
    lastSefazSyncAt: timestamp("last_sefaz_sync_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoicesCompanySeriesNumberIdx: uniqueIndex("invoices_company_series_number_idx").on(table.companyId, table.type, table.series, table.number),
    invoicesCompanyIdx: index("invoices_company_idx").on(table.companyId),
    invoicesEmissionDateIdx: index("invoices_emission_date_idx").on(table.emissionDate),
  })
);

export const fiscalCompanyProfiles = pgTable(
  "fiscal_company_profiles",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    crtCode: text("crt_code").default("1"),
    cnaePrimary: text("cnae_primary"),
    cnaeSecondary: text("cnae_secondary"),
    ieSubstitute: text("ie_substitute"),
    accountingEmail: text("accounting_email"),
    accountantName: text("accountant_name"),
    accountantPhone: text("accountant_phone"),
    ibptVersion: text("ibpt_version"),
    lastIbptSync: date("last_ibpt_sync"),
    nfseEnvironment: text("nfse_environment").default("homologacao"),
    nfseMunicipalityCode: text("nfse_municipality_code"),
    nfseSeries: text("nfse_series").default("1"),
    defaultOperationProfileId: text("default_operation_profile_id"),
    additionalInfo: text("additional_info"),
    decisionMode: text("decision_mode").default("automatic"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fiscalCompanyProfilesCompanyIdx: uniqueIndex("fiscal_company_profiles_company_idx").on(table.companyId),
  })
);

export const fiscalOperationProfiles = pgTable(
  "fiscal_operation_profiles",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    name: text("name").notNull(),
    documentModel: text("document_model").notNull().default("NFC-e"),
    direction: text("direction").notNull().default("saida"),
    destination: text("destination").notNull().default("interna"),
    finalConsumer: boolean("final_consumer").notNull().default(true),
    taxpayerType: text("taxpayer_type").notNull().default("nao_contribuinte"),
    purpose: text("purpose").notNull().default("normal"),
    presenca: text("presenca").notNull().default("1"),
    cfop: text("cfop").notNull(),
    operationNature: text("operation_nature").notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    priority: integer("priority").notNull().default(100),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fiscalOperationProfilesCompanyIdx: index("fiscal_operation_profiles_company_idx").on(table.companyId),
  })
);

export const fiscalProductRules = pgTable(
  "fiscal_product_rules",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    productId: text("product_id").notNull().references(() => products.id),
    cfopInternal: text("cfop_internal"),
    cfopInterstate: text("cfop_interstate"),
    cfopConsumer: text("cfop_consumer"),
    cstIcms: text("cst_icms"),
    csosn: text("csosn"),
    cstPis: text("cst_pis"),
    cstCofins: text("cst_cofins"),
    cstIpi: text("cst_ipi"),
    icmsRate: numeric("icms_rate", { precision: 6, scale: 2 }),
    pisRate: numeric("pis_rate", { precision: 6, scale: 2 }),
    cofinsRate: numeric("cofins_rate", { precision: 6, scale: 2 }),
    ipiRate: numeric("ipi_rate", { precision: 6, scale: 2 }),
    benefitCode: text("benefit_code"),
    serviceCode: text("service_code"),
    ibptCode: text("ibpt_code"),
    notes: text("notes"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    ruleVersion: integer("rule_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fiscalProductRulesCompanyIdx: index("fiscal_product_rules_company_idx").on(table.companyId),
    fiscalProductRulesProductIdx: uniqueIndex("fiscal_product_rules_product_idx").on(table.productId),
  })
);

export const purchases = pgTable(
  "purchases",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    supplierId: text("supplier_id").references(() => suppliers.id),
    supplierName: text("supplier_name"),
    documentNumber: text("document_number"),
    status: text("status").notNull().default("received"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    purchasesCompanyIdx: index("purchases_company_idx").on(table.companyId),
    purchasesSupplierIdx: index("purchases_supplier_idx").on(table.supplierId),
  })
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: text("id").primaryKey(),
    purchaseId: text("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => ({
    purchaseItemsPurchaseIdx: index("purchase_items_purchase_idx").on(table.purchaseId),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    userId: text("user_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    action: text("action").notNull(),
    description: text("description").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    auditLogsCompanyIdx: index("audit_logs_company_idx").on(table.companyId),
    auditLogsEntityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  })
);

export const labelSettings = pgTable(
  "label_settings",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companySettings.id),
    templateName: text("template_name").notNull().default("Etiqueta Principal - Vendas"),
    notes: text("notes"),
    layoutConfigJson: text("layout_config_json"),
    paperType: text("paper_type").notNull().default("personalizado"),
    paperHeightCm: numeric("paper_height_cm", { precision: 6, scale: 2 }).notNull().default("4.00"),
    paperWidthCm: numeric("paper_width_cm", { precision: 6, scale: 2 }).notNull().default("4.00"),
    marginTopCm: numeric("margin_top_cm", { precision: 6, scale: 2 }).notNull().default("0.50"),
    marginBottomCm: numeric("margin_bottom_cm", { precision: 6, scale: 2 }).notNull().default("0.50"),
    marginLeftCm: numeric("margin_left_cm", { precision: 6, scale: 2 }).notNull().default("0.50"),
    marginRightCm: numeric("margin_right_cm", { precision: 6, scale: 2 }).notNull().default("0.50"),
    labelHeightCm: numeric("label_height_cm", { precision: 6, scale: 2 }).notNull().default("4.00"),
    labelWidthCm: numeric("label_width_cm", { precision: 6, scale: 2 }).notNull().default("4.00"),
    columnsCount: integer("columns_count").notNull().default(1),
    columnSpacingCm: numeric("column_spacing_cm", { precision: 6, scale: 2 }).notNull().default("0.00"),
    rowSpacingCm: numeric("row_spacing_cm", { precision: 6, scale: 2 }).notNull().default("0.10"),
    barcodeFormat: text("barcode_format").notNull().default("CODE128"),
    barcodeScale: integer("barcode_scale").notNull().default(2),
    showProductName: boolean("show_product_name").notNull().default(true),
    showSize: boolean("show_size").notNull().default(true),
    showSku: boolean("show_sku").notNull().default(true),
    showBarcode: boolean("show_barcode").notNull().default(true),
    mostrarPrecoCheio: boolean("mostrar_preco_cheio").notNull().default(true),
    mostrarParcelado: boolean("mostrar_parcelado").notNull().default(false),
    parcelas: integer("parcelas").notNull().default(1),
    isDefault: boolean("is_default").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    labelSettingsCompanyIdx: index("label_settings_company_idx").on(table.companyId),
  })
);

export const printLogs = pgTable(
  "print_logs",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").references(() => products.id),
    sku: text("sku").notNull(),
    quantidade: integer("quantidade").notNull(),
    printedAt: timestamp("printed_at", { withTimezone: true }).notNull().defaultNow(),
    userId: text("user_id").references(() => users.id),
  },
  (table) => ({
    printLogsSkuIdx: index("print_logs_sku_idx").on(table.sku),
    printLogsPrintedAtIdx: index("print_logs_printed_at_idx").on(table.printedAt),
  })
);

export const customerCashbackLedger = pgTable(
  "customer_cashback_ledger",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companySettings.id),
    clientId: text("client_id").notNull().references(() => clients.id),
    saleId: text("sale_id").references(() => sales.id),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: text("description").notNull(),
    expiresAt: date("expires_at"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cashbackClientIdx: index("cashback_client_idx").on(table.clientId),
    cashbackCompanyIdx: index("cashback_company_idx").on(table.companyId),
    cashbackExpiresIdx: index("cashback_expires_idx").on(table.expiresAt),
  })
);
