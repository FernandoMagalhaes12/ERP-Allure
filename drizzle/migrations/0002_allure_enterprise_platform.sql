ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_id" text;
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

ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tenant_code" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tenant_status" text DEFAULT 'active' NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "municipal_registration" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "tax_environment" text DEFAULT 'homologacao' NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "fiscal_api_provider" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "fiscal_api_token" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "certificate_alias" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "csc_id" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "csc_code" text;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "invoice_series" text DEFAULT '1' NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "next_invoice_number" integer DEFAULT 1 NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "cashback_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "cashback_percent" numeric(6,2) DEFAULT '5.00' NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "cashback_expiry_days" integer DEFAULT 45 NOT NULL;

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

CREATE INDEX IF NOT EXISTS "users_company_idx" ON "users" ("company_id");
CREATE INDEX IF NOT EXISTS "products_company_idx" ON "products" ("company_id");
CREATE INDEX IF NOT EXISTS "sales_company_idx" ON "sales" ("company_id");
CREATE INDEX IF NOT EXISTS "financial_entries_company_idx" ON "financial_entries" ("company_id");
CREATE INDEX IF NOT EXISTS "invoices_company_idx" ON "invoices" ("company_id");
CREATE INDEX IF NOT EXISTS "clients_company_idx" ON "clients" ("company_id");
CREATE INDEX IF NOT EXISTS "suppliers_company_idx" ON "suppliers" ("company_id");
CREATE INDEX IF NOT EXISTS "cashback_client_idx" ON "customer_cashback_ledger" ("client_id");
CREATE INDEX IF NOT EXISTS "cashback_company_idx" ON "customer_cashback_ledger" ("company_id");
