import Layout from "@/components/Layout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import JsBarcode from "jsbarcode";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { apiFetch, getAuthUser } from "@/lib/api";
import DynamicNumberInput from "@/components/DynamicNumberInput";
import type { Product } from "@shared/api";

type CompanySettingsApi = {
  id?: string;
  tenantCode?: string | null;
  tenantStatus?: string | null;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  taxRegime?: string | null;
  taxEnvironment?: string | null;
  fiscalApiProvider?: string | null;
  certificateAlias?: string | null;
  taxAuthorityCode?: string | null;
  sefazAuthorizationUrl?: string | null;
  sefazReturnUrl?: string | null;
  sefazStatusUrl?: string | null;
  addressCityCode?: string | null;
  cscId?: string | null;
  cscCode?: string | null;
  invoiceSeries?: string | null;
  nextInvoiceNumber?: number | null;
  cashbackEnabled?: boolean;
  cashbackPercent?: number | string | null;
  cashbackExpiryDays?: number | null;
  email?: string | null;
  phone?: string | null;
  addressZipcode?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  blockSaleWithoutStock: boolean;
  autoInvoiceOnSale: boolean;
  defaultSellerName?: string | null;
};

type CompanyForm = {
  tenantCode: string;
  tenantStatus: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  municipalRegistration: string;
  taxRegime: string;
  taxEnvironment: string;
  fiscalApiProvider: string;
  certificateAlias: string;
  taxAuthorityCode: string;
  sefazAuthorizationUrl: string;
  sefazReturnUrl: string;
  sefazStatusUrl: string;
  addressCityCode: string;
  cscId: string;
  cscCode: string;
  invoiceSeries: string;
  nextInvoiceNumber: number;
  cashbackEnabled: boolean;
  cashbackPercent: number;
  cashbackExpiryDays: number;
  email: string;
  phone: string;
  addressZipcode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  blockSaleWithoutStock: boolean;
  autoInvoiceOnSale: boolean;
  defaultSellerName: string;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "contador" | "vendedor";
  isActive: boolean;
  permissions?: string[];
};

type ClientItem = {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  availableCashback?: number;
  cashbackExpiringSoon?: boolean;
};

type SupplierItem = {
  id: string;
  legalName: string;
  tradeName?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
};

type BarcodeFormat = "CODE128" | "EAN13" | "EAN8" | "UPCA";

type ElementKey = "header" | "product" | "size" | "price" | "parcel" | "barcode" | "sku";

type ElementLayout = {
  offsetCm: number;
  fontSizePx: number;
  lineHeightPx: number;
  fontWeight: 400 | 500 | 600 | 700;
  fontFamily: string;
};

type LabelSettings = {
  id?: string;
  templateName: string;
  notes: string;
  paperType: string;
  paperHeightCm: number;
  paperWidthCm: number;
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  labelHeightCm: number;
  labelWidthCm: number;
  columnsCount: number;
  columnSpacingCm: number;
  rowSpacingCm: number;
  sizePriceGapCm: number;
  priceBarcodeGapCm: number;
  contentTopOffsetCm: number;
  barcodeFormat: BarcodeFormat;
  barcodeScale: number;
  showProductName: boolean;
  showSize: boolean;
  showSku: boolean;
  showBarcode: boolean;
  mostrarPrecoCheio: boolean;
  mostrarParcelado: boolean;
  parcelas: number;
  isDefault: boolean;
  isActive: boolean;
  elementLayouts: Record<ElementKey, ElementLayout>;
};


const CM_TO_PX = 37.7952755906;
const BARCODE_FORMAT_OPTIONS: BarcodeFormat[] = ["CODE128", "EAN13", "EAN8", "UPCA"];

const emptyCompany: CompanyForm = {
  tenantCode: "",
  tenantStatus: "active",
  legalName: "",
  tradeName: "",
  cnpj: "",
  stateRegistration: "",
  municipalRegistration: "",
  taxRegime: "Simples Nacional",
  taxEnvironment: "homologacao",
  fiscalApiProvider: "",
  certificateAlias: "",
  taxAuthorityCode: "",
  sefazAuthorizationUrl: "",
  sefazReturnUrl: "",
  sefazStatusUrl: "",
  addressCityCode: "",
  cscId: "",
  cscCode: "",
  invoiceSeries: "1",
  nextInvoiceNumber: 1,
  cashbackEnabled: true,
  cashbackPercent: 5,
  cashbackExpiryDays: 45,
  email: "",
  phone: "",
  addressZipcode: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  addressCity: "",
  addressState: "",
  blockSaleWithoutStock: true,
  autoInvoiceOnSale: false,
  defaultSellerName: "",
};

const SELLER_PERMISSION_PRESET = ["sales.view", "sales.create", "products.view", "clients.view", "settings.labels.view", "settings.labels.print", "settings.labels.manage"];
const ACCOUNTANT_PERMISSION_PRESET = ["financial.view", "fiscal.view", "fiscal.manage", "fiscal.emit", "accountant.view", "accountant.export", "clients.view"];
const ADMIN_PERMISSION_PRESET = ["*"];
const USER_PERMISSION_OPTIONS = [
  { key: "sales.view", label: "Ver vendas" },
  { key: "sales.create", label: "Criar vendas" },
  { key: "products.view", label: "Ver produtos" },
  { key: "clients.view", label: "Ver clientes" },
  { key: "settings.labels.view", label: "Ver impressão" },
  { key: "settings.labels.print", label: "Imprimir etiquetas" },
  { key: "settings.labels.manage", label: "Gerenciar layout etiquetas" },
  { key: "purchases.view", label: "Ver compras" },
  { key: "financial.view", label: "Ver financeiro" },
  { key: "reports.view", label: "Ver relatórios" },
  { key: "fiscal.view", label: "Ver fiscal" },
  { key: "fiscal.manage", label: "Gerenciar fiscal" },
  { key: "fiscal.emit", label: "Emitir documentos fiscais" },
  { key: "accountant.view", label: "Acessar portal contábil" },
  { key: "accountant.export", label: "Exportar dados contábeis" },
];

const emptyUser = {
  name: "",
  email: "",
  password: "",
  role: "vendedor" as "admin" | "contador" | "vendedor",
  permissions: [...SELLER_PERMISSION_PRESET],
};

const emptyClient = {
  name: "",
  document: "",
  phone: "",
  email: "",
};

const emptySupplier = {
  legalName: "",
  tradeName: "",
  document: "",
  phone: "",
  email: "",
};

const defaultLabelSettings: LabelSettings = {
  templateName: "Etiqueta Principal - Vendas",
  notes: "",
  paperType: "termico",
  paperHeightCm: 4,
  paperWidthCm: 4,
  marginTopCm: 0.2,
  marginBottomCm: 0.2,
  marginLeftCm: 0.2,
  marginRightCm: 0.2,
  labelHeightCm: 4,
  labelWidthCm: 4,
  columnsCount: 1,
  columnSpacingCm: 0,
  rowSpacingCm: 0.08,
  sizePriceGapCm: 0.08,
  priceBarcodeGapCm: 0.22,
  contentTopOffsetCm: 0,
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
  elementLayouts: {
    header: { offsetCm: 0, fontSizePx: 7, lineHeightPx: 9, fontWeight: 600, fontFamily: "Arial" },
    product: { offsetCm: 0.02, fontSizePx: 9, lineHeightPx: 11, fontWeight: 700, fontFamily: "Arial" },
    size: { offsetCm: 0.02, fontSizePx: 8, lineHeightPx: 9, fontWeight: 600, fontFamily: "Arial" },
    price: { offsetCm: 0.02, fontSizePx: 12, lineHeightPx: 14, fontWeight: 700, fontFamily: "Arial" },
    parcel: { offsetCm: 0.04, fontSizePx: 9, lineHeightPx: 10, fontWeight: 600, fontFamily: "Arial" },
    barcode: { offsetCm: 0.02, fontSizePx: 8, lineHeightPx: 8, fontWeight: 600, fontFamily: "Arial" },
    sku: { offsetCm: 0.02, fontSizePx: 7, lineHeightPx: 8, fontWeight: 600, fontFamily: "Arial" },
  },
};

function mapSettingsToForm(data: CompanySettingsApi): CompanyForm {
  return {
    tenantCode: data.tenantCode || "",
    tenantStatus: data.tenantStatus || "active",
    legalName: data.legalName || "",
    tradeName: data.tradeName || "",
    cnpj: data.cnpj || "",
    stateRegistration: data.stateRegistration || "",
    municipalRegistration: data.municipalRegistration || "",
    taxRegime: data.taxRegime || "Simples Nacional",
    taxEnvironment: data.taxEnvironment || "homologacao",
    fiscalApiProvider: data.fiscalApiProvider || "",
    certificateAlias: data.certificateAlias || "",
    taxAuthorityCode: data.taxAuthorityCode || "",
    sefazAuthorizationUrl: data.sefazAuthorizationUrl || "",
    sefazReturnUrl: data.sefazReturnUrl || "",
    sefazStatusUrl: data.sefazStatusUrl || "",
    addressCityCode: data.addressCityCode || "",
    cscId: data.cscId || "",
    cscCode: data.cscCode || "",
    invoiceSeries: data.invoiceSeries || "1",
    nextInvoiceNumber: Number(data.nextInvoiceNumber || 1),
    cashbackEnabled: Boolean(data.cashbackEnabled ?? true),
    cashbackPercent: Number(data.cashbackPercent || 5),
    cashbackExpiryDays: Number(data.cashbackExpiryDays || 45),
    email: data.email || "",
    phone: data.phone || "",
    addressZipcode: data.addressZipcode || "",
    addressStreet: data.addressStreet || "",
    addressNumber: data.addressNumber || "",
    addressComplement: data.addressComplement || "",
    addressNeighborhood: data.addressNeighborhood || "",
    addressCity: data.addressCity || "",
    addressState: data.addressState || "",
    blockSaleWithoutStock: Boolean(data.blockSaleWithoutStock),
    autoInvoiceOnSale: Boolean(data.autoInvoiceOnSale),
    defaultSellerName: data.defaultSellerName || "",
  };
}

function sanitizeNumericInput(value: string, allowDecimal = true, allowNegative = false) {
  const normalized = String(value || "").replace(/,/g, ".");
  let result = "";
  let hasDot = false;
  let hasNegative = false;

  for (const [index, char] of Array.from(normalized).entries()) {
    if (allowNegative && char === "-" && index === 0 && !hasNegative) {
      result += char;
      hasNegative = true;
      continue;
    }
    if (/[0-9]/.test(char)) {
      result += char;
      continue;
    }
    if (allowDecimal && char === "." && !hasDot) {
      result += char;
      hasDot = true;
    }
  }

  return result;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLabelSettings(data?: Partial<LabelSettings>): LabelSettings {
  return {
    ...defaultLabelSettings,
    ...data,
    paperHeightCm: normalizeNumber(data?.paperHeightCm, defaultLabelSettings.paperHeightCm),
    paperWidthCm: normalizeNumber(data?.paperWidthCm, defaultLabelSettings.paperWidthCm),
    marginTopCm: normalizeNumber(data?.marginTopCm, defaultLabelSettings.marginTopCm),
    marginBottomCm: normalizeNumber(data?.marginBottomCm, defaultLabelSettings.marginBottomCm),
    marginLeftCm: normalizeNumber(data?.marginLeftCm, defaultLabelSettings.marginLeftCm),
    marginRightCm: normalizeNumber(data?.marginRightCm, defaultLabelSettings.marginRightCm),
    labelHeightCm: normalizeNumber(data?.labelHeightCm, defaultLabelSettings.labelHeightCm),
    labelWidthCm: normalizeNumber(data?.labelWidthCm, defaultLabelSettings.labelWidthCm),
    columnsCount: Math.max(1, Math.floor(normalizeNumber(data?.columnsCount, defaultLabelSettings.columnsCount))),
    columnSpacingCm: normalizeNumber(data?.columnSpacingCm, defaultLabelSettings.columnSpacingCm),
    rowSpacingCm: normalizeNumber(data?.rowSpacingCm, defaultLabelSettings.rowSpacingCm),
    sizePriceGapCm: normalizeNumber(data?.sizePriceGapCm, defaultLabelSettings.sizePriceGapCm),
    priceBarcodeGapCm: normalizeNumber(data?.priceBarcodeGapCm, defaultLabelSettings.priceBarcodeGapCm),
    contentTopOffsetCm: normalizeNumber(data?.contentTopOffsetCm, defaultLabelSettings.contentTopOffsetCm),
    barcodeScale: Math.max(1, Math.floor(normalizeNumber(data?.barcodeScale, defaultLabelSettings.barcodeScale))),
    parcelas: Math.max(1, Math.floor(normalizeNumber(data?.parcelas, defaultLabelSettings.parcelas))),
    barcodeFormat: BARCODE_FORMAT_OPTIONS.includes(data?.barcodeFormat as BarcodeFormat)
      ? (data?.barcodeFormat as BarcodeFormat)
      : defaultLabelSettings.barcodeFormat,
    elementLayouts: {
      header: {
        ...defaultLabelSettings.elementLayouts.header,
        ...(data?.elementLayouts?.header || {}),
      },
      product: {
        ...defaultLabelSettings.elementLayouts.product,
        ...(data?.elementLayouts?.product || {}),
      },
      size: {
        ...defaultLabelSettings.elementLayouts.size,
        ...(data?.elementLayouts?.size || {}),
      },
      price: {
        ...defaultLabelSettings.elementLayouts.price,
        ...(data?.elementLayouts?.price || {}),
      },
      parcel: {
        ...defaultLabelSettings.elementLayouts.parcel,
        ...(data?.elementLayouts?.parcel || {}),
      },
      barcode: {
        ...defaultLabelSettings.elementLayouts.barcode,
        ...(data?.elementLayouts?.barcode || {}),
      },
      sku: {
        ...defaultLabelSettings.elementLayouts.sku,
        ...(data?.elementLayouts?.sku || {}),
      },
    },
  };
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cmToPx(value: number) {
  return Math.max(12, Math.round(value * CM_TO_PX));
}

function offsetCmToPx(value: number) {
  return Math.round(Number(value || 0) * CM_TO_PX);
}

function isNumericOnlyBarcode(format: BarcodeFormat) {
  return format === "EAN13" || format === "EAN8" || format === "UPCA";
}

function normalizeBarcodeValue(rawValue: string, format: BarcodeFormat) {
  const clean = String(rawValue || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-]/g, "")
    .trim();
  if (!clean) return "";
  if (!isNumericOnlyBarcode(format)) return clean;

  const digits = clean.replace(/\D/g, "");
  if (format === "EAN13") return digits.slice(0, 12) || "123456789012";
  if (format === "EAN8") return digits.slice(0, 7) || "1234567";
  return digits.slice(0, 11) || "12345678901";
}

function resolveBarcodeSource(product: Pick<Product, "code" | "ean">) {
  const ean = String(product.ean || "").replace(/\D/g, "").trim();
  if (ean) {
    return { value: ean, source: "ean" as const };
  }
  return { value: String(product.code || "").trim(), source: "sku" as const };
}

function getInstallmentValue(price: number, parcelas: number) {
  const total = Number(price || 0);
  const count = Math.max(1, Math.floor(Number(parcelas || 1)));
  return Number((total / count).toFixed(2));
}

function getInstallmentLabel(price: number, parcelas: number) {
  const count = Math.max(1, Math.floor(Number(parcelas || 1)));
  return `${count}x de ${formatCurrency(getInstallmentValue(price, count))}`;
}

function getBarcodeObservation(format: BarcodeFormat, product: Pick<Product, "code" | "ean">) {
  const source = resolveBarcodeSource(product);
  if (!isNumericOnlyBarcode(format)) {
    return source.source === "ean"
      ? "Barcode usando o EAN cadastrado do produto."
      : "Formato ideal para SKU alfanumérico.";
  }
  if (/^\d+$/.test(source.value || "")) {
    return source.source === "ean"
      ? `O formato ${format} está usando o EAN numérico do produto.`
      : `O formato ${format} está usando apenas números do SKU.`;
  }
  return `O formato ${format} exige números; o preview usa somente os dígitos do ${source.source === "ean" ? "EAN" : "SKU"}.`;
}

function getPaperPreset(paperType: string) {
  switch (paperType) {
    case "a4":
      return { paperWidthCm: 21, paperHeightCm: 29.7, marginTopCm: 0.5, marginBottomCm: 0.5, marginLeftCm: 0.5, marginRightCm: 0.5 };
    case "carta":
      return { paperWidthCm: 21.59, paperHeightCm: 27.94, marginTopCm: 0.5, marginBottomCm: 0.5, marginLeftCm: 0.5, marginRightCm: 0.5 };
    case "termico":
      return { paperWidthCm: 4, paperHeightCm: 4, marginTopCm: 0.2, marginBottomCm: 0.2, marginLeftCm: 0.2, marginRightCm: 0.2 };
    case "goldensky":
      return { paperWidthCm: 8, paperHeightCm: 10, marginTopCm: 0.2, marginBottomCm: 0.2, marginLeftCm: 0.2, marginRightCm: 0.2 };
    default:
      return { paperWidthCm: 4, paperHeightCm: 4, marginTopCm: 0.2, marginBottomCm: 0.2, marginLeftCm: 0.2, marginRightCm: 0.2 };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fitTextSingleLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const source = String(text || "").trim();
  if (!source) return "";
  if (ctx.measureText(source).width <= maxWidth) return source;

  let result = source;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1).trimEnd();
  }
  return `${result}…`;
}

function getWrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const source = String(text || "").trim();
  if (!source) return [] as string[];
  const words = source.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(fitTextSingleLine(ctx, word, maxWidth));
      current = "";
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  } else if (current && lines.length >= maxLines) {
    lines[maxLines - 1] = fitTextSingleLine(ctx, `${lines[maxLines - 1]} ${current}`.trim(), maxWidth);
  }

  return lines.slice(0, maxLines);
}

function getWrappedHeight(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number, maxLines: number) {
  return Math.max(lineHeight, getWrappedLines(ctx, text, maxWidth, maxLines).length * lineHeight);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const lines = getWrappedLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

export default function Configuracoes() {
  const authUser = getAuthUser();
  const isAdmin = authUser?.role === "admin";
  const permissions = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
  const canManageLabels = isAdmin || permissions.includes("*") || permissions.includes("settings.labels.manage") || permissions.includes("settings.labels.print");
  const [tab, setTab] = useState<"empresa" | "usuarios" | "cadastros" | "pdv" | "impressao">(isAdmin ? "empresa" : "impressao");
  const [company, setCompany] = useState<CompanyForm>(emptyCompany);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [newUser, setNewUser] = useState(emptyUser);
  const [newClient, setNewClient] = useState(emptyClient);
  const [newSupplier, setNewSupplier] = useState(emptySupplier);
  const [message, setMessage] = useState("");
  const [labelSettings, setLabelSettings] = useState<LabelSettings>(defaultLabelSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("Todas categorias");
  const [printStatus, setPrintStatus] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [barcodeMessage, setBarcodeMessage] = useState("Formato ideal para SKU alfanumérico.");
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<Record<ElementKey, boolean>>({ header: false, product: false, size: false, price: false, parcel: false, barcode: false, sku: false });

  const loadData = async () => {
    if (!isAdmin) {
      const [labelResult, productResult] = await Promise.allSettled([
        apiFetch<Partial<LabelSettings>>("/api/v1/label-settings"),
        apiFetch<Product[]>("/api/v1/products"),
      ]);

      if (labelResult.status === "fulfilled") setLabelSettings(normalizeLabelSettings(labelResult.value));
      else setLabelSettings(defaultLabelSettings);

      if (productResult.status === "fulfilled") {
        const availableProducts = productResult.value.filter((product) => product.stock >= 0);
        setProducts(availableProducts);
        if (availableProducts.length === 0) {
          setPrintStatus("Nenhum produto foi encontrado para seleção de impressão. Cadastre ou ative produtos para continuar.");
        }
      } else {
        setProducts([]);
        setPrintStatus("Não foi possível carregar os produtos para impressão.");
      }

      if (labelResult.status === "rejected") {
        setPrintStatus("As configurações de etiqueta foram reconstituídas automaticamente. Revise e salve novamente.");
      }
      return;
    }

    const [companyResult, usersResult, clientsResult, suppliersResult, labelResult, productResult] = await Promise.allSettled([
      apiFetch<CompanySettingsApi>("/api/v1/settings/company"),
      apiFetch<UserItem[]>("/api/v1/users"),
      apiFetch<ClientItem[]>("/api/v1/clients"),
      apiFetch<SupplierItem[]>("/api/v1/suppliers"),
      apiFetch<Partial<LabelSettings>>("/api/v1/label-settings"),
      apiFetch<Product[]>("/api/v1/products"),
    ]);

    if (companyResult.status === "fulfilled") setCompany(mapSettingsToForm(companyResult.value));
    if (usersResult.status === "fulfilled") setUsers(usersResult.value);
    if (clientsResult.status === "fulfilled") setClients(clientsResult.value);
    if (suppliersResult.status === "fulfilled") setSuppliers(suppliersResult.value);
    if (labelResult.status === "fulfilled") setLabelSettings(normalizeLabelSettings(labelResult.value));
    else setLabelSettings(defaultLabelSettings);

    if (productResult.status === "fulfilled") {
      const availableProducts = productResult.value.filter((product) => product.stock >= 0);
      setProducts(availableProducts);
      if (availableProducts.length === 0) {
        setPrintStatus("Nenhum produto foi encontrado para seleção de impressão. Cadastre ou ative produtos para continuar.");
      }
    } else {
      setProducts([]);
      setPrintStatus("Não foi possível carregar os produtos para impressão.");
    }

    if (labelResult.status === "rejected") {
      setPrintStatus("As configurações de etiqueta foram reconstituídas automaticamente. Revise e salve novamente.");
    }
  };

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  const saveCompany = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await apiFetch("/api/v1/settings/company", {
      method: "PUT",
      body: JSON.stringify(company),
    });
    setMessage("Configurações salvas com sucesso.");
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(newUser),
    });
    setNewUser(emptyUser);
    setMessage("Usuário criado com sucesso.");
    loadData();
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch("/api/v1/clients", {
      method: "POST",
      body: JSON.stringify(newClient),
    });
    setNewClient(emptyClient);
    setMessage("Cliente criado com sucesso.");
    loadData();
  };

  const createSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch("/api/v1/suppliers", {
      method: "POST",
      body: JSON.stringify(newSupplier),
    });
    setNewSupplier(emptySupplier);
    setMessage("Fornecedor criado com sucesso.");
    loadData();
  };

  const toggleUser = async (user: UserItem) => {
    await apiFetch(`/api/v1/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    loadData();
  };


  const onCompanyChange = (field: keyof CompanyForm, value: string | boolean | number) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const onLabelNumberChange = (field: keyof LabelSettings, value: number, minimum = 0) => {
    setLabelSettings((prev) => ({
      ...prev,
      [field]: Math.max(minimum, Number.isFinite(value) ? value : minimum),
    }));
  };

  const onLabelChange = <K extends keyof LabelSettings>(field: K, value: LabelSettings[K]) => {
    setLabelSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateElementLayout = (key: ElementKey, patch: Partial<ElementLayout>) => {
    setLabelSettings((prev) => ({
      ...prev,
      elementLayouts: {
        ...prev.elementLayouts,
        [key]: {
          ...prev.elementLayouts[key],
          ...patch,
        },
      },
    }));
  };

  const applyPaperPreset = (paperType: string) => {
    if (paperType === "termico") {
      setLabelSettings((prev) => ({
        ...prev,
        ...defaultLabelSettings,
        templateName: prev.templateName,
        notes: prev.notes,
        barcodeFormat: prev.barcodeFormat,
        showProductName: prev.showProductName,
        showSize: prev.showSize,
        showSku: prev.showSku,
        showBarcode: prev.showBarcode,
        mostrarPrecoCheio: prev.mostrarPrecoCheio,
        mostrarParcelado: prev.mostrarParcelado,
        parcelas: prev.parcelas,
        isDefault: prev.isDefault,
        isActive: prev.isActive,
      }));
      setPrintStatus("Preset térmico 4x4 aplicado no formulário.");
      return;
    }

    const preset = getPaperPreset(paperType);
    setLabelSettings((prev) => ({
      ...prev,
      paperType,
      ...preset,
    }));
    setPrintStatus(`Preset ${paperType === "goldensky" ? "Goldensky" : paperType} aplicado no formulário.`);
  };

  const fitLabelToPaper = () => {
    setLabelSettings((prev) => {
      const usableWidth = Math.max(2, prev.paperWidthCm - prev.marginLeftCm - prev.marginRightCm);
      const usableHeight = Math.max(2, prev.paperHeightCm - prev.marginTopCm - prev.marginBottomCm);
      return {
        ...prev,
        labelWidthCm: Number(usableWidth.toFixed(2)),
        labelHeightCm: Number(usableHeight.toFixed(2)),
        columnsCount: 1,
        columnSpacingCm: 0,
        rowSpacingCm: 0.1,
      };
    });
    setPrintStatus("Etiqueta ajustada automaticamente para a área útil do papel.");
  };

  const applySingleLabelPreset = () => {
    setLabelSettings((prev) => ({
      ...prev,
      paperType: "termico",
      paperWidthCm: 4,
      paperHeightCm: 4,
      marginTopCm: 0.2,
      marginBottomCm: 0.2,
      marginLeftCm: 0.2,
      marginRightCm: 0.2,
      labelWidthCm: 4,
      labelHeightCm: 4,
      columnsCount: 1,
      columnSpacingCm: 0,
      rowSpacingCm: 0.08,
      sizePriceGapCm: 0.08,
      priceBarcodeGapCm: 0.28,
      contentTopOffsetCm: 0,
      barcodeScale: 1,
    }));
    setPrintStatus("Modelo de etiqueta única aplicado com sucesso.");
  };

  const applyTwoColumnPreset = () => {
    setLabelSettings((prev) => ({
      ...prev,
      paperType: "carta",
      paperWidthCm: 8,
      paperHeightCm: 4,
      marginTopCm: 0.2,
      marginBottomCm: 0.2,
      marginLeftCm: 0.2,
      marginRightCm: 0.2,
      labelWidthCm: 3.8,
      labelHeightCm: 4,
      columnsCount: 2,
      columnSpacingCm: 0.2,
      rowSpacingCm: 0.08,
      sizePriceGapCm: 0.08,
      priceBarcodeGapCm: 0.28,
      contentTopOffsetCm: 0,
      barcodeScale: 1,
    }));
    setPrintStatus("Modelo de 2 colunas aplicado com sucesso.");
  };

  const applyThermal4x4Preset = () => {
    setLabelSettings((prev) => ({
      ...prev,
      paperType: "termico",
      paperWidthCm: 4,
      paperHeightCm: 4,
      marginTopCm: 0.2,
      marginBottomCm: 0.2,
      marginLeftCm: 0.2,
      marginRightCm: 0.2,
      labelWidthCm: 4,
      labelHeightCm: 4,
      columnsCount: 1,
      columnSpacingCm: 0,
      rowSpacingCm: 0.08,
      sizePriceGapCm: 0.08,
      priceBarcodeGapCm: 0.22,
      contentTopOffsetCm: 0,
      barcodeScale: 1,
      elementLayouts: {
        header: { offsetCm: 0, fontSizePx: 7, lineHeightPx: 9, fontWeight: 600, fontFamily: "Arial" },
        product: { offsetCm: 0.02, fontSizePx: 9, lineHeightPx: 11, fontWeight: 700, fontFamily: "Arial" },
        size: { offsetCm: 0.02, fontSizePx: 8, lineHeightPx: 9, fontWeight: 600, fontFamily: "Arial" },
        price: { offsetCm: 0.02, fontSizePx: 12, lineHeightPx: 14, fontWeight: 700, fontFamily: "Arial" },
        parcel: { offsetCm: 0.04, fontSizePx: 9, lineHeightPx: 10, fontWeight: 600, fontFamily: "Arial" },
        barcode: { offsetCm: 0.02, fontSizePx: 8, lineHeightPx: 8, fontWeight: 600, fontFamily: "Arial" },
        sku: { offsetCm: 0.02, fontSizePx: 7, lineHeightPx: 8, fontWeight: 600, fontFamily: "Arial" },
      },
    }));
    setPrintStatus("Preset térmico 4x4 aplicado com alinhamento inicial profissional.");
  };

  const saveLabelConfig = async () => {
    setIsSavingLabel(true);
    try {
      const payload = normalizeLabelSettings(labelSettings);
      const saved = await apiFetch<Partial<LabelSettings>>("/api/v1/label-settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setLabelSettings(normalizeLabelSettings(saved));
      setMessage("Configurações de etiqueta salvas com sucesso.");
      setPrintStatus("Configuração salva e pronta para uso.");
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : "Falha ao salvar configurações de etiqueta.");
    } finally {
      setIsSavingLabel(false);
    }
  };

  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => s.add(p.category));
    return Array.from(s).sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (categoryFilter === "Todas categorias") return products;
    return products.filter((p) => p.category === categoryFilter);
  }, [products, categoryFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id];
      else copy[id] = 1;
      return copy;
    });
  };

  const setQty = (id: string, qty: number) => {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(qty || 1)) }));
  };

  const previewProduct = useMemo(() => {
    const selectedId = Object.keys(selected)[0];
    if (selectedId) {
      return products.find((p) => p.id === selectedId) || null;
    }
    return visibleProducts[0] || products[0] || null;
  }, [selected, products, visibleProducts]);

  const previewRows = useMemo(() => {
    if (!previewProduct) return [] as string[];
    const rows: string[] = [];
    if (labelSettings.showProductName) rows.push(previewProduct.name);
    if (labelSettings.showSize && previewProduct.size) rows.push(`Tamanho: ${previewProduct.size}`);
    if (labelSettings.mostrarPrecoCheio) rows.push(formatCurrency(previewProduct.price));
    if (labelSettings.mostrarParcelado) rows.push(getInstallmentLabel(previewProduct.price, labelSettings.parcelas));
    if (labelSettings.showSku) rows.push(`SKU: ${previewProduct.code}`);
    return rows;
  }, [previewProduct, labelSettings]);

  const previewValidation = useMemo(() => {
    if (!previewProduct) return null;
    return {
      barcodeLabel: `SKU ${previewProduct.code}`,
      installmentLabel: getInstallmentLabel(previewProduct.price, labelSettings.parcelas),
      previewMatchesPrint: true,
    };
  }, [previewProduct, labelSettings]);

  const buildLabelPreview = (product: Product) => {
    const barcodeCanvas = document.createElement("canvas");
    const previewCanvas = document.createElement("canvas");
    const widthPx = cmToPx(labelSettings.labelWidthCm);
    const heightPx = cmToPx(labelSettings.labelHeightCm);
    const scaleFactor = 2;

    previewCanvas.width = widthPx * scaleFactor;
    previewCanvas.height = heightPx * scaleFactor;

    const ctx = previewCanvas.getContext("2d");
    if (!ctx) {
      return { image: "", message: "Não foi possível gerar o preview da etiqueta." };
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.strokeStyle = "#d6d6d6";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, widthPx - 1, heightPx - 1);

    const paddingLeft = Math.min(cmToPx(labelSettings.marginLeftCm), Math.floor(widthPx * 0.18));
    const paddingRight = Math.min(cmToPx(labelSettings.marginRightCm), Math.floor(widthPx * 0.18));
    const paddingTop = Math.min(cmToPx(labelSettings.marginTopCm), Math.floor(heightPx * 0.16));
    const paddingBottom = Math.min(cmToPx(labelSettings.marginBottomCm), Math.floor(heightPx * 0.16));
    const contentX = paddingLeft;
    const contentWidth = Math.max(60, widthPx - paddingLeft - paddingRight);
    const bottomLimit = Math.max(contentX + 20, heightPx - paddingBottom);

    let currentY = paddingTop + cmToPx(labelSettings.contentTopOffsetCm);
    let localMessage = "Formato ideal para SKU alfanumérico.";

    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const headerLayout = labelSettings.elementLayouts.header;
    const productLayout = labelSettings.elementLayouts.product;
    const sizeLayout = labelSettings.elementLayouts.size;
    const priceLayout = labelSettings.elementLayouts.price;
    const parcelLayout = labelSettings.elementLayouts.parcel;
    const barcodeLayout = labelSettings.elementLayouts.barcode;
    const skuLayout = labelSettings.elementLayouts.sku;
    const compactMode = labelSettings.labelWidthCm <= 4.2 && labelSettings.labelHeightCm <= 4.2;
    const sectionGapPx = compactMode ? 2 : 4;

    const headerBoxHeight = Math.max(headerLayout.lineHeightPx, headerLayout.fontSizePx + 2);
    const sizeBoxHeight = Math.max(sizeLayout.lineHeightPx, sizeLayout.fontSizePx + 2);
    const priceBoxHeight = Math.max(priceLayout.lineHeightPx, priceLayout.fontSizePx + 2);
    const skuBoxHeight = labelSettings.showSku ? Math.max(skuLayout.lineHeightPx, skuLayout.fontSizePx + 2) : 0;
    const parcelBoxHeight = labelSettings.mostrarParcelado ? Math.max(parcelLayout.lineHeightPx, parcelLayout.fontSizePx + 2) : 0;
    const bodyToFooterGapPx = Math.max(sectionGapPx + 2, cmToPx(labelSettings.priceBarcodeGapCm));
    let barcodeBoxHeight = labelSettings.showBarcode ? clamp(Math.round(heightPx * (compactMode ? 0.15 : 0.18)), compactMode ? 18 : 24, compactMode ? 28 : 44) : 0;

    const minimumBodyReserve = headerBoxHeight
      + (labelSettings.showSize && product.size ? sizeBoxHeight + sectionGapPx : 0)
      + (labelSettings.mostrarPrecoCheio ? priceBoxHeight + sectionGapPx : 0)
      + (labelSettings.mostrarParcelado ? parcelBoxHeight + bodyToFooterGapPx : labelSettings.mostrarPrecoCheio ? bodyToFooterGapPx : 0)
      + 10;

    const fullFooterReserve = (labelSettings.showBarcode ? barcodeBoxHeight + sectionGapPx : 0) + (labelSettings.showSku ? skuBoxHeight + sectionGapPx : 0);
    const totalAvailableHeight = bottomLimit - currentY;
    if (minimumBodyReserve + fullFooterReserve > totalAvailableHeight && labelSettings.showBarcode) {
      const maxBarcodeHeight = Math.max(12, Math.floor(totalAvailableHeight - minimumBodyReserve - (labelSettings.showSku ? skuBoxHeight + sectionGapPx : 0)));
      barcodeBoxHeight = clamp(maxBarcodeHeight, 12, barcodeBoxHeight);
    }

    const footerReserve = (labelSettings.showBarcode ? barcodeBoxHeight + sectionGapPx : 0) + (labelSettings.showSku ? skuBoxHeight + sectionGapPx : 0);
    const footerTop = Math.max(currentY + bodyToFooterGapPx, bottomLimit - footerReserve);

    const drawSingleLine = (text: string, layout: ElementLayout, boxTop: number, boxHeight: number, align: CanvasTextAlign = "left") => {
      ctx.font = `${layout.fontWeight} ${layout.fontSizePx}px ${layout.fontFamily}`;
      ctx.textAlign = align;
      const x = align === "center" ? contentX + contentWidth / 2 : contentX;
      const fitted = fitTextSingleLine(ctx, text, contentWidth);
      const offsetY = offsetCmToPx(layout.offsetCm);
      const y = clamp(boxTop + offsetY, boxTop - boxHeight, boxTop + Math.max(0, boxHeight - layout.fontSizePx));
      ctx.fillText(fitted, x, y);
      ctx.textAlign = "left";
    };

    drawSingleLine(labelSettings.templateName.toUpperCase(), headerLayout, currentY, headerBoxHeight, "center");
    currentY += headerBoxHeight + sectionGapPx;

    const reserveAfterProduct = (labelSettings.showSize && product.size ? sizeBoxHeight + sectionGapPx : 0)
      + (labelSettings.mostrarPrecoCheio ? priceBoxHeight + sectionGapPx : 0)
      + (labelSettings.mostrarParcelado ? parcelBoxHeight + bodyToFooterGapPx : labelSettings.mostrarPrecoCheio ? bodyToFooterGapPx : 0);

    if (labelSettings.showProductName) {
      const availableForProduct = Math.max(productLayout.lineHeightPx, footerTop - currentY - reserveAfterProduct);
      const productMaxLines = clamp(Math.floor(availableForProduct / Math.max(1, productLayout.lineHeightPx)), 1, compactMode ? 2 : 3);
      const productBoxHeight = Math.max(productLayout.lineHeightPx, productMaxLines * productLayout.lineHeightPx);
      const productBoxTop = currentY;
      ctx.font = `${productLayout.fontWeight} ${productLayout.fontSizePx}px ${productLayout.fontFamily}`;
      const productY = clamp(productBoxTop + offsetCmToPx(productLayout.offsetCm), productBoxTop - productBoxHeight, productBoxTop + Math.max(0, productBoxHeight - productLayout.lineHeightPx));
      wrapText(ctx, product.name, contentX, productY, contentWidth, productLayout.lineHeightPx, productMaxLines);
      currentY = productBoxTop + productBoxHeight + sectionGapPx;
    }

    if (labelSettings.showSize && product.size) {
      drawSingleLine(`Tam: ${product.size}`, sizeLayout, currentY, sizeBoxHeight);
      currentY += sizeBoxHeight + Math.max(sectionGapPx, cmToPx(labelSettings.sizePriceGapCm));
    }

    if (labelSettings.mostrarPrecoCheio) {
      drawSingleLine(formatCurrency(product.price), priceLayout, currentY, priceBoxHeight);
      currentY += priceBoxHeight + (labelSettings.mostrarParcelado ? sectionGapPx : bodyToFooterGapPx);
    }

    if (labelSettings.mostrarParcelado) {
      drawSingleLine(getInstallmentLabel(product.price, labelSettings.parcelas), parcelLayout, currentY, parcelBoxHeight);
      currentY += parcelBoxHeight + bodyToFooterGapPx;
    }

    let footerCursor = Math.max(footerTop, currentY);

    if (labelSettings.showBarcode) {
      const barcodeFormat = labelSettings.barcodeFormat;
      const barcodeSource = resolveBarcodeSource(product);
      const barcodeValue = normalizeBarcodeValue(barcodeSource.value, barcodeFormat);
      localMessage = getBarcodeObservation(barcodeFormat, product);

      try {
        JsBarcode(barcodeCanvas, barcodeValue, {
          format: barcodeFormat,
          displayValue: false,
          margin: 0,
          background: "#ffffff",
          lineColor: "#111111",
          height: barcodeBoxHeight,
          width: Math.max(1, labelSettings.barcodeScale),
        });

        footerCursor += clamp(cmToPx(barcodeLayout.offsetCm), 0, sectionGapPx + 2);
        const barcodeWidth = Math.min(contentWidth, Math.round(contentWidth * (compactMode ? 0.88 : 0.92)));
        const barcodeX = contentX + (contentWidth - barcodeWidth) / 2;
        ctx.drawImage(barcodeCanvas, barcodeX, footerCursor, barcodeWidth, barcodeBoxHeight);
        footerCursor += barcodeBoxHeight + sectionGapPx;
      } catch {
        try {
          JsBarcode(barcodeCanvas, normalizeBarcodeValue(barcodeSource.value, "CODE128"), {
            format: "CODE128",
            displayValue: false,
            margin: 0,
            background: "#ffffff",
            lineColor: "#111111",
            height: barcodeBoxHeight,
            width: Math.max(1, labelSettings.barcodeScale),
          });
          footerCursor += clamp(cmToPx(barcodeLayout.offsetCm), 0, sectionGapPx + 2);
          const barcodeWidth = Math.min(contentWidth, Math.round(contentWidth * (compactMode ? 0.88 : 0.92)));
          const barcodeX = contentX + (contentWidth - barcodeWidth) / 2;
          ctx.drawImage(barcodeCanvas, barcodeX, footerCursor, barcodeWidth, barcodeBoxHeight);
          footerCursor += barcodeBoxHeight + sectionGapPx;
          localMessage = "Barcode gerado automaticamente em CODE128 para manter a leitura do SKU.";
        } catch {
          localMessage = "Não foi possível gerar o formato selecionado com esse SKU no preview.";
        }
      }
    } else {
      localMessage = "Barcode oculto no preview pela configuração atual.";
    }

    if (labelSettings.showSku) {
      drawSingleLine(product.code, skuLayout, footerCursor, skuBoxHeight, "center");
    }

    return { image: previewCanvas.toDataURL("image/png"), message: localMessage };
  };

  useEffect(() => {
    if (!previewProduct) {
      setPreviewImage("");
      return;
    }

    const preview = buildLabelPreview(previewProduct);
    setPreviewImage(preview.image);
    setBarcodeMessage(preview.message);
  }, [labelSettings, previewProduct]);

  const collectLabelsForPrint = () => {
    const selectedLabels = Object.entries(selected)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === id);
        if (!p) return null;
        return { productId: p.id, sku: p.code, name: p.name, size: p.size || null, price: p.price, qty };
      })
      .filter(Boolean) as Array<{ productId: string; sku: string; name: string; size: string | null; price: number; qty: number }>;

    if (selectedLabels.length > 0) return selectedLabels;
    if (!previewProduct) return [];

    return [{
      productId: previewProduct.id,
      sku: previewProduct.code,
      name: previewProduct.name,
      size: previewProduct.size || null,
      price: previewProduct.price,
      qty: 1,
    }];
  };

  const printTest = async () => {
    const labels = collectLabelsForPrint();

    if (!labels.length) {
      setPrintStatus("Selecione pelo menos um produto para testar a impressão.");
      return false;
    }

    setIsPrintingLabel(true);
    try {
      const resp = await apiFetch<{ message: string }>("/api/v1/label-settings/print-test", {
        method: "POST",
        body: JSON.stringify({ labels, config: labelSettings }),
      });
      setPrintStatus(resp.message || "Teste de impressão executado com sucesso.");
      return true;
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : "Falha ao processar teste de impressão.");
      return false;
    } finally {
      setIsPrintingLabel(false);
    }
  };

  const downloadPreviewImage = () => {
    if (!previewImage || !previewProduct) {
      setPrintStatus("Selecione um produto válido para gerar o preview antes de baixar.");
      return;
    }
    const a = document.createElement("a");
    a.href = previewImage;
    a.download = `etiqueta-${previewProduct.code.toLowerCase()}.png`;
    a.click();
    setPrintStatus("Preview em PNG gerado com sucesso.");
  };

  const openPrintPreview = async () => {
    const labels = collectLabelsForPrint();
    if (!labels.length) {
      setPrintStatus("Selecione pelo menos um produto para abrir o preview de impressão.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=720,height=900");
    if (!printWindow) {
      setPrintStatus("O navegador bloqueou a janela de impressão. Permita pop-ups para continuar.");
      return;
    }

    const canContinue = await printTest();
    if (!canContinue) {
      printWindow.close();
      return;
    }

    const rendered = labels.flatMap((label) => {
      const product = products.find((p) => p.id === label.productId);
      if (!product) return [] as string[];
      const preview = buildLabelPreview(product);
      return Array.from({ length: Math.max(1, label.qty) }).map(() => preview.image);
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiquetas Allure ERP</title>
          <style>
            @page { size: ${labelSettings.paperWidthCm}cm ${labelSettings.paperHeightCm}cm; margin: ${labelSettings.marginTopCm}cm ${labelSettings.marginRightCm}cm ${labelSettings.marginBottomCm}cm ${labelSettings.marginLeftCm}cm; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f3f3f3; }
            .grid { display: grid; grid-template-columns: repeat(${Math.max(1, labelSettings.columnsCount)}, ${labelSettings.labelWidthCm}cm); gap: ${labelSettings.rowSpacingCm}cm ${labelSettings.columnSpacingCm}cm; justify-content: start; align-content: start; }
            .label { width: ${labelSettings.labelWidthCm}cm; height: ${labelSettings.labelHeightCm}cm; background: white; display:flex; align-items:center; justify-content:center; overflow:hidden; page-break-inside: avoid; }
            .label img { width: 100%; height: 100%; object-fit: contain; display:block; }
          </style>
        </head>
        <body>
          <div class="grid">
            ${rendered.map((img) => `<div class="label"><img src="${img}" alt="Etiqueta" /></div>`).join("")}
          </div>
          <script>
            function waitForImages() {
              const images = Array.from(document.images || []);
              if (images.length === 0) {
                window.focus();
                setTimeout(function () { window.print(); }, 250);
                return;
              }
              let done = 0;
              const finish = function () {
                done += 1;
                if (done >= images.length) {
                  window.focus();
                  setTimeout(function () { window.print(); }, 300);
                }
              };
              images.forEach(function (img) {
                if (img.complete) finish();
                else {
                  img.onload = finish;
                  img.onerror = finish;
                }
              });
            }
            window.onload = waitForImages;
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-[34px] font-bold text-white">Configurações</h1>
          <p className="text-sm text-[#a77b88]">{isAdmin ? "Gerencie dados da empresa, usuários, PDV e etiquetas dentro do próprio sistema" : "Área liberada para impressão de etiquetas e scanner do vendedor"}</p>
        </div>

        {message && <div className="rounded-2xl border border-[#395a46] bg-[#173325] px-5 py-4 text-[#98f0bd]">{message}</div>}
        {printStatus && <div className="rounded-2xl border border-[#395a46] bg-[#173325] px-5 py-4 text-[#98f0bd]">{printStatus}</div>}

        <div className="flex flex-wrap items-center gap-3 border-b border-[#4a1f2d] pb-2">
          {isAdmin && (
            <>
              <button type="button" onClick={() => setTab("empresa")} className={`rounded-2xl border px-5 py-3 ${tab === "empresa" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Dados da Empresa</button>
              <button type="button" onClick={() => setTab("usuarios")} className={`rounded-2xl border px-5 py-3 ${tab === "usuarios" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Usuários</button>
              <button type="button" onClick={() => setTab("cadastros")} className={`rounded-2xl border px-5 py-3 ${tab === "cadastros" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Clientes e Fornecedores</button>
              <button type="button" onClick={() => setTab("pdv")} className={`rounded-2xl border px-5 py-3 ${tab === "pdv" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Configurações do PDV</button>
            </>
          )}
          <button type="button" onClick={() => setTab("impressao")} className={`rounded-2xl border px-5 py-3 ${tab === "impressao" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Impressão e Scanner</button>
        </div>

        {tab === "empresa" && (
          <form onSubmit={saveCompany} className="space-y-5">
            <Section title="Informações Gerais">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Input label="Razão Social" value={company.legalName} onChange={(e) => onCompanyChange("legalName", e.target.value)} />
                <Input label="Nome Fantasia" value={company.tradeName} onChange={(e) => onCompanyChange("tradeName", e.target.value)} />
                <Input label="CNPJ" value={company.cnpj} onChange={(e) => onCompanyChange("cnpj", e.target.value)} />
                <Input label="Inscrição Estadual" value={company.stateRegistration} onChange={(e) => onCompanyChange("stateRegistration", e.target.value)} />
                <Input label="Regime Tributário" value={company.taxRegime} onChange={(e) => onCompanyChange("taxRegime", e.target.value)} />
                <Input label="E-mail" value={company.email} onChange={(e) => onCompanyChange("email", e.target.value)} />
                <Input label="Telefone" value={company.phone} onChange={(e) => onCompanyChange("phone", e.target.value)} />
                <Input label="Vendedor padrão" value={company.defaultSellerName} onChange={(e) => onCompanyChange("defaultSellerName", e.target.value)} />
              </div>
            </Section>

            <Section title="Endereço">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Input label="CEP" value={company.addressZipcode} onChange={(e) => onCompanyChange("addressZipcode", e.target.value)} />
                <Input label="Endereço" value={company.addressStreet} onChange={(e) => onCompanyChange("addressStreet", e.target.value)} className="xl:col-span-2" />
                <Input label="Número" value={company.addressNumber} onChange={(e) => onCompanyChange("addressNumber", e.target.value)} />
                <Input label="Complemento" value={company.addressComplement} onChange={(e) => onCompanyChange("addressComplement", e.target.value)} />
                <Input label="Bairro" value={company.addressNeighborhood} onChange={(e) => onCompanyChange("addressNeighborhood", e.target.value)} />
                <Input label="Cidade" value={company.addressCity} onChange={(e) => onCompanyChange("addressCity", e.target.value)} />
                <Input label="UF" value={company.addressState} onChange={(e) => onCompanyChange("addressState", e.target.value)} />
              </div>
            </Section>

            <Section title="Tenant, Fiscal e Cashback">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Input label="Código do tenant" value={company.tenantCode} onChange={(e) => onCompanyChange("tenantCode", e.target.value)} />
                <Input label="Status do tenant" value={company.tenantStatus} onChange={(e) => onCompanyChange("tenantStatus", e.target.value)} />
                <Input label="Inscrição Municipal" value={company.municipalRegistration} onChange={(e) => onCompanyChange("municipalRegistration", e.target.value)} />
                <Input label="Ambiente Fiscal" value={company.taxEnvironment} onChange={(e) => onCompanyChange("taxEnvironment", e.target.value)} />
                <Input label="Provedor Fiscal" value={company.fiscalApiProvider} onChange={(e) => onCompanyChange("fiscalApiProvider", e.target.value)} />
                <Input label="Alias do Certificado" value={company.certificateAlias} onChange={(e) => onCompanyChange("certificateAlias", e.target.value)} />
                <Input label="Código UF/Autorizador" value={company.taxAuthorityCode} onChange={(e) => onCompanyChange("taxAuthorityCode", e.target.value)} />
                <Input label="Código IBGE da cidade" value={company.addressCityCode} onChange={(e) => onCompanyChange("addressCityCode", e.target.value)} />
                <Input label="URL SEFAZ Autorização" value={company.sefazAuthorizationUrl} onChange={(e) => onCompanyChange("sefazAuthorizationUrl", e.target.value)} />
                <Input label="URL SEFAZ Recibo" value={company.sefazReturnUrl} onChange={(e) => onCompanyChange("sefazReturnUrl", e.target.value)} />
                <Input label="URL SEFAZ Consulta" value={company.sefazStatusUrl} onChange={(e) => onCompanyChange("sefazStatusUrl", e.target.value)} />
                <Input label="CSC ID" value={company.cscId} onChange={(e) => onCompanyChange("cscId", e.target.value)} />
                <Input label="CSC Código" value={company.cscCode} onChange={(e) => onCompanyChange("cscCode", e.target.value)} />
                <Input label="Série da Nota" value={company.invoiceSeries} onChange={(e) => onCompanyChange("invoiceSeries", e.target.value)} />
                <Input label="Próximo número" value={String(company.nextInvoiceNumber)} onChange={(e) => onCompanyChange("nextInvoiceNumber", Number(e.target.value || 1) as any)} />
                <Input label="Cashback %" value={String(company.cashbackPercent)} onChange={(e) => onCompanyChange("cashbackPercent", Number(e.target.value || 0) as any)} />
                <Input label="Validade do cashback (dias)" value={String(company.cashbackExpiryDays)} onChange={(e) => onCompanyChange("cashbackExpiryDays", Number(e.target.value || 0) as any)} />
              </div>
              <div className="mt-4 space-y-4">
                <SwitchRow title="Programa de cashback ativo" description="Acumula saldo por cliente com vencimento para resgate futuro." checked={company.cashbackEnabled} onChange={(checked) => onCompanyChange("cashbackEnabled", checked)} />
              </div>
            </Section>

            <div className="flex justify-end">
              <button type="submit" className="rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014]">Salvar Alterações</button>
            </div>
          </form>
        )}

        {tab === "usuarios" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <Section title="Usuários Cadastrados">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3b1b26] text-left text-[#9a717d]">
                      <th className="pb-3">Nome</th>
                      <th className="pb-3">E-mail</th>
                      <th className="pb-3">Perfil</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                        <td className="py-4 font-medium text-white">{user.name}</td>
                        <td className="py-4">{user.email}</td>
                        <td className="py-4">{user.role === "admin" ? "Administrador" : user.role === "contador" ? "Contador" : "Vendedor"}</td>
                        <td className="py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? "bg-[#163b24] text-[#4ce08a]" : "bg-[#4d1724] text-[#ff7c84]"}`}>
                            {user.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-4">
                          {isAdmin && (
                            <button type="button" onClick={() => toggleUser(user)} className="rounded-xl border border-[#5b2534] bg-[#3a1823] px-4 py-2 text-[#b78a99] hover:border-[#6b4f38] hover:text-white">
                              {user.isActive ? "Desativar" : "Ativar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Novo Usuário">
              <form onSubmit={createUser} className="space-y-4">
                <Input label="Nome" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                <Input label="E-mail" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                <Input label="Senha" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                <div>
                  <label className="mb-2 block text-sm text-[#c7aebb]">Perfil</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "admin" | "contador" | "vendedor", permissions: e.target.value === "admin" ? [...ADMIN_PERMISSION_PRESET] : e.target.value === "contador" ? [...ACCOUNTANT_PERMISSION_PRESET] : [...SELLER_PERMISSION_PRESET] })} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                    <option value="vendedor">Vendedor</option>
                    <option value="contador">Contador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button type="submit" disabled={!isAdmin} className="w-full rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014] disabled:cursor-not-allowed disabled:opacity-40">Criar Usuário</button>
              </form>
            </Section>
          </div>
        )}

        {tab === "cadastros" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Section title="Clientes cadastrados">
              <div className="space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="rounded-2xl border border-[#3f1623] bg-[#18050b] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{client.name}</p>
                        <p className="text-sm text-[#a77b88]">{client.document || "Sem documento"} · {client.phone || "Sem telefone"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#a7f3d0]">Cashback</p>
                        <p className="font-semibold text-[#8ef5cb]">R$ {(client.availableCashback || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={createClient} className="mt-5 space-y-4">
                <Input label="Nome do cliente" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                <Input label="Documento" value={newClient.document} onChange={(e) => setNewClient({ ...newClient, document: e.target.value })} />
                <Input label="Telefone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                <Input label="E-mail" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                <button type="submit" className="rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014]">Cadastrar cliente</button>
              </form>
            </Section>
            <Section title="Fornecedores homologados">
              <div className="space-y-3">
                {suppliers.map((supplier) => (
                  <div key={supplier.id} className="rounded-2xl border border-[#3f1623] bg-[#18050b] p-4">
                    <p className="font-semibold text-white">{supplier.tradeName || supplier.legalName}</p>
                    <p className="text-sm text-[#a77b88]">{supplier.document || "Sem documento"} · {supplier.phone || "Sem telefone"}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={createSupplier} className="mt-5 space-y-4">
                <Input label="Razão Social" value={newSupplier.legalName} onChange={(e) => setNewSupplier({ ...newSupplier, legalName: e.target.value })} />
                <Input label="Nome Fantasia" value={newSupplier.tradeName} onChange={(e) => setNewSupplier({ ...newSupplier, tradeName: e.target.value })} />
                <Input label="Documento" value={newSupplier.document} onChange={(e) => setNewSupplier({ ...newSupplier, document: e.target.value })} />
                <Input label="Telefone" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
                <Input label="E-mail" value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} />
                <button type="submit" className="rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014]">Cadastrar fornecedor</button>
              </form>
            </Section>
          </div>
        )}

        {tab === "pdv" && (
          <div className="space-y-5">
            <Section title="Comportamento de Venda">
              <div className="space-y-4">
                <SwitchRow title="Bloquear venda sem estoque" description="Impede finalizar pedidos quando o item não possui saldo disponível." checked={company.blockSaleWithoutStock} onChange={(checked) => onCompanyChange("blockSaleWithoutStock", checked)} />
                <SwitchRow title="Gerar lançamento financeiro automaticamente" description="Toda venda concluída cria entrada no financeiro em tempo real." checked={true} onChange={() => undefined} disabled />
                <SwitchRow title="Enviar venda para emissão fiscal automática" description="Quando habilitado, a venda entra na fila de emissão fiscal após finalizar." checked={company.autoInvoiceOnSale} onChange={(checked) => onCompanyChange("autoInvoiceOnSale", checked)} />
              </div>
            </Section>

            <div className="flex justify-end">
              <button type="button" onClick={() => saveCompany()} className="rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014]">Salvar Configurações do PDV</button>
            </div>
          </div>
        )}

        {tab === "impressao" && (
          <div className="space-y-5">
            <Section title="Dados da Etiqueta">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <Input label="Nome da Etiqueta" value={labelSettings.templateName} onChange={(e) => onLabelChange("templateName", e.target.value)} />
                  <div>
                    <label className="mb-2 block text-sm text-[#c7aebb]">Observação</label>
                    <textarea value={labelSettings.notes} onChange={(e) => onLabelChange("notes", e.target.value)} rows={4} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-[#c7aebb]">Tipo do Papel</label>
                    <select value={labelSettings.paperType} onChange={(e) => applyPaperPreset(e.target.value)} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                      <option value="personalizado">Personalizado</option>
                      <option value="carta">Carta</option>
                      <option value="a4">A4</option>
                      <option value="termico">Térmico</option>
                      <option value="goldensky">Goldensky</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-[#c7aebb]">Formato do Barcode</label>
                    <select value={labelSettings.barcodeFormat} onChange={(e) => onLabelChange("barcodeFormat", e.target.value as BarcodeFormat)} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                      {BARCODE_FORMAT_OPTIONS.map((format) => <option key={format} value={format}>{format}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Formulário">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <FieldCard title="Tamanho do Papel (cm)">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Altura" value={labelSettings.paperHeightCm} min={1} step={0.1} onChange={(value) => onLabelNumberChange("paperHeightCm", value, 1)} />
                    <NumberField label="Largura" value={labelSettings.paperWidthCm} min={1} step={0.1} onChange={(value) => onLabelNumberChange("paperWidthCm", value, 1)} />
                  </div>
                </FieldCard>

                <FieldCard title="Margens do Papel (cm)">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Superior" value={labelSettings.marginTopCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("marginTopCm", value, 0)} />
                    <NumberField label="Inferior" value={labelSettings.marginBottomCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("marginBottomCm", value, 0)} />
                    <NumberField label="Esquerda" value={labelSettings.marginLeftCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("marginLeftCm", value, 0)} />
                    <NumberField label="Direita" value={labelSettings.marginRightCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("marginRightCm", value, 0)} />
                  </div>
                </FieldCard>

                <FieldCard title="Configuração Geral">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Escala do barcode" value={labelSettings.barcodeScale} min={1} step={1} onChange={(value) => onLabelNumberChange("barcodeScale", value, 1)} />
                    <div>
                      <label className="mb-2 block text-sm text-[#c7aebb]">Parcelas padrão do preview</label>
                      <select value={labelSettings.parcelas} onChange={(e) => onLabelNumberChange("parcelas", Number(e.target.value), 1)} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                        {Array.from({ length: 12 }).map((_, index) => {
                          const value = index + 1;
                          return <option key={value} value={value}>{value}x</option>;
                        })}
                      </select>
                    </div>
                    <NumberField label="Qtd. colunas" value={labelSettings.columnsCount} min={1} step={1} onChange={(value) => onLabelNumberChange("columnsCount", value, 1)} />
                    <NumberField label="Espaço entre colunas" value={labelSettings.columnSpacingCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("columnSpacingCm", value, 0)} />
                    <NumberField label="Deslocamento topo conteúdo" value={labelSettings.contentTopOffsetCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("contentTopOffsetCm", value, 0)} />
                    <div className="rounded-2xl border border-dashed border-[#65404d] bg-[#24040d] px-4 py-3 text-xs text-[#cfaab5]">Esses controles afetam diretamente a posição interna do texto e dos valores na etiqueta.</div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button type="button" onClick={applySingleLabelPreset} className="rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-4 py-3 font-semibold text-[#f7df78]">Etiqueta única</button>
                    <button type="button" onClick={applyTwoColumnPreset} className="rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-4 py-3 font-semibold text-[#f7df78]">Modelo 2 colunas</button>
                    <button type="button" onClick={applyThermal4x4Preset} className="rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-4 py-3 font-semibold text-[#f7df78]">Resetar padrão</button>
                  </div>
                </FieldCard>
              </div>
            </Section>

            <Section title="Etiqueta">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
                <FieldCard title="Tamanho da Etiqueta (cm)">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Altura" value={labelSettings.labelHeightCm} min={1} step={0.1} onChange={(value) => onLabelNumberChange("labelHeightCm", value, 1)} />
                    <NumberField label="Largura" value={labelSettings.labelWidthCm} min={1} step={0.1} onChange={(value) => onLabelNumberChange("labelWidthCm", value, 1)} />
                  </div>
                </FieldCard>

                <FieldCard title="Colunas da Etiqueta (cm)">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Espaço entre colunas" value={labelSettings.columnSpacingCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("columnSpacingCm", value, 0)} />
                    <NumberField label="Espaço entre linhas" value={labelSettings.rowSpacingCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("rowSpacingCm", value, 0)} />
                    <NumberField label="Espaço Tam. → Valor" value={labelSettings.sizePriceGapCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("sizePriceGapCm", value, 0)} />
                    <NumberField label="Espaço Parcelado → Barcode" value={labelSettings.priceBarcodeGapCm} min={0} step={0.05} onChange={(value) => onLabelNumberChange("priceBarcodeGapCm", value, 0)} />
                  </div>
                  <div className="mt-4 rounded-2xl border border-dashed border-[#65404d] bg-[#24040d] px-4 py-3 text-xs text-[#cfaab5]">Use os botões acima para alternar entre etiqueta única e 2 colunas. O ajuste fino de altura é feito nos blocos abaixo.</div>
                </FieldCard>

                <div className="rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
                  <p className="mb-3 text-sm font-semibold text-[#f1dc86]">Modelo da Etiqueta</p>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-dashed border-[#65404d] bg-[#24040d] p-4 text-sm text-[#cfaab5]">
                      <p>Papel: {labelSettings.paperWidthCm.toFixed(2)} × {labelSettings.paperHeightCm.toFixed(2)} cm</p>
                      <p>Etiqueta: {labelSettings.labelWidthCm.toFixed(2)} × {labelSettings.labelHeightCm.toFixed(2)} cm</p>
                      <p>Área útil: {(labelSettings.paperWidthCm - labelSettings.marginLeftCm - labelSettings.marginRightCm).toFixed(2)} × {(labelSettings.paperHeightCm - labelSettings.marginTopCm - labelSettings.marginBottomCm).toFixed(2)} cm</p>
                      <p>Colunas: {labelSettings.columnsCount}</p>
                      <p>Espaço Tam. → Valor: {labelSettings.sizePriceGapCm.toFixed(2)} cm</p>
                      <p>Espaço Parcelado → Barcode: {labelSettings.priceBarcodeGapCm.toFixed(2)} cm</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 text-black">
                      {previewRows.length > 0 ? previewRows.map((line, idx) => <div key={idx} className={idx === 0 ? "font-semibold" : ""}>{line}</div>) : <div className="text-sm text-neutral-500">Todos os elementos textuais estão ocultos na configuração atual.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Exibição da Etiqueta">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <SwitchRow title="Mostrar nome do produto" description="Exibe o nome na etiqueta final." checked={labelSettings.showProductName} onChange={(checked) => onLabelChange("showProductName", checked)} />
                <SwitchRow title="Mostrar tamanho" description="Exibe o tamanho/variante na etiqueta." checked={labelSettings.showSize} onChange={(checked) => onLabelChange("showSize", checked)} />
                <SwitchRow title="Mostrar SKU" description="Exibe o código SKU abaixo do barcode." checked={labelSettings.showSku} onChange={(checked) => onLabelChange("showSku", checked)} />
                <SwitchRow title="Mostrar barcode" description="Renderiza barras legíveis a partir do SKU." checked={labelSettings.showBarcode} onChange={(checked) => onLabelChange("showBarcode", checked)} />
                <SwitchRow title="Mostrar preço cheio" description="Exibe o valor integral na etiqueta." checked={labelSettings.mostrarPrecoCheio} onChange={(checked) => onLabelChange("mostrarPrecoCheio", checked)} />
                <SwitchRow title="Mostrar valor parcelado" description="Exibe parcelamento configurado na etiqueta." checked={labelSettings.mostrarParcelado} onChange={(checked) => onLabelChange("mostrarParcelado", checked)} />
                <SwitchRow title="Etiqueta padrão" description="Marca esta configuração como padrão do sistema." checked={labelSettings.isDefault} onChange={(checked) => onLabelChange("isDefault", checked)} />
                <SwitchRow title="Etiqueta ativa" description="Mantém o modelo disponível para uso e impressão." checked={labelSettings.isActive} onChange={(checked) => onLabelChange("isActive", checked)} />
              </div>

              {labelSettings.mostrarParcelado && (
                <div className="mt-5 rounded-2xl border border-[#4f2a34] bg-[#260811] p-4">
                  <p className="text-sm font-semibold text-[#f1dc86]">Controle do valor parcelado</p>
                  <p className="mt-1 text-xs text-[#cfaab5]">Escolha quantas vezes o valor parcelado deve aparecer na etiqueta e no preview funcional.</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm text-[#c7aebb]">Quantidade de parcelas exibida</label>
                      <select value={labelSettings.parcelas} onChange={(e) => onLabelNumberChange("parcelas", Number(e.target.value), 1)} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                        {Array.from({ length: 12 }).map((_, index) => {
                          const value = index + 1;
                          return <option key={value} value={value}>{value}x</option>;
                        })}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-dashed border-[#65404d] bg-[#24040d] px-4 py-3 text-sm text-[#e9d5a0]">
                      Preview atual: <span className="font-semibold">{previewProduct ? getInstallmentLabel(previewProduct.price, labelSettings.parcelas) : `${labelSettings.parcelas}x`}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ElementConfigDialog title="Nome da etiqueta / loja" elementKey="header" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.header} onSave={updateElementLayout} />
                <ElementConfigDialog title="Produto" elementKey="product" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.product} onSave={updateElementLayout} />
                <ElementConfigDialog title="Tamanho" elementKey="size" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.size} onSave={updateElementLayout} />
                <ElementConfigDialog title="Preço" elementKey="price" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.price} onSave={updateElementLayout} />
                <ElementConfigDialog title="Preço parcelado" elementKey="parcel" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.parcel} onSave={updateElementLayout} />
                <ElementConfigDialog title="Barcode" elementKey="barcode" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.barcode} onSave={updateElementLayout} />
                <ElementConfigDialog title="SKU" elementKey="sku" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} layout={labelSettings.elementLayouts.sku} onSave={updateElementLayout} />
              </div>
            </Section>

            <Section title="Scanner">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
                  <p className="text-sm text-[#9a717d]">Status do Scanner</p>
                  <p className="mt-2 text-lg font-bold text-[#4ce08a]">Ativo via leitor USB / teclado</p>
                </div>
                <div className="rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
                  <p className="text-sm text-[#9a717d]">Funcionamento</p>
                  <p className="mt-2 text-sm text-white">O SKU gerado na etiqueta permanece compatível com a leitura no PDV e pode ser testado pelo preview em imagem.</p>
                </div>
              </div>
            </Section>

            <Section title="Impressão e Preview">
              <div className="mb-4 max-w-[320px]">
                <label className="mb-2 block text-sm text-[#c7aebb]">Filtrar categoria</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                  <option>Todas categorias</option>
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="overflow-x-auto rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#3b1b26] text-left text-[#9a717d]">
                        <th className="pb-3">Sel.</th>
                        <th className="pb-3">Produto</th>
                        <th className="pb-3">SKU</th>
                        <th className="pb-3">Categoria</th>
                        <th className="pb-3">Tam.</th>
                        <th className="pb-3">Preço</th>
                        <th className="pb-3">Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product) => (
                        <tr key={product.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                          <td className="py-3"><input type="checkbox" checked={Boolean(selected[product.id])} onChange={() => toggleSelect(product.id)} /></td>
                          <td className="py-3 font-medium text-white">{product.name}</td>
                          <td className="py-3 text-[#f1dc86]">{product.code}</td>
                          <td className="py-3">{product.category}</td>
                          <td className="py-3">{product.size || "-"}</td>
                          <td className="py-3">{formatCurrency(product.price)}</td>
                          <td className="py-3"><DynamicNumberInput min={1} value={selected[product.id] || 1} onValueChange={(value) => setQty(product.id, value)} className="w-20 rounded-xl border border-[#5b2534] bg-[#310815] px-2 py-1 text-white outline-none" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
                    <p className="mb-3 text-sm font-semibold text-[#f1dc86]">Preview funcional da etiqueta</p>
                    <div className="rounded-xl border border-dashed border-[#5f4450] bg-[#24040d] p-3">
                      {previewImage ? (
                        <img src={previewImage} alt="Preview da etiqueta" className="mx-auto max-h-[340px] w-auto rounded-md bg-white p-2" />
                      ) : (
                        <div className="rounded-xl bg-white p-8 text-center text-black">Selecione um produto para gerar o preview.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
                    <p className="text-sm text-[#9a717d]">Validação do preview e da impressão</p>
                    <p className="mt-2 text-sm text-white">{barcodeMessage}</p>
                    {previewProduct && <p className="mt-2 text-xs text-[#c7aebb]">SKU de teste atual: {previewProduct.code}</p>}
                    {previewValidation && (
                      <div className="mt-3 space-y-2 text-xs text-[#f3dde2]">
                        <p>Barcode validado com origem: <span className="font-semibold text-[#f7df78]">{previewValidation.barcodeLabel}</span></p>
                        <p>Parcelado validado no preview/impressão: <span className="font-semibold text-[#f7df78]">{previewValidation.installmentLabel}</span></p>
                        <p className="text-[#98f0bd]">O preview e a impressão usam o mesmo renderizador interno da etiqueta.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {canManageLabels && <button type="button" onClick={saveLabelConfig} disabled={isSavingLabel} className="rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014] disabled:cursor-not-allowed disabled:opacity-60">{isSavingLabel ? "Salvando..." : "Salvar Configurações"}</button>}
                    <button type="button" onClick={downloadPreviewImage} className="rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-6 py-3 font-semibold text-[#f7df78]">Baixar Preview em PNG</button>
                    <button type="button" onClick={openPrintPreview} disabled={isPrintingLabel} className="rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-6 py-3 font-semibold text-[#f7df78] disabled:cursor-not-allowed disabled:opacity-60">{isPrintingLabel ? "Preparando impressão..." : "Abrir Preview para Impressão"}</button>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        )}

      </div>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
      <h2 className="mb-5 text-xl font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function FieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
      <p className="mb-4 text-sm font-semibold text-[#f1dc86]">{title}</p>
      {children}
    </div>
  );
}

function Input({ label, className = "", type = "text", value, onChange }: { label: string; className?: string; type?: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm text-[#c7aebb]">{label}</label>
      <input type={type} value={value} onChange={onChange} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" />
    </div>
  );
}

function NumberField({ label, value, min = 0, step = 1, onChange, allowNegative = false }: { label: string; value: number; min?: number; step?: number; onChange: (value: number) => void; allowNegative?: boolean }) {
  const allowDecimal = step < 1;
  const decimals = allowDecimal ? Math.max(1, String(step).split(".")[1]?.length || 0) : 0;
  const [textValue, setTextValue] = useState(() => {
    if (!Number.isFinite(value)) return "";
    return String(value);
  });

  useEffect(() => {
    if (!Number.isFinite(value)) {
      setTextValue("");
      return;
    }
    setTextValue(String(value));
  }, [value]);

  const commitValue = (raw: string) => {
    const sanitized = sanitizeNumericInput(raw, allowDecimal, allowNegative);
    const parsed = Number(sanitized);
    if (!Number.isFinite(parsed)) {
      const fallback = allowDecimal ? Number(min.toFixed(decimals)) : Math.round(min);
      setTextValue(String(fallback));
      onChange(fallback);
      return;
    }

    const normalized = Math.max(min, allowDecimal ? Number(parsed.toFixed(decimals)) : Math.round(parsed));
    setTextValue(String(normalized));
    onChange(normalized);
  };

  return (
    <div>
      <label className="mb-2 block text-sm text-[#c7aebb]">{label}</label>
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={textValue}
        onChange={(e) => setTextValue(sanitizeNumericInput(e.target.value, allowDecimal, allowNegative))}
        onBlur={(e) => commitValue(e.target.value)}
        className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none"
      />
    </div>
  );
}

function SwitchRow({ title, description, checked, onChange, disabled = false }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#45202a] bg-[#2d0913] p-4">
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-[#9a717d]">{description}</p>
      </div>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-8 w-14 rounded-full transition ${checked ? "bg-[#f1dc86]" : "bg-[#4a2230]"} ${disabled ? "opacity-60" : ""}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

function ElementConfigDialog({
  title,
  elementKey,
  layout,
  dialogOpen,
  setDialogOpen,
  onSave,
}: {
  title: string;
  elementKey: ElementKey;
  layout: ElementLayout;
  dialogOpen: Record<ElementKey, boolean>;
  setDialogOpen: (value: Record<ElementKey, boolean> | ((prev: Record<ElementKey, boolean>) => Record<ElementKey, boolean>)) => void;
  onSave: (key: ElementKey, patch: Partial<ElementLayout>) => void;
}) {
  return (
    <Dialog open={dialogOpen[elementKey]} onOpenChange={(open) => setDialogOpen((prev) => ({ ...prev, [elementKey]: open }))}>
      <DialogTrigger asChild>
        <button type="button" className="rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-4 py-3 text-left font-semibold text-[#f7df78]">
          Configurar {title}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl border-[#5b2534] bg-[#24040d] text-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[#c7aebb]">
            Ajuste apenas a altura do elemento dentro da etiqueta, de forma simples.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Mover para cima/baixo (cm)" value={layout.offsetCm} min={-2} step={0.05} allowNegative onChange={(value) => onSave(elementKey, { offsetCm: value })} />
          <div className="rounded-2xl border border-dashed border-[#65404d] bg-[#24040d] px-4 py-3 text-sm text-[#cfaab5]">Aceita negativos e positivos. Ex.: -0.20 sobe, 0.20 desce.</div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => setDialogOpen((prev) => ({ ...prev, [elementKey]: false }))} className="rounded-2xl bg-[#f1dc86] px-5 py-3 font-semibold text-[#261014]">
            Concluir
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
