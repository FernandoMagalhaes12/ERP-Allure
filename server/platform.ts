import { randomUUID } from "node:crypto";
import { queryClient } from "./db";
import { hashPassword } from "./auth";
import { ACCOUNTANT_DEFAULT_PERMISSIONS, SELLER_DEFAULT_PERMISSIONS } from "./permissions";

let infraReady = false;
let infraPromise: Promise<void> | null = null;

async function ensureDefaultAccountant(companyId: string) {
  const accountantEmail = "contador@completefitness.com.br";
  const existing = await queryClient<{ id: string }[]>`select id from users where email = ${accountantEmail} limit 1`;
  if (existing[0]?.id) return;

  await queryClient`
    insert into users (id, company_id, name, email, password_hash, role, permissions_json, is_active, created_at, updated_at)
    values (
      ${randomUUID()},
      ${companyId},
      'Contador',
      ${accountantEmail},
      ${await hashPassword("password123")},
      'contador',
      ${JSON.stringify(ACCOUNTANT_DEFAULT_PERMISSIONS)},
      true,
      now(),
      now()
    )
  `;
}

async function ensureDefaultFiscalStructures(companyId: string) {
  const fiscalProfileRows = await queryClient<{ id: string }[]>`select id from fiscal_company_profiles where company_id = ${companyId} limit 1`;
  if (!fiscalProfileRows[0]?.id) {
    await queryClient`
      insert into fiscal_company_profiles (
        id, company_id, crt_code, nfse_environment, nfse_series, additional_info, created_at, updated_at
      ) values (
        ${randomUUID()}, ${companyId}, '1', 'homologacao', '1',
        'Estrutura fiscal preparada para preenchimento do contador e ativação real.', now(), now()
      )
    `;
  }

  const operationRows = await queryClient<{ id: string }[]>`select id from fiscal_operation_profiles where company_id = ${companyId} limit 1`;
  if (!operationRows[0]?.id) {
    await queryClient.unsafe(`
      insert into fiscal_operation_profiles (
        id, company_id, name, document_model, direction, destination, final_consumer,
        taxpayer_type, purpose, presenca, cfop, operation_nature, is_default, is_active, created_at, updated_at
      ) values
      ('${randomUUID()}', '${companyId}', 'Venda varejo consumidor final', 'NFC-e', 'saida', 'interna', true, 'nao_contribuinte', 'normal', '1', '5102', 'Venda de mercadoria', true, true, now(), now()),
      ('${randomUUID()}', '${companyId}', 'Venda interestadual consumidor final', 'NFe', 'saida', 'interestadual', true, 'nao_contribuinte', 'normal', '2', '6108', 'Venda interestadual para consumidor final', false, true, now(), now()),
      ('${randomUUID()}', '${companyId}', 'Venda para contribuinte ICMS', 'NFe', 'saida', 'interna', false, 'contribuinte_icms', 'normal', '1', '5102', 'Venda de mercadoria para contribuinte', false, true, now(), now())
    `);
  }
}

async function runEnterpriseInfrastructureSetup() {
  await queryClient.unsafe(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_id" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions_json" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "company_id" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_id" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ean" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ncm" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cest" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_origin" text;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_category" text;
    ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "company_id" text;
    ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "client_id" text;
    ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cashback_earned" numeric(12,2) DEFAULT '0.00' NOT NULL;
    ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cashback_redeemed" numeric(12,2) DEFAULT '0.00' NOT NULL;
    ALTER TABLE "financial_entries" ADD COLUMN IF NOT EXISTS "company_id" text;
    ALTER TABLE "financial_entries" ADD COLUMN IF NOT EXISTS "client_id" text;
    ALTER TABLE "financial_entries" ADD COLUMN IF NOT EXISTS "supplier_id" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "company_id" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "client_id" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "series" text DEFAULT '1' NOT NULL;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "operation_nature" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "fiscal_status" text DEFAULT 'draft' NOT NULL;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "environment" text DEFAULT 'homologacao' NOT NULL;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "access_key" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "xml_content" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "signed_xml_content" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "validation_messages_json" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "validation_issues_json" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "fiscal_decision_json" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sefaz_receipt" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sefaz_protocol" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sefaz_status_code" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sefaz_status_message" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sefaz_response_xml" text;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "last_sefaz_sync_at" timestamp with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "authorized_at" timestamp with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "canceled_at" timestamp with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tenant_code" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tenant_status" text DEFAULT 'active' NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "municipal_registration" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tax_environment" text DEFAULT 'homologacao' NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "fiscal_api_provider" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "fiscal_api_token" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "certificate_alias" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "certificate_encrypted" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "certificate_subject" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "certificate_updated_at" timestamp with time zone;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "certificate_expires_at" timestamp with time zone;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tax_authority_code" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "sefaz_authorization_url" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "sefaz_return_url" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "sefaz_status_url" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "address_city_code" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "csc_id" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "csc_code" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "invoice_series" text DEFAULT '1' NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "next_invoice_number" integer DEFAULT 1 NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "cashback_enabled" boolean DEFAULT true NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "cashback_percent" numeric(6,2) DEFAULT '5.00' NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "cashback_expiry_days" integer DEFAULT 45 NOT NULL;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "pix_key" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "payment_provider" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "payment_provider_token" text;
    ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "payment_webhook_secret" text;

    CREATE TABLE IF NOT EXISTS "suppliers" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL,
      "legal_name" text NOT NULL,
      "trade_name" text,
      "document" text,
      "email" text,
      "phone" text,
      "contact_name" text,
      "category" text,
      "notes" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "clients" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL,
      "name" text NOT NULL,
      "document" text,
      "email" text,
      "phone" text,
      "birth_date" date,
      "city" text,
      "state" text,
      "segment" text,
      "notes" text,
      "cashback_opt_in" boolean DEFAULT true NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "customer_cashback_ledger" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL,
      "client_id" text NOT NULL,
      "sale_id" text,
      "type" text NOT NULL,
      "amount" numeric(12,2) NOT NULL,
      "description" text NOT NULL,
      "expires_at" date,
      "status" text DEFAULT 'active' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "purchases" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL,
      "supplier_id" text,
      "supplier_name" text,
      "document_number" text,
      "status" text DEFAULT 'received' NOT NULL,
      "total_amount" numeric(12,2) NOT NULL,
      "notes" text,
      "created_by" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "purchase_items" (
      "id" text PRIMARY KEY NOT NULL,
      "purchase_id" text NOT NULL,
      "product_id" text NOT NULL,
      "quantity" integer NOT NULL,
      "unit_cost" numeric(12,2) NOT NULL,
      "total_cost" numeric(12,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text,
      "user_id" text,
      "entity_type" text NOT NULL,
      "entity_id" text,
      "action" text NOT NULL,
      "description" text NOT NULL,
      "metadata_json" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "fiscal_company_profiles" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL UNIQUE,
      "crt_code" text DEFAULT '1',
      "cnae_primary" text,
      "cnae_secondary" text,
      "ie_substitute" text,
      "accounting_email" text,
      "accountant_name" text,
      "accountant_phone" text,
      "ibpt_version" text,
      "last_ibpt_sync" date,
      "nfse_environment" text DEFAULT 'homologacao',
      "nfse_municipality_code" text,
      "nfse_series" text DEFAULT '1',
      "default_operation_profile_id" text,
      "additional_info" text,
      "decision_mode" text DEFAULT 'automatic',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "fiscal_operation_profiles" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL,
      "name" text NOT NULL,
      "document_model" text DEFAULT 'NFC-e' NOT NULL,
      "direction" text DEFAULT 'saida' NOT NULL,
      "destination" text DEFAULT 'interna' NOT NULL,
      "final_consumer" boolean DEFAULT true NOT NULL,
      "taxpayer_type" text DEFAULT 'nao_contribuinte' NOT NULL,
      "purpose" text DEFAULT 'normal' NOT NULL,
      "presenca" text DEFAULT '1' NOT NULL,
      "cfop" text NOT NULL,
      "operation_nature" text NOT NULL,
      "valid_from" date,
      "valid_to" date,
      "priority" integer DEFAULT 100 NOT NULL,
      "is_default" boolean DEFAULT false NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "fiscal_product_rules" (
      "id" text PRIMARY KEY NOT NULL,
      "company_id" text NOT NULL,
      "product_id" text NOT NULL UNIQUE,
      "cfop_internal" text,
      "cfop_interstate" text,
      "cfop_consumer" text,
      "cst_icms" text,
      "csosn" text,
      "cst_pis" text,
      "cst_cofins" text,
      "cst_ipi" text,
      "icms_rate" numeric(6,2),
      "pis_rate" numeric(6,2),
      "cofins_rate" numeric(6,2),
      "ipi_rate" numeric(6,2),
      "benefit_code" text,
      "service_code" text,
      "ibpt_code" text,
      "notes" text,
      "valid_from" date,
      "valid_to" date,
      "rule_version" integer DEFAULT 1 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "users_company_idx" ON "users" ("company_id");
    CREATE INDEX IF NOT EXISTS "products_company_idx" ON "products" ("company_id");
    CREATE INDEX IF NOT EXISTS "sales_company_idx" ON "sales" ("company_id");
    CREATE INDEX IF NOT EXISTS "financial_entries_company_idx" ON "financial_entries" ("company_id");
    CREATE INDEX IF NOT EXISTS "invoices_company_idx" ON "invoices" ("company_id");
    CREATE INDEX IF NOT EXISTS "clients_company_idx" ON "clients" ("company_id");
    CREATE INDEX IF NOT EXISTS "suppliers_company_idx" ON "suppliers" ("company_id");
    CREATE INDEX IF NOT EXISTS "cashback_client_idx" ON "customer_cashback_ledger" ("client_id");
    CREATE INDEX IF NOT EXISTS "cashback_company_idx" ON "customer_cashback_ledger" ("company_id");
    CREATE INDEX IF NOT EXISTS "purchases_company_idx" ON "purchases" ("company_id");
    CREATE INDEX IF NOT EXISTS "purchases_supplier_idx" ON "purchases" ("supplier_id");
    CREATE INDEX IF NOT EXISTS "purchase_items_purchase_idx" ON "purchase_items" ("purchase_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_company_idx" ON "audit_logs" ("company_id");
    CREATE INDEX IF NOT EXISTS "fiscal_operation_profiles_company_idx" ON "fiscal_operation_profiles" ("company_id");
    CREATE INDEX IF NOT EXISTS "fiscal_product_rules_company_idx" ON "fiscal_product_rules" ("company_id");
    DROP INDEX IF EXISTS "products_code_idx";
    CREATE UNIQUE INDEX IF NOT EXISTS "products_company_code_idx" ON "products" ("company_id", "code");
    DROP INDEX IF EXISTS "invoices_number_idx";
    CREATE UNIQUE INDEX IF NOT EXISTS "invoices_company_series_number_idx" ON "invoices" ("company_id", "type", "series", "number");
    ALTER TABLE "fiscal_company_profiles" ADD COLUMN IF NOT EXISTS "decision_mode" text DEFAULT 'automatic';
    ALTER TABLE "fiscal_operation_profiles" ADD COLUMN IF NOT EXISTS "valid_from" date;
    ALTER TABLE "fiscal_operation_profiles" ADD COLUMN IF NOT EXISTS "valid_to" date;
    ALTER TABLE "fiscal_operation_profiles" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 100 NOT NULL;
    ALTER TABLE "fiscal_product_rules" ADD COLUMN IF NOT EXISTS "valid_from" date;
    ALTER TABLE "fiscal_product_rules" ADD COLUMN IF NOT EXISTS "valid_to" date;
    ALTER TABLE "fiscal_product_rules" ADD COLUMN IF NOT EXISTS "rule_version" integer DEFAULT 1 NOT NULL;
  `);

  const rows = await queryClient<{ id: string }[]>`select id from company_settings order by created_at asc limit 1`;
  let companyId = rows[0]?.id;

  if (!companyId) {
    const generatedId = randomUUID();
    await queryClient`
      insert into company_settings (
        id, legal_name, trade_name, cnpj, state_registration, tax_regime, tax_environment,
        invoice_series, next_invoice_number, cashback_enabled, cashback_percent, cashback_expiry_days,
        block_sale_without_stock, auto_invoice_on_sale, tenant_status, created_at, updated_at
      ) values (
        ${generatedId}, 'Allure Comércio e Gestão LTDA', 'Allure ERP', '00000000000100', 'ISENTO', 'Simples Nacional', 'homologacao',
        '1', 1, true, '5.00', 45,
        true, false, 'active', now(), now()
      )
    `;
    companyId = generatedId;
  }

  if (companyId) {
    await queryClient.unsafe(`
      UPDATE "users" SET "company_id" = '${companyId}' WHERE "company_id" IS NULL;
      UPDATE "users" SET "permissions_json" = '["*"]' WHERE "permissions_json" IS NULL AND "role" = 'admin';
      UPDATE "users" SET "permissions_json" = '${JSON.stringify(SELLER_DEFAULT_PERMISSIONS)}' WHERE "permissions_json" IS NULL AND "role" IN ('vendedor', 'seller');
      UPDATE "users" SET "permissions_json" = '${JSON.stringify(ACCOUNTANT_DEFAULT_PERMISSIONS)}' WHERE "permissions_json" IS NULL AND "role" = 'contador';
      UPDATE "users" SET "permissions_json" = CASE
        WHEN "permissions_json" IS NULL OR "permissions_json" = '' THEN '${JSON.stringify(ACCOUNTANT_DEFAULT_PERMISSIONS)}'
        WHEN POSITION('"clients.view"' IN "permissions_json") = 0 THEN regexp_replace("permissions_json", '\]$', ',"clients.view"]')
        ELSE "permissions_json"
      END
      WHERE "role" = 'contador';
      UPDATE "products" SET "company_id" = '${companyId}' WHERE "company_id" IS NULL;
      UPDATE "sales" SET "company_id" = '${companyId}' WHERE "company_id" IS NULL;
      UPDATE "financial_entries" SET "company_id" = '${companyId}' WHERE "company_id" IS NULL;
      UPDATE "invoices" SET "company_id" = '${companyId}' WHERE "company_id" IS NULL;
    `);

    await ensureDefaultFiscalStructures(companyId);
    await ensureDefaultAccountant(companyId);
  }

  infraReady = true;
}

export async function ensureEnterpriseInfrastructure() {
  if (infraReady) return;
  if (infraPromise) return infraPromise;

  infraPromise = runEnterpriseInfrastructureSetup().catch((error) => {
    infraPromise = null;
    throw error;
  });

  return infraPromise;
}
