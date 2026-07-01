import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { logAudit } from "../audit";
import { clients, companySettings, fiscalCompanyProfiles, fiscalOperationProfiles, fiscalProductRules, invoices, products, saleItems, sales } from "../../drizzle/schema";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";
import { buildNfeXml, encryptFiscalPayload, loadCertificateFromEncrypted, queryNfeReceipt, reserveNextInvoiceNumber, resolveTransmissionConfig, signXml, transmitSignedNfe, validatePfxWithOpenSsl } from "../services/fiscalIntegration";

const BLOCKING_SEVERITIES = new Set(["error", "critical"]);
type ValidationSeverity = "warning" | "error" | "critical";
type ValidationIssue = { code: string; message: string; severity: ValidationSeverity; blocking: boolean };
type ProductRuleRow = typeof fiscalProductRules.$inferSelect;
type OperationRow = typeof fiscalOperationProfiles.$inferSelect;
type ProfileRow = typeof fiscalCompanyProfiles.$inferSelect;
type CompanyRow = typeof companySettings.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type FiscalDecision = { destination: "interna" | "interestadual" | "exterior"; finalConsumer: boolean; taxpayerType: "contribuinte_icms" | "nao_contribuinte"; operationId: string | null; operationName: string | null; cfop: string | null; operationNature: string | null; resolvedAt: string; itemDecisions: Array<{ productId: string; productName: string; cfop: string | null; ruleVersion: number | null }>; };

type EmissionContext = Awaited<ReturnType<typeof resolveEmissionData>>;

function numberValue(value: unknown) { return Number(value || 0); }
function parseJsonArray<T>(raw: unknown, fallback: T[] = []) { if (!raw) return fallback; if (Array.isArray(raw)) return raw as T[]; if (typeof raw !== "string") return fallback; try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? (parsed as T[]) : fallback; } catch { return fallback; } }
function issue(code: string, message: string, severity: ValidationSeverity): ValidationIssue { return { code, message, severity, blocking: BLOCKING_SEVERITIES.has(severity) }; }
function cfopMatchesDestination(cfop: string | null | undefined, destination: FiscalDecision["destination"]) { if (!cfop) return false; const v = String(cfop).trim(); if (!v) return false; if (destination === "interna") return v.startsWith("5"); if (destination === "interestadual") return v.startsWith("6"); return v.startsWith("7"); }
function isDateWithin(referenceDate: string, validFrom?: string | null, validTo?: string | null) { if (validFrom && referenceDate < validFrom) return false; if (validTo && referenceDate > validTo) return false; return true; }
function escapePdfText(text: string) { return String(text || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function validateRuleWindow(payload: { validFrom?: string | null; validTo?: string | null }) { if (payload.validFrom && payload.validTo && payload.validFrom > payload.validTo) throw new Error("Intervalo de vigência inválido: início maior que fim."); }
function inferTaxpayerType(client?: ClientRow | null): FiscalDecision["taxpayerType"] { const document = String(client?.document || "").replace(/\D/g, ""); return document.length === 14 ? "contribuinte_icms" : "nao_contribuinte"; }
function inferDestination(company: CompanyRow | undefined, client?: ClientRow | null): FiscalDecision["destination"] { const companyUf = String(company?.addressState || "").trim().toUpperCase(); const clientUf = String(client?.state || "").trim().toUpperCase(); if (!clientUf) return "interna"; return companyUf && clientUf !== companyUf ? "interestadual" : "interna"; }
function resolveItemCfop(rule: ProductRuleRow | undefined, decision: FiscalDecision) { if (!rule) return null; if (decision.destination === "interestadual") return rule.cfopInterstate || null; if (decision.finalConsumer) return rule.cfopConsumer || rule.cfopInternal || null; return rule.cfopInternal || null; }
function summarizeIssues(issues: ValidationIssue[]) { return { warningCount: issues.filter((i) => i.severity === "warning").length, errorCount: issues.filter((i) => i.severity === "error").length, criticalCount: issues.filter((i) => i.severity === "critical").length, blocking: issues.some((i) => i.blocking) }; }

function serializeInvoice(invoice: InvoiceRow) {
  const validationMessages = parseJsonArray<string>(invoice.validationMessagesJson, []);
  const validationIssues = parseJsonArray<ValidationIssue>((invoice as any).validationIssuesJson, []);
  const decision = (invoice as any).fiscalDecisionJson ? JSON.parse((invoice as any).fiscalDecisionJson) : null;
  return { ...invoice, amount: Number(invoice.amount), validationMessages, validationIssues, resolvedCfop: decision?.cfop || null, signedXmlContent: (invoice as any).signedXmlContent || null, sefazStatusCode: (invoice as any).sefazStatusCode || null, sefazStatusMessage: (invoice as any).sefazStatusMessage || null, lastSefazSyncAt: (invoice as any).lastSefazSyncAt || null };
}

function buildSimpleInvoicePdf(invoice: ReturnType<typeof serializeInvoice>) {
  const lines = ["Allure ERP - Documento Fiscal", `Numero: ${invoice.number}`, `Serie: ${invoice.series}`, `Tipo: ${invoice.type}`, `Cliente: ${invoice.clientName}`, `Valor: R$ ${Number(invoice.amount).toFixed(2)}`, `Data de emissao: ${invoice.emissionDate}`, `Status fiscal: ${invoice.fiscalStatus || invoice.status}`, `Fluxo: ${invoice.status}`, `CFOP: ${invoice.resolvedCfop || "Nao resolvido"}`, `Chave: ${invoice.accessKey || "Nao informada"}`, `SEFAZ: ${invoice.sefazStatusCode || "--"} ${invoice.sefazStatusMessage || ""}`];
  const content = ["BT", "/F1 12 Tf", "50 780 Td"].concat(lines.flatMap((line, index) => index === 0 ? [`(${escapePdfText(line)}) Tj`] : ["0 -22 Td", `(${escapePdfText(line)}) Tj`])).concat(["ET"]).join("\n");
  const objects = ["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj", "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj", "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj", `4 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`, "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"];
  let pdf = "%PDF-1.4\n"; const offsets: number[] = []; for (const object of objects) { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${object}\n`; }
  const xrefStart = Buffer.byteLength(pdf, "utf8"); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n"); pdf += `\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`; return Buffer.from(pdf, "utf8");
}

function buildChecks(params: { company?: CompanyRow; profile?: ProfileRow; operationProfiles: OperationRow[]; configuredProducts: number; totalProducts: number; }) {
  const { company, profile, operationProfiles, configuredProducts, totalProducts } = params;
  return [
    { key: "cnpj", title: "CNPJ do emitente", ok: Boolean(company?.cnpj), detail: "Obrigatório para emissão fiscal", severity: "critical", dependsOnAccountant: true },
    { key: "address", title: "Endereço fiscal", ok: Boolean(company?.addressCity && company?.addressState && company?.addressStreet && company?.addressNumber), detail: "Usado no cadastro do emitente", severity: "critical", dependsOnAccountant: true },
    { key: "cityCode", title: "Código IBGE da cidade", ok: Boolean((company as any)?.addressCityCode), detail: "Necessário para XML autorizado pela SEFAZ", severity: "critical", dependsOnAccountant: true },
    { key: "taxRegime", title: "Regime tributário", ok: Boolean(company?.taxRegime && profile?.crtCode), detail: "Base para CST/CSOSN/CRT", severity: "critical", dependsOnAccountant: true },
    { key: "certificate", title: "Certificado A1 carregado", ok: Boolean((company as any)?.certificateEncrypted), detail: "Necessário para assinatura e transmissão", severity: "critical", dependsOnAccountant: false },
    { key: "sefazEndpoints", title: "Endpoints da SEFAZ", ok: Boolean((company as any)?.sefazAuthorizationUrl && (company as any)?.sefazReturnUrl), detail: "Autorização e retorno configurados", severity: "critical", dependsOnAccountant: false },
    { key: "provider", title: "Provedor fiscal", ok: Boolean(company?.fiscalApiProvider), detail: "Integração direta ou gateway", severity: "error", dependsOnAccountant: false },
    { key: "environment", title: "Ambiente fiscal", ok: Boolean(company?.taxEnvironment), detail: "Homologação ou produção", severity: "warning", dependsOnAccountant: false },
    { key: "csc", title: "CSC NFC-e", ok: Boolean(company?.cscCode), detail: "Obrigatório para QR Code NFC-e", severity: "warning", dependsOnAccountant: true },
    { key: "operationProfiles", title: "Perfis de operação", ok: operationProfiles.length > 0, detail: "CFOP e natureza parametrizados", severity: "critical", dependsOnAccountant: true },
    { key: "products", title: "Regras fiscais por produto", ok: totalProducts > 0 && configuredProducts >= totalProducts, detail: "NCM/CEST/origem/CST/CSOSN por item", severity: "critical", dependsOnAccountant: true },
    { key: "ibpt", title: "Carga tributária IBPT", ok: Boolean(profile?.ibptVersion), detail: "Necessária para Lei 12.741/12", severity: "warning", dependsOnAccountant: true },
    { key: "decisionMode", title: "Motor de decisão automática", ok: String(profile?.decisionMode || "automatic") === "automatic", detail: "O ERP decide automaticamente a operação fiscal", severity: "critical", dependsOnAccountant: false },
  ];
}

async function resolveFiscalContext(companyId: string) {
  const [company] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
  const [profile] = await db.select().from(fiscalCompanyProfiles).where(eq(fiscalCompanyProfiles.companyId, companyId)).limit(1);
  const operations = await db.select().from(fiscalOperationProfiles).where(eq(fiscalOperationProfiles.companyId, companyId)).orderBy(fiscalOperationProfiles.priority, desc(fiscalOperationProfiles.isDefault), fiscalOperationProfiles.name);
  const rules = await db.select({ id: fiscalProductRules.id, companyId: fiscalProductRules.companyId, productId: fiscalProductRules.productId, cfopInternal: fiscalProductRules.cfopInternal, cfopInterstate: fiscalProductRules.cfopInterstate, cfopConsumer: fiscalProductRules.cfopConsumer, cstIcms: fiscalProductRules.cstIcms, csosn: fiscalProductRules.csosn, cstPis: fiscalProductRules.cstPis, cstCofins: fiscalProductRules.cstCofins, cstIpi: fiscalProductRules.cstIpi, icmsRate: fiscalProductRules.icmsRate, pisRate: fiscalProductRules.pisRate, cofinsRate: fiscalProductRules.cofinsRate, ipiRate: fiscalProductRules.ipiRate, benefitCode: fiscalProductRules.benefitCode, serviceCode: fiscalProductRules.serviceCode, ibptCode: fiscalProductRules.ibptCode, notes: fiscalProductRules.notes, validFrom: fiscalProductRules.validFrom, validTo: fiscalProductRules.validTo, ruleVersion: fiscalProductRules.ruleVersion, updatedAt: fiscalProductRules.updatedAt, productName: products.name, productCode: products.code, ncm: products.ncm, cest: products.cest, taxOrigin: products.taxOrigin, ean: products.ean, price: products.price }).from(fiscalProductRules).innerJoin(products, eq(products.id, fiscalProductRules.productId)).where(eq(fiscalProductRules.companyId, companyId));
  const allProducts = await db.select().from(products).where(eq(products.companyId, companyId));
  const configuredProducts = rules.filter((rule) => Boolean(rule.ncm && (rule.csosn || rule.cstIcms) && (rule.cfopInternal || rule.cfopConsumer || rule.cfopInterstate))).length;
  const checks = buildChecks({ company, profile, operationProfiles: operations, configuredProducts, totalProducts: allProducts.length });
  return { company, profile, operations, rules, allProducts, checks, configuredProducts };
}

function selectOperationProfile(params: { operations: OperationRow[]; type: string; referenceDate: string; destination: FiscalDecision["destination"]; finalConsumer: boolean; taxpayerType: FiscalDecision["taxpayerType"]; requestedOperationProfileId?: string | null; }) {
  const active = params.operations.filter((item) => item.isActive && item.documentModel === params.type && item.destination === params.destination && item.finalConsumer === params.finalConsumer && item.taxpayerType === params.taxpayerType && isDateWithin(params.referenceDate, item.validFrom, item.validTo));
  if (params.requestedOperationProfileId) return active.find((item) => item.id === params.requestedOperationProfileId) || null;
  return active.find((item) => item.isDefault) || active[0] || null;
}

function buildValidationIssues(args: { company?: CompanyRow; profile?: ProfileRow; client?: ClientRow | null; operation?: OperationRow | null; decision: FiscalDecision; saleItemsRows: Array<typeof saleItems.$inferSelect>; productRules: Array<{ product?: typeof products.$inferSelect; rule?: ProductRuleRow }>; type: string; }) {
  const issues: ValidationIssue[] = [];
  const companyUf = String(args.company?.addressState || "").trim().toUpperCase();
  const clientUf = String(args.client?.state || "").trim().toUpperCase();
  if (!args.company?.cnpj) issues.push(issue("COMPANY_CNPJ_REQUIRED", "CNPJ do emitente não configurado.", "critical"));
  if (!companyUf) issues.push(issue("COMPANY_UF_REQUIRED", "UF da empresa é obrigatória para decidir a operação fiscal.", "critical"));
  if (!(args.company as any)?.addressCityCode) issues.push(issue("COMPANY_CITY_CODE_REQUIRED", "Código IBGE da cidade do emitente é obrigatório para montar o XML NF-e.", "critical"));
  if (!args.company?.stateRegistration) issues.push(issue("COMPANY_IE_REQUIRED", "Inscrição estadual do emitente é obrigatória para NF-e/NFC-e.", "error"));
  if (!args.company?.taxRegime || !args.profile?.crtCode) issues.push(issue("TAX_REGIME_REQUIRED", "Regime tributário/CRT não configurados.", "critical"));
  if (!args.operation) issues.push(issue("OPERATION_PROFILE_NOT_FOUND", "Nenhum perfil fiscal compatível foi encontrado automaticamente.", "error"));
  if (args.saleItemsRows.length === 0) issues.push(issue("SALE_ITEMS_REQUIRED", "Venda sem itens fiscais para documentar.", "critical"));
  if (!(args.company as any)?.certificateEncrypted) issues.push(issue("CERTIFICATE_MISSING", "Certificado digital A1 não foi carregado no sistema.", "critical"));
  if (!(args.company as any)?.sefazAuthorizationUrl || !(args.company as any)?.sefazReturnUrl) issues.push(issue("SEFAZ_ENDPOINTS_MISSING", "Endpoints da SEFAZ não configurados para autorização e retorno.", "critical"));
  if (!args.company?.fiscalApiProvider) issues.push(issue("PROVIDER_MISSING", "Provedor fiscal não configurado.", "error"));
  if (args.type === "NFC-e" && !args.company?.cscCode) issues.push(issue("CSC_MISSING", "CSC da NFC-e não configurado.", "error"));
  if (!args.profile?.ibptVersion) issues.push(issue("IBPT_MISSING", "Versão da tabela IBPT não informada.", "warning"));
  if (args.client && !clientUf) issues.push(issue("CLIENT_UF_REQUIRED", "UF do cliente é obrigatória para operação identificada.", "warning"));
  for (const item of args.productRules) {
    if (!item.product) { issues.push(issue("PRODUCT_NOT_FOUND", "Produto da venda não localizado.", "critical")); continue; }
    const cfop = resolveItemCfop(item.rule, args.decision);
    if (!item.product.ncm) issues.push(issue(`NCM_REQUIRED_${item.product.id}`, `Produto ${item.product.name} sem NCM.`, "critical"));
    if (!item.product.taxOrigin) issues.push(issue(`ORIGIN_REQUIRED_${item.product.id}`, `Produto ${item.product.name} sem origem fiscal.`, "error"));
    if (!item.rule) issues.push(issue(`RULE_REQUIRED_${item.product.id}`, `Produto ${item.product.name} sem regra fiscal vinculada.`, "critical"));
    if (item.rule && !(item.rule.csosn || item.rule.cstIcms)) issues.push(issue(`CST_REQUIRED_${item.product.id}`, `Produto ${item.product.name} sem CST/CSOSN.`, "critical"));
    if (!cfop) issues.push(issue(`CFOP_REQUIRED_${item.product.id}`, `CFOP não configurado para o produto ${item.product.name}.`, "critical"));
    if (cfop && !cfopMatchesDestination(cfop, args.decision.destination)) issues.push(issue(`CFOP_INCONSISTENT_${item.product.id}`, `CFOP ${cfop} incompatível com operação ${args.decision.destination}.`, "error"));
  }
  if (args.operation?.cfop && !cfopMatchesDestination(args.operation.cfop, args.decision.destination)) issues.push(issue("OPERATION_CFOP_INCONSISTENT", `CFOP do perfil (${args.operation.cfop}) incompatível com a operação ${args.decision.destination}.`, "error"));
  return issues;
}

async function resolveEmissionData(params: { companyId: string; saleId?: string | null; clientId?: string | null; type: string; operationProfileId?: string | null; }) {
  const { company, profile, operations } = await resolveFiscalContext(params.companyId);
  const client = params.clientId ? (await db.select().from(clients).where(and(eq(clients.id, String(params.clientId)), eq(clients.companyId, params.companyId))).limit(1))[0] : null;
  const sale = params.saleId ? (await db.select().from(sales).where(and(eq(sales.id, String(params.saleId)), eq(sales.companyId, params.companyId))).limit(1))[0] : null;
  const saleItemsRows = params.saleId ? await db.select().from(saleItems).where(eq(saleItems.saleId, String(params.saleId))) : [];
  const productIds = saleItemsRows.map((item) => item.productId);
  const saleProducts = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
  const saleRules = productIds.length ? await db.select().from(fiscalProductRules).where(and(eq(fiscalProductRules.companyId, params.companyId), inArray(fiscalProductRules.productId, productIds))) : [];
  const referenceDate = new Date().toISOString().slice(0, 10);
  const productMap = new Map(saleProducts.map((item) => [item.id, item]));
  const versionedRuleMap = new Map<string, ProductRuleRow>();
  for (const rule of saleRules) {
    if (!isDateWithin(referenceDate, rule.validFrom, rule.validTo)) continue;
    const current = versionedRuleMap.get(rule.productId);
    if (!current || (rule.ruleVersion || 0) > (current.ruleVersion || 0)) versionedRuleMap.set(rule.productId, rule);
  }
  const destination = inferDestination(company, client);
  const taxpayerType = inferTaxpayerType(client);
  const finalConsumer = taxpayerType === "nao_contribuinte";
  const operation = selectOperationProfile({ operations, type: params.type, referenceDate, destination, finalConsumer, taxpayerType, requestedOperationProfileId: params.operationProfileId || null });
  const decision: FiscalDecision = { destination, finalConsumer, taxpayerType, operationId: operation?.id || null, operationName: operation?.name || null, cfop: operation?.cfop || null, operationNature: operation?.operationNature || null, resolvedAt: new Date().toISOString(), itemDecisions: saleItemsRows.map((item) => ({ productId: item.productId, productName: productMap.get(item.productId)?.name || item.productId, cfop: resolveItemCfop(versionedRuleMap.get(item.productId), { destination, finalConsumer, taxpayerType, operationId: operation?.id || null, operationName: operation?.name || null, cfop: operation?.cfop || null, operationNature: operation?.operationNature || null, resolvedAt: new Date().toISOString(), itemDecisions: [] }), ruleVersion: versionedRuleMap.get(item.productId)?.ruleVersion || null })) };
  const productRules = saleItemsRows.map((item) => ({ product: productMap.get(item.productId), rule: versionedRuleMap.get(item.productId) }));
  const issues = buildValidationIssues({ company, profile: profile || undefined, client, operation, decision, saleItemsRows, productRules, type: params.type });
  return { company, profile, client, operation, decision, issues, saleItemsRows, productRules, sale };
}

async function signAndTransmitInvoice(invoice: InvoiceRow, context: EmissionContext) {
  const company = context.company as CompanyRow & any;
  const certificate = loadCertificateFromEncrypted(String(company.certificateEncrypted));
  const emissionIso = `${invoice.emissionDate}T${new Date().toISOString().slice(11, 19)}-03:00`;
  const xmlBase = buildNfeXml({
    invoiceNumber: invoice.number,
    series: invoice.series,
    emissionDateIso: emissionIso,
    operationNature: invoice.operationNature || context.operation?.operationNature || "Venda de mercadoria",
    type: invoice.type as "NFe" | "NFC-e",
    environment: invoice.environment as "homologacao" | "producao",
    company,
    client: context.client,
    items: context.saleItemsRows.map((item, index) => {
      const row = context.productRules.find((entry) => entry.product?.id === item.productId);
      const product = row?.product;
      const rule = row?.rule;
      return { line: index + 1, productCode: product?.code || item.productId, description: product?.name || `Produto ${index + 1}`, ncm: String(product?.ncm || ""), cfop: String(resolveItemCfop(rule, context.decision) || context.decision.cfop || ""), ean: product?.ean || null, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), totalPrice: Number(item.totalPrice || 0), taxOrigin: product?.taxOrigin || null, cstIcms: rule?.cstIcms || null, csosn: rule?.csosn || null, cstPis: rule?.cstPis || null, cstCofins: rule?.cstCofins || null, cstIpi: rule?.cstIpi || null, icmsRate: rule?.icmsRate != null ? Number(rule.icmsRate) : 0, pisRate: rule?.pisRate != null ? Number(rule.pisRate) : 0, cofinsRate: rule?.cofinsRate != null ? Number(rule.cofinsRate) : 0, ipiRate: rule?.ipiRate != null ? Number(rule.ipiRate) : 0 };
    }),
    totalAmount: Number(invoice.amount),
    paymentMethod: context.sale?.paymentMethod || null,
    additionalInfo: context.profile?.additionalInfo || null,
  });
  const signedXml = signXml(xmlBase.xml, certificate.certPem, certificate.keyPem);
  const config = resolveTransmissionConfig(company);
  await db.update(invoices).set({ xmlContent: xmlBase.xml, signedXmlContent: signedXml, accessKey: xmlBase.accessKey, status: "signed", fiscalStatus: "processing", sentAt: new Date(), sefazStatusCode: null, sefazStatusMessage: null, updatedAt: new Date() as any }).where(eq(invoices.id, invoice.id));
  const transmission = await transmitSignedNfe({ signedXml, accessKey: xmlBase.accessKey, modelCode: xmlBase.modelCode, config });
  const finalState = transmission.status === "authorized" ? "authorized" : transmission.status === "processing" ? "processing" : "rejected";
  const finalFiscal = transmission.status === "authorized" ? "ready" : transmission.status === "processing" ? "processing" : "error";
  const [updated] = await db.update(invoices).set({ status: finalState, fiscalStatus: finalFiscal, sefazReceipt: transmission.receipt, sefazProtocol: transmission.protocol, sefazStatusCode: transmission.statusCode, sefazStatusMessage: transmission.statusMessage, sefazResponseXml: transmission.responseXml, lastSefazSyncAt: new Date(), authorizedAt: transmission.status === "authorized" ? new Date() : null, updatedAt: new Date() as any }).where(eq(invoices.id, invoice.id)).returning();
  return { invoice: updated, transmission };
}

export const getFiscalOverview: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const { company, profile, operations, rules, allProducts, checks, configuredProducts } = await resolveFiscalContext(companyId);
    const rows = await db.select().from(invoices).where(eq(invoices.companyId, companyId)).orderBy(desc(invoices.emissionDate), desc(invoices.createdAt));
    const invoicesData = rows.map(serializeInvoice); const issueList = invoicesData.flatMap((invoice) => invoice.validationIssues || []);
    const salesRows = await db.select({ id: sales.id, clientId: sales.clientId, clientName: sales.clientName, total: sales.total, createdAt: sales.createdAt }).from(sales).where(eq(sales.companyId, companyId)).orderBy(desc(sales.createdAt));
    const invoicedSaleIds = new Set(rows.map((item) => item.saleId).filter(Boolean)); const saleIds = salesRows.map((sale) => sale.id); const items = saleIds.length ? await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds)) : [];
    const itemCountMap = items.reduce<Record<string, number>>((acc, item) => { acc[item.saleId] = (acc[item.saleId] || 0) + Number(item.quantity || 0); return acc; }, {});
    const pendingSales = salesRows.filter((sale) => !invoicedSaleIds.has(sale.id)).slice(0, 20).map((sale) => ({ id: sale.id, clientId: sale.clientId, clientName: sale.clientName, total: numberValue(sale.total), createdAt: String(sale.createdAt), itemsCount: itemCountMap[sale.id] || 0 }));
    const readinessScore = Math.round((checks.filter((item) => item.ok).length / checks.length) * 100);
    res.json({ company: { ...company, certificateEncrypted: undefined, hasFiscalCertificate: Boolean((company as any)?.certificateEncrypted) }, fiscalProfile: profile || null, checks, invoices: invoicesData, pendingSales, productRules: rules.map((rule) => ({ ...rule, icmsRate: rule.icmsRate != null ? numberValue(rule.icmsRate) : null, pisRate: rule.pisRate != null ? numberValue(rule.pisRate) : null, cofinsRate: rule.cofinsRate != null ? numberValue(rule.cofinsRate) : null, ipiRate: rule.ipiRate != null ? numberValue(rule.ipiRate) : null, isComplete: Boolean(rule.ncm && (rule.csosn || rule.cstIcms) && (rule.cfopInternal || rule.cfopConsumer || rule.cfopInterstate)) })), operationProfiles: operations, summary: { configuredProducts, totalProducts: allProducts.length, configuredOperations: operations.filter((item) => item.isActive).length, totalOperations: operations.length, readyDocuments: rows.filter((item) => item.status === "authorized").length, pendingDocuments: rows.filter((item) => item.status !== "authorized").length, readinessScore, warningCount: issueList.filter((i) => i.severity === "warning").length, errorCount: issueList.filter((i) => i.severity === "error").length, criticalCount: issueList.filter((i) => i.severity === "critical").length } });
  } catch (error) { console.error("Fiscal overview error", error); res.status(500).json({ error: "Falha ao carregar painel fiscal" }); }
};

export const upsertFiscalCompanyProfile: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const payload = { crtCode: req.body.crtCode || null, cnaePrimary: req.body.cnaePrimary || null, cnaeSecondary: req.body.cnaeSecondary || null, ieSubstitute: req.body.ieSubstitute || null, accountingEmail: req.body.accountingEmail || null, accountantName: req.body.accountantName || null, accountantPhone: req.body.accountantPhone || null, ibptVersion: req.body.ibptVersion || null, lastIbptSync: req.body.lastIbptSync || null, nfseEnvironment: req.body.nfseEnvironment || "homologacao", nfseMunicipalityCode: req.body.nfseMunicipalityCode || null, nfseSeries: req.body.nfseSeries || "1", defaultOperationProfileId: req.body.defaultOperationProfileId || null, additionalInfo: req.body.additionalInfo || null, decisionMode: "automatic", updatedAt: new Date() };
    const [existing] = await db.select().from(fiscalCompanyProfiles).where(eq(fiscalCompanyProfiles.companyId, companyId)).limit(1); const before = existing || null;
    const row = existing ? (await db.update(fiscalCompanyProfiles).set(payload).where(eq(fiscalCompanyProfiles.id, existing.id)).returning())[0] : (await db.insert(fiscalCompanyProfiles).values({ id: randomUUID(), companyId, ...payload }).returning())[0];
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "fiscal_company_profile", entityId: row.id, action: existing ? "update" : "create", description: existing ? "Perfil fiscal da empresa atualizado" : "Perfil fiscal da empresa criado", metadata: { before, after: row } });
    res.json(row);
  } catch (error) { console.error("Upsert fiscal profile error", error); res.status(500).json({ error: "Falha ao salvar perfil fiscal" }); }
};

export const uploadFiscalCertificate: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const pfxBase64 = String(req.body.pfxBase64 || "");
    const passphrase = String(req.body.passphrase || "");
    const alias = String(req.body.alias || "Certificado A1");
    if (!pfxBase64 || !passphrase) return res.status(400).json({ error: "Arquivo PFX em base64 e senha são obrigatórios" });
    await validatePfxWithOpenSsl(pfxBase64, passphrase);
    const encrypted = encryptFiscalPayload({ pfxBase64, passphrase, alias });
    const bundle = loadCertificateFromEncrypted(encrypted);
    const [updated] = await db.update(companySettings).set({ certificateAlias: alias, certificateEncrypted: encrypted, certificateUpdatedAt: new Date(), certificateSubject: bundle.subject, certificateExpiresAt: new Date(bundle.expiresAt), updatedAt: new Date() } as any).where(eq(companySettings.id, companyId)).returning();
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "fiscal_certificate", entityId: companyId, action: "upload", description: "Certificado digital A1 atualizado", metadata: { alias, subject: bundle.subject, expiresAt: bundle.expiresAt } });
    res.json({ ok: true, alias: updated.certificateAlias, subject: (updated as any).certificateSubject, expiresAt: (updated as any).certificateExpiresAt });
  } catch (error) { console.error("Upload fiscal certificate error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao salvar certificado fiscal" }); }
};

export const getFiscalCertificateStatus: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const [company] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
    if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
    res.json({ hasCertificate: Boolean((company as any).certificateEncrypted), alias: company.certificateAlias, subject: (company as any).certificateSubject || null, updatedAt: (company as any).certificateUpdatedAt || null, expiresAt: (company as any).certificateExpiresAt || null });
  } catch (error) { console.error("Get fiscal certificate status error", error); res.status(500).json({ error: "Falha ao consultar certificado fiscal" }); }
};

export const listFiscalProductRules: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const rules = await db.select({ id: fiscalProductRules.id, productId: fiscalProductRules.productId, productName: products.name, productCode: products.code, ncm: products.ncm, cest: products.cest, taxOrigin: products.taxOrigin, cfopInternal: fiscalProductRules.cfopInternal, cfopInterstate: fiscalProductRules.cfopInterstate, cfopConsumer: fiscalProductRules.cfopConsumer, cstIcms: fiscalProductRules.cstIcms, csosn: fiscalProductRules.csosn, cstPis: fiscalProductRules.cstPis, cstCofins: fiscalProductRules.cstCofins, cstIpi: fiscalProductRules.cstIpi, icmsRate: fiscalProductRules.icmsRate, pisRate: fiscalProductRules.pisRate, cofinsRate: fiscalProductRules.cofinsRate, ipiRate: fiscalProductRules.ipiRate, benefitCode: fiscalProductRules.benefitCode, serviceCode: fiscalProductRules.serviceCode, ibptCode: fiscalProductRules.ibptCode, notes: fiscalProductRules.notes, validFrom: fiscalProductRules.validFrom, validTo: fiscalProductRules.validTo, ruleVersion: fiscalProductRules.ruleVersion, updatedAt: fiscalProductRules.updatedAt }).from(products).leftJoin(fiscalProductRules, and(eq(fiscalProductRules.productId, products.id), eq(fiscalProductRules.companyId, companyId))).where(eq(products.companyId, companyId)).orderBy(products.name);
    res.json(rules.map((rule) => ({ ...rule, icmsRate: rule.icmsRate != null ? numberValue(rule.icmsRate) : null, pisRate: rule.pisRate != null ? numberValue(rule.pisRate) : null, cofinsRate: rule.cofinsRate != null ? numberValue(rule.cofinsRate) : null, ipiRate: rule.ipiRate != null ? numberValue(rule.ipiRate) : null, isComplete: Boolean(rule.ncm && (rule.csosn || rule.cstIcms) && (rule.cfopInternal || rule.cfopConsumer || rule.cfopInterstate)) })));
  } catch (error) { console.error("List fiscal product rules error", error); res.status(500).json({ error: "Falha ao listar regras fiscais" }); }
};

export const upsertFiscalProductRule: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const productId = String(req.params.productId || req.body.productId || ""); if (!productId) return res.status(400).json({ error: "Produto é obrigatório" });
    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.companyId, companyId))).limit(1); if (!product) return res.status(404).json({ error: "Produto não encontrado" });
    const validFrom = req.body.validFrom || null; const validTo = req.body.validTo || null; validateRuleWindow({ validFrom, validTo });
    const [existing] = await db.select().from(fiscalProductRules).where(and(eq(fiscalProductRules.productId, productId), eq(fiscalProductRules.companyId, companyId))).limit(1);
    if (req.body.ncm !== undefined || req.body.cest !== undefined || req.body.taxOrigin !== undefined) await db.update(products).set({ ncm: req.body.ncm ?? product.ncm, cest: req.body.cest ?? product.cest, taxOrigin: req.body.taxOrigin ?? product.taxOrigin, updatedAt: new Date() }).where(eq(products.id, productId));
    const payload = { cfopInternal: req.body.cfopInternal || null, cfopInterstate: req.body.cfopInterstate || null, cfopConsumer: req.body.cfopConsumer || null, cstIcms: req.body.cstIcms || null, csosn: req.body.csosn || null, cstPis: req.body.cstPis || null, cstCofins: req.body.cstCofins || null, cstIpi: req.body.cstIpi || null, icmsRate: req.body.icmsRate != null ? String(req.body.icmsRate) : null, pisRate: req.body.pisRate != null ? String(req.body.pisRate) : null, cofinsRate: req.body.cofinsRate != null ? String(req.body.cofinsRate) : null, ipiRate: req.body.ipiRate != null ? String(req.body.ipiRate) : null, benefitCode: req.body.benefitCode || null, serviceCode: req.body.serviceCode || null, ibptCode: req.body.ibptCode || null, notes: req.body.notes || null, validFrom, validTo, ruleVersion: existing ? Number(existing.ruleVersion || 0) + 1 : 1, updatedAt: new Date() };
    const row = existing ? (await db.update(fiscalProductRules).set(payload).where(eq(fiscalProductRules.id, existing.id)).returning())[0] : (await db.insert(fiscalProductRules).values({ id: randomUUID(), companyId, productId, ...payload }).returning())[0];
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "fiscal_product_rule", entityId: row.id, action: existing ? "update" : "create", description: `Regra fiscal do produto ${product.name} ${existing ? "atualizada" : "criada"}`, metadata: { before: existing || null, after: row, productId } });
    res.json(row);
  } catch (error) { console.error("Upsert fiscal product rule error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao salvar regra fiscal do produto" }); }
};

export const listFiscalOperationProfiles: RequestHandler = async (req, res) => {
  try { await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const rows = await db.select().from(fiscalOperationProfiles).where(eq(fiscalOperationProfiles.companyId, companyId)).orderBy(fiscalOperationProfiles.priority, desc(fiscalOperationProfiles.isDefault), fiscalOperationProfiles.name); res.json(rows); } catch (error) { console.error("List fiscal operation profiles error", error); res.status(500).json({ error: "Falha ao listar perfis de operação fiscal" }); }
};

export const upsertFiscalOperationProfile: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const id = req.params.id ? String(req.params.id) : undefined;
    const validFrom = req.body.validFrom || null; const validTo = req.body.validTo || null; validateRuleWindow({ validFrom, validTo });
    const existing = id ? (await db.select().from(fiscalOperationProfiles).where(and(eq(fiscalOperationProfiles.id, id), eq(fiscalOperationProfiles.companyId, companyId))).limit(1))[0] : null;
    const payload = { companyId, name: String(req.body.name || "Perfil fiscal"), documentModel: String(req.body.documentModel || "NFC-e"), direction: String(req.body.direction || "saida"), destination: String(req.body.destination || "interna"), finalConsumer: req.body.finalConsumer !== false, taxpayerType: String(req.body.taxpayerType || "nao_contribuinte"), purpose: String(req.body.purpose || "normal"), presenca: String(req.body.presenca || "1"), cfop: String(req.body.cfop || "5102"), operationNature: String(req.body.operationNature || "Venda de mercadoria"), validFrom, validTo, priority: Number(req.body.priority || existing?.priority || 100), isDefault: Boolean(req.body.isDefault), isActive: req.body.isActive !== false, updatedAt: new Date() };
    if (payload.isDefault) await db.update(fiscalOperationProfiles).set({ isDefault: false, updatedAt: new Date() }).where(eq(fiscalOperationProfiles.companyId, companyId));
    const row = existing ? (await db.update(fiscalOperationProfiles).set(payload).where(eq(fiscalOperationProfiles.id, existing.id)).returning())[0] : (await db.insert(fiscalOperationProfiles).values({ id: randomUUID(), ...payload }).returning())[0];
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "fiscal_operation_profile", entityId: row.id, action: existing ? "update" : "create", description: `Perfil de operação fiscal ${existing ? "atualizado" : "criado"}`, metadata: { before: existing || null, after: row } });
    res.json(row);
  } catch (error) { console.error("Upsert fiscal operation profile error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao salvar perfil de operação" }); }
};

export const emitInvoice: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return;
    const { saleId, clientId, number, type = "NFC-e", clientName, amount, operationNature, operationProfileId, transmitNow = true } = req.body;
    if (amount === undefined) return res.status(400).json({ error: "Valor da nota é obrigatório" });
    if (!["NFe", "NFC-e", "NFS-e"].includes(type)) return res.status(400).json({ error: "Tipo de documento inválido" });
    if (type === "NFS-e") return res.status(400).json({ error: "Integração automática implementada nesta rodada cobre NF-e/NFC-e; NFS-e depende do município." });
    const context = await resolveEmissionData({ companyId, saleId, clientId, type, operationProfileId });
    const summary = summarizeIssues(context.issues); const emissionDate = new Date().toISOString().slice(0, 10); const reservedNumber = number ? String(number) : await reserveNextInvoiceNumber(companyId); const series = String(context.company?.invoiceSeries || "1");
    const nature = operationNature || context.operation?.operationNature || "Venda de mercadoria"; const environment = String(context.company?.taxEnvironment || "homologacao");
    const lifecycleStatus = summary.blocking ? "pending" : "validated"; const fiscalStatus = summary.criticalCount > 0 ? "critical" : summary.errorCount > 0 ? "error" : summary.warningCount > 0 ? "warning" : "ready";
    const [invoice] = await db.insert(invoices).values({ id: randomUUID(), companyId, saleId: saleId || null, clientId: context.client?.id || null, number: reservedNumber, series, type: String(type), clientName: context.client?.name || (clientName ? String(clientName) : "Consumidor Final"), operationNature: nature, amount: Number(amount).toFixed(2), status: lifecycleStatus, fiscalStatus, environment, emissionDate, accessKey: null, xmlContent: null, signedXmlContent: null, validationMessagesJson: JSON.stringify(context.issues.map((i) => i.message)), validationIssuesJson: JSON.stringify(context.issues), fiscalDecisionJson: JSON.stringify(context.decision), sentAt: null, authorizedAt: null, canceledAt: null, sefazReceipt: null, sefazProtocol: null, sefazStatusCode: null, sefazStatusMessage: null, sefazResponseXml: null, lastSefazSyncAt: null } as any).returning();
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "invoice", entityId: invoice.id, action: "create", description: `Documento fiscal ${invoice.number} criado com status ${lifecycleStatus}`, metadata: { issues: context.issues, decision: context.decision } });
    if (summary.blocking || transmitNow === false) return res.status(summary.blocking ? 422 : 201).json({ ...serializeInvoice(invoice), error: summary.blocking ? "Emissão bloqueada por validação fiscal." : undefined });
    const transmitted = await signAndTransmitInvoice(invoice, context);
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "invoice", entityId: invoice.id, action: "transmit", description: `Documento fiscal ${invoice.number} transmitido para SEFAZ`, metadata: { sefazStatusCode: transmitted.transmission.statusCode, sefazStatusMessage: transmitted.transmission.statusMessage, receipt: transmitted.transmission.receipt, protocol: transmitted.transmission.protocol } });
    res.status(201).json(serializeInvoice(transmitted.invoice));
  } catch (error) { console.error("Emit invoice error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao emitir documento fiscal" }); }
};

export const transmitInvoiceById: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const id = String(req.params.id);
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" });
    if (!invoice.saleId) return res.status(400).json({ error: "Somente notas ligadas a uma venda podem ser transmitidas automaticamente" });
    if (invoice.type === "NFS-e") return res.status(400).json({ error: "NFS-e depende de integração municipal específica" });
    const context = await resolveEmissionData({ companyId, saleId: invoice.saleId, clientId: invoice.clientId, type: invoice.type, operationProfileId: null });
    const summary = summarizeIssues(context.issues); if (summary.blocking) return res.status(422).json({ error: "Ainda existem pendências fiscais bloqueantes para transmitir essa nota", issues: context.issues });
    const transmitted = await signAndTransmitInvoice(invoice, context);
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "invoice", entityId: invoice.id, action: "transmit", description: `Documento fiscal ${invoice.number} retransmitido para SEFAZ`, metadata: { sefazStatusCode: transmitted.transmission.statusCode, sefazStatusMessage: transmitted.transmission.statusMessage } });
    res.json(serializeInvoice(transmitted.invoice));
  } catch (error) { console.error("Transmit invoice by id error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao transmitir documento fiscal" }); }
};

export const syncInvoiceStatus: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const id = String(req.params.id);
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" });
    if (!(invoice as any).sefazReceipt) return res.status(400).json({ error: "A nota ainda não possui recibo para consulta" });
    const [company] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1); if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
    const config = resolveTransmissionConfig(company as any);
    const result = await queryNfeReceipt({ receipt: String((invoice as any).sefazReceipt), config });
    const [updated] = await db.update(invoices).set({ status: result.status === "authorized" ? "authorized" : result.status === "processing" ? "processing" : "rejected", fiscalStatus: result.status === "authorized" ? "ready" : result.status === "processing" ? "processing" : "error", sefazProtocol: result.protocol, sefazStatusCode: result.statusCode, sefazStatusMessage: result.statusMessage, sefazResponseXml: result.responseXml, lastSefazSyncAt: new Date(), authorizedAt: result.status === "authorized" ? new Date() : invoice.authorizedAt, updatedAt: new Date() as any }).where(eq(invoices.id, id)).returning();
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "invoice", entityId: id, action: "sync", description: `Status SEFAZ sincronizado para nota ${invoice.number}`, metadata: { statusCode: result.statusCode, statusMessage: result.statusMessage, protocol: result.protocol } });
    res.json(serializeInvoice(updated));
  } catch (error) { console.error("Sync invoice status error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao sincronizar documento fiscal" }); }
};

export const reprocessInvoice: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const id = String(req.params.id);
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" });
    if (!invoice.saleId) return res.status(400).json({ error: "Somente notas ligadas a venda podem ser reprocessadas" });
    const result = await resolveEmissionData({ companyId, saleId: invoice.saleId, clientId: invoice.clientId, type: invoice.type, operationProfileId: null }); const summary = summarizeIssues(result.issues);
    const [updated] = await db.update(invoices).set({ status: summary.blocking ? "pending" : "validated", fiscalStatus: summary.criticalCount > 0 ? "critical" : summary.errorCount > 0 ? "error" : summary.warningCount > 0 ? "warning" : "ready", validationMessagesJson: JSON.stringify(result.issues.map((i) => i.message)), validationIssuesJson: JSON.stringify(result.issues), fiscalDecisionJson: JSON.stringify(result.decision), updatedAt: new Date() as any }).where(eq(invoices.id, id)).returning();
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "invoice", entityId: id, action: "reprocess", description: `Documento fiscal ${invoice.number} reprocessado`, metadata: { issues: result.issues, decision: result.decision } });
    res.json(serializeInvoice(updated));
  } catch (error) { console.error("Reprocess invoice error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao reprocessar documento fiscal" }); }
};

export const cancelInvoice: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const id = String(req.params.id);
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" });
    const [updated] = await db.update(invoices).set({ status: "cancelled", fiscalStatus: "cancelled", canceledAt: new Date(), updatedAt: new Date() as any }).where(eq(invoices.id, id)).returning();
    await logAudit({ companyId, userId: req.user?.id || null, entityType: "invoice", entityId: id, action: "cancel", description: `Documento fiscal ${invoice.number} cancelado`, metadata: { before: invoice, after: updated } });
    res.json(serializeInvoice(updated));
  } catch (error) { console.error("Cancel invoice error", error); res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao cancelar documento fiscal" }); }
};

export const listInvoices: RequestHandler = async (req, res) => {
  try { await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const { startDate, endDate } = req.query; const filters: any[] = [eq(invoices.companyId, companyId)]; if (startDate) filters.push(gte(invoices.emissionDate, String(startDate))); if (endDate) filters.push(lte(invoices.emissionDate, String(endDate))); const rows = await db.select().from(invoices).where(and(...filters)).orderBy(desc(invoices.emissionDate), desc(invoices.createdAt)); res.json(rows.map(serializeInvoice)); } catch (error) { console.error("List invoices error", error); res.status(500).json({ error: "Falha ao listar documentos fiscais" }); }
};
export const getInvoiceById: RequestHandler = async (req, res) => { try { await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const { id } = req.params; const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, String(id)), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" }); res.json(serializeInvoice(invoice)); } catch (error) { console.error("Get invoice error", error); res.status(500).json({ error: "Falha ao obter documento fiscal" }); } };
export const downloadInvoicePDF: RequestHandler = async (req, res) => { try { await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const { id } = req.params; const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, String(id)), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" }); const pdfBuffer = buildSimpleInvoicePdf(serializeInvoice(invoice)); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="nota_${invoice.number}.pdf"`); res.send(pdfBuffer); } catch (error) { console.error("Download invoice PDF error", error); res.status(500).json({ error: "Falha ao baixar PDF" }); } };
export const downloadInvoiceXML: RequestHandler = async (req, res) => { try { await ensureEnterpriseInfrastructure(); const companyId = requireTenantCompanyId(req, res); if (!companyId) return; const { id } = req.params; const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, String(id)), eq(invoices.companyId, companyId))).limit(1); if (!invoice) return res.status(404).json({ error: "Documento fiscal não encontrado" }); res.setHeader("Content-Type", "application/xml"); res.setHeader("Content-Disposition", `attachment; filename="invoice_${invoice.number}.xml"`); res.send((invoice as any).signedXmlContent || invoice.xmlContent || "<xml />"); } catch (error) { console.error("Download invoice XML error", error); res.status(500).json({ error: "Falha ao baixar XML" }); } };
