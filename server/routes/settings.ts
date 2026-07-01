import { RequestHandler } from "express";
import { db, queryClient } from "../db";
import { companySettings, labelSettings, printLogs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";

let labelInfraReady = false;

async function ensureLabelInfrastructure() {
  if (labelInfraReady) return;
  await ensureEnterpriseInfrastructure();

  await queryClient.unsafe(`
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "block_sale_without_stock" boolean DEFAULT true NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "auto_invoice_on_sale" boolean DEFAULT false NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_seller_name" text;

    CREATE TABLE IF NOT EXISTS "label_settings" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text,
      "template_name" text DEFAULT 'Etiqueta Principal - Vendas' NOT NULL,
      "notes" text,
      "paper_type" text DEFAULT 'personalizado' NOT NULL,
      "layout_config_json" text,
      "paper_height_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL,
      "paper_width_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL,
      "margin_top_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL,
      "margin_bottom_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL,
      "margin_left_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL,
      "margin_right_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL,
      "label_height_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL,
      "label_width_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL,
      "columns_count" integer DEFAULT 1 NOT NULL,
      "column_spacing_cm" numeric(6, 2) DEFAULT '0.00' NOT NULL,
      "row_spacing_cm" numeric(6, 2) DEFAULT '0.10' NOT NULL,
      "barcode_format" text DEFAULT 'CODE128' NOT NULL,
      "barcode_scale" integer DEFAULT 2 NOT NULL,
      "show_product_name" boolean DEFAULT true NOT NULL,
      "show_size" boolean DEFAULT true NOT NULL,
      "show_sku" boolean DEFAULT true NOT NULL,
      "show_barcode" boolean DEFAULT true NOT NULL,
      "mostrar_preco_cheio" boolean DEFAULT true NOT NULL,
      "mostrar_parcelado" boolean DEFAULT false NOT NULL,
      "parcelas" integer DEFAULT 1 NOT NULL,
      "is_default" boolean DEFAULT true NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "template_name" text DEFAULT 'Etiqueta Principal - Vendas' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "notes" text;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "paper_type" text DEFAULT 'personalizado' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "layout_config_json" text;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "paper_height_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "paper_width_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "margin_top_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "margin_bottom_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "margin_left_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "margin_right_cm" numeric(6, 2) DEFAULT '0.50' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "label_height_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "label_width_cm" numeric(6, 2) DEFAULT '4.00' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "columns_count" integer DEFAULT 1 NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "column_spacing_cm" numeric(6, 2) DEFAULT '0.00' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "row_spacing_cm" numeric(6, 2) DEFAULT '0.10' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "barcode_format" text DEFAULT 'CODE128' NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "barcode_scale" integer DEFAULT 2 NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "show_product_name" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "show_size" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "show_sku" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "show_barcode" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "mostrar_preco_cheio" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "mostrar_parcelado" boolean DEFAULT false NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "parcelas" integer DEFAULT 1 NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
    ALTER TABLE "label_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

    CREATE INDEX IF NOT EXISTS "label_settings_company_idx" ON "label_settings" USING btree ("company_id");

    CREATE TABLE IF NOT EXISTS "print_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "product_id" text,
      "sku" text NOT NULL,
      "quantidade" integer NOT NULL,
      "printed_at" timestamp with time zone DEFAULT now() NOT NULL,
      "user_id" text
    );

    CREATE INDEX IF NOT EXISTS "print_logs_sku_idx" ON "print_logs" USING btree ("sku");
    CREATE INDEX IF NOT EXISTS "print_logs_printed_at_idx" ON "print_logs" USING btree ("printed_at");
  `);

  labelInfraReady = true;
}

const defaultLabelSettings = {
  companyId: null,
  templateName: "Etiqueta Principal - Vendas",
  notes: "",
  layoutConfigJson: JSON.stringify({
    header: { offsetCm: 0, fontSizePx: 7, lineHeightPx: 9, fontWeight: 600, fontFamily: "Arial" },
    product: { offsetCm: 0.02, fontSizePx: 9, lineHeightPx: 11, fontWeight: 700, fontFamily: "Arial" },
    size: { offsetCm: 0.02, fontSizePx: 8, lineHeightPx: 9, fontWeight: 600, fontFamily: "Arial" },
    price: { offsetCm: 0.02, fontSizePx: 12, lineHeightPx: 14, fontWeight: 700, fontFamily: "Arial" },
    barcode: { offsetCm: 0.02, fontSizePx: 8, lineHeightPx: 8, fontWeight: 600, fontFamily: "Arial" },
    sku: { offsetCm: 0.02, fontSizePx: 7, lineHeightPx: 8, fontWeight: 600, fontFamily: "Arial" },
  }),
  paperType: "termico",
  paperHeightCm: "4.00",
  paperWidthCm: "4.00",
  marginTopCm: "0.20",
  marginBottomCm: "0.20",
  marginLeftCm: "0.20",
  marginRightCm: "0.20",
  labelHeightCm: "4.00",
  labelWidthCm: "4.00",
  columnsCount: 1,
  columnSpacingCm: "0.00",
  rowSpacingCm: "0.08",
  barcodeFormat: "CODE128",
  barcodeScale: 1,
  showProductName: true,
  showSize: true,
  showSku: true,
  showBarcode: true,
  mostrarPrecoCheio: true,
  mostrarParcelado: false,
  parcelas: 1,
  isDefault: true,
  isActive: true,
} as const;

function decimal(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : fallback.toFixed(2);
}

function integerValue(value: unknown, fallback: number, min = 0) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function mapLabelSettingsRow(row: any) {
  let elementLayouts = undefined;
  try {
    elementLayouts = row.layoutConfigJson ? JSON.parse(row.layoutConfigJson) : undefined;
  } catch {
    elementLayouts = undefined;
  }

  return {
    ...row,
    elementLayouts,
    paperHeightCm: Number(row.paperHeightCm),
    paperWidthCm: Number(row.paperWidthCm),
    marginTopCm: Number(row.marginTopCm),
    marginBottomCm: Number(row.marginBottomCm),
    marginLeftCm: Number(row.marginLeftCm),
    marginRightCm: Number(row.marginRightCm),
    labelHeightCm: Number(row.labelHeightCm),
    labelWidthCm: Number(row.labelWidthCm),
    columnSpacingCm: Number(row.columnSpacingCm),
    rowSpacingCm: Number(row.rowSpacingCm),
    columnsCount: Number(row.columnsCount),
    barcodeScale: Number(row.barcodeScale),
    parcelas: Number(row.parcelas),
  };
}

export const getCompanySettings: RequestHandler = async (req, res) => {
  try {
    await ensureLabelInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const [settings] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
    if (!settings) {
      return res.status(404).json({ error: "Configurações não encontradas" });
    }
    res.json({ ...settings, certificateEncrypted: undefined, hasFiscalCertificate: Boolean((settings as any).certificateEncrypted) });
  } catch (error) {
    console.error("Get company settings error", error);
    res.status(500).json({ error: "Falha ao carregar configurações" });
  }
};

export const updateCompanySettings: RequestHandler = async (req, res) => {
  try {
    await ensureLabelInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const [existing] = await db.select().from(companySettings).where(eq(companySettings.id, companyId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Configurações não encontradas" });
    }

    const [updated] = await db
      .update(companySettings)
      .set({
        legalName: req.body.legalName ?? existing.legalName,
        tradeName: req.body.tradeName ?? existing.tradeName,
        tenantCode: req.body.tenantCode ?? existing.tenantCode,
        tenantStatus: req.body.tenantStatus ?? existing.tenantStatus,
        cnpj: req.body.cnpj ?? existing.cnpj,
        stateRegistration: req.body.stateRegistration ?? existing.stateRegistration,
        municipalRegistration: req.body.municipalRegistration ?? existing.municipalRegistration,
        taxRegime: req.body.taxRegime ?? existing.taxRegime,
        taxEnvironment: req.body.taxEnvironment ?? existing.taxEnvironment,
        fiscalApiProvider: req.body.fiscalApiProvider ?? existing.fiscalApiProvider,
        fiscalApiToken: req.body.fiscalApiToken ?? existing.fiscalApiToken,
        certificateAlias: req.body.certificateAlias ?? existing.certificateAlias,
        taxAuthorityCode: req.body.taxAuthorityCode ?? (existing as any).taxAuthorityCode,
        sefazAuthorizationUrl: req.body.sefazAuthorizationUrl ?? (existing as any).sefazAuthorizationUrl,
        sefazReturnUrl: req.body.sefazReturnUrl ?? (existing as any).sefazReturnUrl,
        sefazStatusUrl: req.body.sefazStatusUrl ?? (existing as any).sefazStatusUrl,
        addressCityCode: req.body.addressCityCode ?? (existing as any).addressCityCode,
        cscId: req.body.cscId ?? existing.cscId,
        cscCode: req.body.cscCode ?? existing.cscCode,
        invoiceSeries: req.body.invoiceSeries ?? existing.invoiceSeries,
        nextInvoiceNumber: req.body.nextInvoiceNumber ?? existing.nextInvoiceNumber,
        cashbackEnabled: req.body.cashbackEnabled ?? existing.cashbackEnabled,
        cashbackPercent: req.body.cashbackPercent ?? existing.cashbackPercent,
        cashbackExpiryDays: req.body.cashbackExpiryDays ?? existing.cashbackExpiryDays,
        email: req.body.email ?? existing.email,
        phone: req.body.phone ?? existing.phone,
        addressZipcode: req.body.addressZipcode ?? existing.addressZipcode,
        addressStreet: req.body.addressStreet ?? existing.addressStreet,
        addressNumber: req.body.addressNumber ?? existing.addressNumber,
        addressComplement: req.body.addressComplement ?? existing.addressComplement,
        addressNeighborhood: req.body.addressNeighborhood ?? existing.addressNeighborhood,
        addressCity: req.body.addressCity ?? existing.addressCity,
        addressState: req.body.addressState ?? existing.addressState,
        blockSaleWithoutStock: req.body.blockSaleWithoutStock ?? existing.blockSaleWithoutStock,
        autoInvoiceOnSale: req.body.autoInvoiceOnSale ?? existing.autoInvoiceOnSale,
        defaultSellerName: req.body.defaultSellerName ?? existing.defaultSellerName,
        updatedAt: new Date(),
      })
      .where(eq(companySettings.id, companyId))
      .returning();

    res.json({ ...updated, certificateEncrypted: undefined, hasFiscalCertificate: Boolean((updated as any).certificateEncrypted) });
  } catch (error) {
    console.error("Update company settings error", error);
    res.status(500).json({ error: "Falha ao salvar configurações" });
  }
};

export const getLabelSettings: RequestHandler = async (req, res) => {
  try {
    await ensureLabelInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const [settings] = await db.select().from(labelSettings).where(eq(labelSettings.companyId, companyId)).limit(1);
    if (!settings) {
      const [created] = await db
        .insert(labelSettings)
        .values({
          id: randomUUID(),
          ...defaultLabelSettings,
          companyId,
        })
        .returning();
      return res.json(mapLabelSettingsRow(created));
    }
    res.json(mapLabelSettingsRow(settings));
  } catch (error) {
    console.error("Get label settings error", error);
    res.status(500).json({ error: "Falha ao carregar configurações de etiqueta" });
  }
};

export const saveLabelSettings: RequestHandler = async (req, res) => {
  try {
    await ensureLabelInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;
    const [existing] = await db.select().from(labelSettings).where(eq(labelSettings.companyId, companyId)).limit(1);

    const payload = {
      companyId,
      templateName: String(req.body.templateName ?? existing?.templateName ?? defaultLabelSettings.templateName).trim() || defaultLabelSettings.templateName,
      notes: String(req.body.notes ?? existing?.notes ?? defaultLabelSettings.notes),
      layoutConfigJson: JSON.stringify(req.body.elementLayouts ?? (() => { try { return existing?.layoutConfigJson ? JSON.parse(String(existing.layoutConfigJson)) : JSON.parse(defaultLabelSettings.layoutConfigJson); } catch { return JSON.parse(defaultLabelSettings.layoutConfigJson); } })()),
      paperType: String(req.body.paperType ?? existing?.paperType ?? defaultLabelSettings.paperType),
      paperHeightCm: decimal(req.body.paperHeightCm, Number(existing?.paperHeightCm ?? defaultLabelSettings.paperHeightCm)),
      paperWidthCm: decimal(req.body.paperWidthCm, Number(existing?.paperWidthCm ?? defaultLabelSettings.paperWidthCm)),
      marginTopCm: decimal(req.body.marginTopCm, Number(existing?.marginTopCm ?? defaultLabelSettings.marginTopCm)),
      marginBottomCm: decimal(req.body.marginBottomCm, Number(existing?.marginBottomCm ?? defaultLabelSettings.marginBottomCm)),
      marginLeftCm: decimal(req.body.marginLeftCm, Number(existing?.marginLeftCm ?? defaultLabelSettings.marginLeftCm)),
      marginRightCm: decimal(req.body.marginRightCm, Number(existing?.marginRightCm ?? defaultLabelSettings.marginRightCm)),
      labelHeightCm: decimal(req.body.labelHeightCm, Number(existing?.labelHeightCm ?? defaultLabelSettings.labelHeightCm)),
      labelWidthCm: decimal(req.body.labelWidthCm, Number(existing?.labelWidthCm ?? defaultLabelSettings.labelWidthCm)),
      columnsCount: integerValue(req.body.columnsCount, Number(existing?.columnsCount ?? defaultLabelSettings.columnsCount), 1),
      columnSpacingCm: decimal(req.body.columnSpacingCm, Number(existing?.columnSpacingCm ?? defaultLabelSettings.columnSpacingCm)),
      rowSpacingCm: decimal(req.body.rowSpacingCm, Number(existing?.rowSpacingCm ?? defaultLabelSettings.rowSpacingCm)),
      barcodeFormat: String(req.body.barcodeFormat ?? existing?.barcodeFormat ?? defaultLabelSettings.barcodeFormat),
      barcodeScale: integerValue(req.body.barcodeScale, Number(existing?.barcodeScale ?? defaultLabelSettings.barcodeScale), 1),
      showProductName: booleanValue(req.body.showProductName, existing?.showProductName ?? defaultLabelSettings.showProductName),
      showSize: booleanValue(req.body.showSize, existing?.showSize ?? defaultLabelSettings.showSize),
      showSku: booleanValue(req.body.showSku, existing?.showSku ?? defaultLabelSettings.showSku),
      showBarcode: booleanValue(req.body.showBarcode, existing?.showBarcode ?? defaultLabelSettings.showBarcode),
      mostrarPrecoCheio: booleanValue(req.body.mostrarPrecoCheio, existing?.mostrarPrecoCheio ?? defaultLabelSettings.mostrarPrecoCheio),
      mostrarParcelado: booleanValue(req.body.mostrarParcelado, existing?.mostrarParcelado ?? defaultLabelSettings.mostrarParcelado),
      parcelas: integerValue(req.body.parcelas, Number(existing?.parcelas ?? defaultLabelSettings.parcelas), 1),
      isDefault: booleanValue(req.body.isDefault, existing?.isDefault ?? defaultLabelSettings.isDefault),
      isActive: booleanValue(req.body.isActive, existing?.isActive ?? defaultLabelSettings.isActive),
      updatedAt: new Date(),
    };

    if (!existing) {
      const [created] = await db.insert(labelSettings).values({ id: randomUUID(), ...payload }).returning();
      return res.json(mapLabelSettingsRow(created));
    }

    const [updated] = await db.update(labelSettings).set(payload).where(eq(labelSettings.id, existing.id)).returning();
    res.json(mapLabelSettingsRow(updated));
  } catch (error) {
    console.error("Save label settings error", error);
    res.status(500).json({ error: "Falha ao salvar configurações de etiqueta" });
  }
};

export const printLabelTest: RequestHandler = async (req, res) => {
  try {
    await ensureLabelInfrastructure();
    const labels = Array.isArray(req.body?.labels) ? req.body.labels : [];
    if (labels.length === 0) {
      return res.status(400).json({ error: "Nenhum produto selecionado para impressão" });
    }

    const logs = labels.flatMap((item: any) => {
      const qty = Math.max(1, Number(item.qty || 1));
      return Array.from({ length: qty }).map(() => ({
        id: randomUUID(),
        productId: item.productId || null,
        sku: String(item.sku || ""),
        quantidade: 1,
        userId: req.user?.id || null,
      }));
    });

    await db.insert(printLogs).values(logs);

    res.json({
      ok: true,
      mode: "preview-browser",
      labels: logs.length,
      message: "Teste de impressão registrado e pronto para conferência no preview.",
    });
  } catch (error) {
    console.error("Print label test error", error);
    res.status(500).json({ error: "Falha ao processar teste de impressão" });
  }
};
