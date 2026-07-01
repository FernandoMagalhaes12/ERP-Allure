ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "block_sale_without_stock" boolean DEFAULT true NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "auto_invoice_on_sale" boolean DEFAULT false NOT NULL;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_seller_name" text;

CREATE TABLE IF NOT EXISTS "label_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text,
  "template_name" text DEFAULT 'Etiqueta Principal - Vendas' NOT NULL,
  "notes" text,
  "paper_type" text DEFAULT 'personalizado' NOT NULL,
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
