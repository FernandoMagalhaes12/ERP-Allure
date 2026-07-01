import Layout from "@/components/Layout";
import { AppPage, MetricCard, SectionCard, StatusBanner } from "@/components/AppChrome";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Edit2, FileUp, Plus, Search, Trash2, Upload, X } from "lucide-react";
import type { Product, SizeVariant } from "@shared/api";
import { apiFetch, getAuthUser } from "@/lib/api";
import DynamicNumberInput from "@/components/DynamicNumberInput";

const categories = [
  "Roupas Femininas",
  "Roupas Masculinas",
  "Faixas Elásticas",
  "Acessórios",
  "Calçados",
];

const clothingSizes: SizeVariant[] = ["PP", "P", "M", "G", "GG", "XG", "Plus Size", "Único"];
const footwearSizes = ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

function isFootwearCategory(category: string) {
  return category === "Calçados";
}

function isClothingCategory(category: string) {
  return category === "Roupas Femininas" || category === "Roupas Masculinas";
}

function getSizesForCategory(category: string) {
  return isFootwearCategory(category) ? footwearSizes : clothingSizes;
}

const emptyForm = {
  code: "",
  name: "",
  category: categories[0],
  size: "M",
  cost: 0,
  margin: 100,
  stock: 0,
  minStock: 5,
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function deriveStatus(product: Product) {
  if (product.stock <= 0) return "Sem estoque";
  if (product.stock <= product.minStock) return "Baixo";
  return "Normal";
}

function buildPreviewSku(name: string, size: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("") || "SKU";
  return `${clean}-${String(size || "UN").toUpperCase().replace(/\s+/g, "").slice(0, 3) || "UN"}-001`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseNfeXml(raw: string) {
  const xml = new DOMParser().parseFromString(raw, "application/xml");
  const products = Array.from(xml.querySelectorAll("det"));
  return products.map((det, index) => {
    const prod = det.querySelector("prod");
    const code = prod?.querySelector("cProd")?.textContent?.trim() || `XML-${index + 1}`;
    const name = prod?.querySelector("xProd")?.textContent?.trim() || `Item ${index + 1}`;
    const ean = prod?.querySelector("cEAN")?.textContent?.trim() || prod?.querySelector("cEANTrib")?.textContent?.trim() || "";
    const ncm = prod?.querySelector("NCM")?.textContent?.trim() || "";
    const unit = prod?.querySelector("uCom")?.textContent?.trim() || "Único";
    const quantity = Number(prod?.querySelector("qCom")?.textContent?.replace(",", ".") || 0);
    const cost = Number(prod?.querySelector("vUnCom")?.textContent?.replace(",", ".") || 0);
    const price = Number(prod?.querySelector("vUnCom")?.textContent?.replace(",", ".") || 0);
    return {
      code,
      name,
      ean,
      category: ncm ? `NCM ${ncm}` : "Importado XML",
      size: unit,
      cost,
      price,
      stock: quantity,
      minStock: 0,
    };
  });
}

function parseCsv(raw: string) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [] as Record<string, string>[];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function normalizeImportedRows(rows: Record<string, any>[]) {
  return rows.map((row) => ({
    code: String(row.code || row.sku || row.codigo || "").trim(),
    name: String(row.name || row.nome || row.produto || "").trim(),
    category: String(row.category || row.categoria || "Geral").trim(),
    size: String(row.size || row.tamanho || row.unit || row.unidade || "Único").trim(),
    ean: String(row.ean || row.barcode || row["barcode / ean"] || row["barcode_ean"] || "").replace(/\D/g, ""),
    cost: Number(String(row.cost || row.custo || 0).replace(",", ".") || 0),
    price: Number(String(row.price || row.preco || row.valor || 0).replace(",", ".") || 0),
    stock: Number(String(row.stock || row.estoque || row.quantity || row.quantidade || 0).replace(",", ".") || 0),
    minStock: Number(String(row.minStock || row.estoque_minimo || row.minimo || 0).replace(",", ".") || 0),
  })).filter((row) => row.code || row.name);
}

export default function Produtos() {
  const user = getAuthUser();
  const isAdmin = user?.role === "admin";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas categorias");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Product[]>("/api/v1/products");
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts().catch(() => undefined);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.size.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "Todas categorias" || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  const availableSizes = useMemo(() => getSizesForCategory(form.category), [form.category]);
  const isCustomClothingSize = isClothingCategory(form.category) && !clothingSizes.includes(form.size as SizeVariant);

  const totalStockValue = filteredProducts.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const lowStockCount = filteredProducts.filter((product) => product.stock <= product.minStock && product.stock > 0).length;
  const outOfStockCount = filteredProducts.filter((product) => product.stock <= 0).length;
  const stalledProducts = filteredProducts.filter((product) => (product.stalledDays || 0) >= 120 && product.stock > 0);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCategoryChange = (category: string) => {
    setForm((prev) => {
      const nextSizes = getSizesForCategory(category);
      let nextSize = prev.size;

      if (isFootwearCategory(category)) {
        nextSize = footwearSizes.includes(prev.size) ? prev.size : "37";
      } else if (isClothingCategory(category)) {
        nextSize = clothingSizes.includes(prev.size as SizeVariant) ? prev.size : prev.size || "M";
      } else {
        nextSize = clothingSizes.includes(prev.size as SizeVariant) ? prev.size : "Único";
      }

      return { ...prev, category, size: nextSize };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const payload = {
        ...form,
        code: editingId ? form.code : "",
      };
      if (editingId) {
        await apiFetch(`/api/v1/products/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/v1/products", { method: "POST", body: JSON.stringify(payload) });
      }
      await loadProducts();
      resetForm();
      setMessage(editingId ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      code: product.code,
      name: product.name,
      category: product.category,
      size: product.size,
      cost: product.cost,
      margin: product.margin,
      stock: product.stock,
      minStock: product.minStock,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este produto?")) return;
    await apiFetch(`/api/v1/products/${id}`, { method: "DELETE" });
    await loadProducts();
    setMessage("Produto removido com sucesso.");
  };

  const exportStock = () => {
    downloadCsv(`estoque-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["sku", "nome", "categoria", "tamanho", "barcode_ean", "custo", "preco", "estoque", "estoque_minimo", "parado_dias", "ultima_alteracao", "alterado_por"],
      ...filteredProducts.map((product) => [
        product.code,
        product.name,
        product.category,
        String(product.size || ""),
        product.ean || "",
        String(product.cost),
        String(product.price),
        String(product.stock),
        String(product.minStock),
        String(product.stalledDays || 0),
        formatDateTime(product.lastChangedAt),
        product.lastChangedBy || product.lastStockChangedBy || product.lastPriceChangedBy || "—",
      ]),
    ]);
    setMessage("Download do estoque gerado com sucesso.");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setMessage("");
    setErrorMessage("");

    try {
      let rows: Record<string, any>[] = [];
      const ext = file.name.toLowerCase().split(".").pop() || "";

      if (ext === "xml") {
        const raw = await file.text();
        rows = parseNfeXml(raw);
      } else if (ext === "csv" || ext === "txt") {
        const raw = await file.text();
        rows = parseCsv(raw);
      } else {
        throw new Error("Formato não suportado. Use CSV/TXT ou XML.");
      }

      const normalizedRows = normalizeImportedRows(rows);
      if (!normalizedRows.length) {
        throw new Error("Não encontrei linhas válidas para importar neste arquivo.");
      }

      await apiFetch("/api/v1/imports/preview", {
        method: "POST",
        body: JSON.stringify({ entity: "products", rows: normalizedRows }),
      });

      const result = await apiFetch<{ created: number; updated: number; message: string }>("/api/v1/imports/commit", {
        method: "POST",
        body: JSON.stringify({ entity: "products", rows: normalizedRows }),
      });

      await loadProducts();
      setMessage(`Importação concluída. ${result.created} criados e ${result.updated} atualizados.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao importar estoque.");
    } finally {
      setImporting(false);
    }
  };

  const computedPrice = Number((Number(form.cost || 0) * (1 + Number(form.margin || 0) / 100)).toFixed(2));
  const previewSku = editingId ? form.code : buildPreviewSku(form.name, form.size);

  return (
    <Layout>
      <AppPage title="Produtos" subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}>
        {message && <StatusBanner tone="success">{message}</StatusBanner>}
        {errorMessage && <StatusBanner tone="error">{errorMessage}</StatusBanner>}

        <SectionCard className="!p-3 md:!p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3">
              <Search className="h-5 w-5 text-[#b78b93]" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nome, SKU ou tamanho..." className="w-full bg-transparent text-white outline-none placeholder:text-[#8e6c74]" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3 text-white outline-none">
              <option>Todas categorias</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} type="file" accept=".csv,.txt,.xml" className="hidden" onChange={handleFileChange} />
              <button type="button" onClick={exportStock} className="inline-flex items-center gap-2 rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-5 py-3 font-semibold text-[#f7df78]">
                <Download className="h-5 w-5" /> Baixar Estoque
              </button>
              <button type="button" onClick={handleImportClick} disabled={importing} className="inline-flex items-center gap-2 rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-5 py-3 font-semibold text-[#f7df78] disabled:opacity-60">
                <Upload className="h-5 w-5" /> {importing ? "Importando..." : "Upload CSV / XML"}
              </button>
              <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[#d8b35a] px-6 py-3 font-semibold text-[#261014]">
                <Plus className="h-5 w-5" /> Novo Produto
              </button>
            </div>
          )}
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <MetricCard title="Total de SKUs" value={String(filteredProducts.length)} accent="text-[#efcf72]" />
          <MetricCard title="Estoque Baixo" value={String(lowStockCount)} accent="text-[#f0b028]" />
          <MetricCard title="Sem Estoque" value={String(outOfStockCount)} accent="text-[#ff8d95]" />
          <MetricCard title="Parados +120 dias" value={String(stalledProducts.length)} accent="text-[#ffb86b]" />
          <MetricCard title="Valor em Estoque" value={formatCurrency(totalStockValue)} accent="text-[#efcf72]" />
        </div>

        <SectionCard title="Catálogo e posição de estoque" description="Visual limpo para consulta, manutenção de SKU e leitura rápida do status operacional.">
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#24040d]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-sm">
              <thead>
                <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#b78b93]">
                  <th className="px-4 py-3.5">SKU</th>
                  <th className="px-4 py-3.5">Nome</th>
                  <th className="px-4 py-3.5">Tamanho</th>
                  <th className="px-4 py-3.5">Categoria</th>
                  <th className="px-4 py-3.5">Preço Venda</th>
                  <th className="px-4 py-3.5">Estoque</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Parado</th>
                  <th className="px-4 py-3.5">Últ. alt. estoque</th>
                  <th className="px-4 py-3.5">Últ. alt. preço</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-[#c6a9ae]">Carregando produtos...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-[#c6a9ae]">Nenhum produto encontrado.</td></tr>
                ) : filteredProducts.map((product) => {
                  const status = deriveStatus(product);
                  const stalled = (product.stalledDays || 0) >= 120 && product.stock > 0;
                  return (
                    <tr key={product.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                      <td className="px-4 py-4 text-[#d3adb6]">{product.code}</td>
                      <td className="px-4 py-4 font-semibold text-white">
                        <div>{product.name}</div>
                        {product.ean && <div className="mt-1 text-xs text-[#a77b88]">EAN: {product.ean}</div>}
                      </td>
                      <td className="px-4 py-4"><span className="rounded-md bg-[#7f5b2f] px-2.5 py-1 text-xs font-semibold text-[#efcf72]">{product.size}</span></td>
                      <td className="px-4 py-4"><span className="rounded-md bg-[#5a1c2b] px-2.5 py-1 text-xs text-[#dbb2bb]">{product.category}</span></td>
                      <td className="px-4 py-4 font-bold text-[#efcf72]">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-4">{product.stock} un</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Normal" ? "bg-[#163b24] text-[#4ce08a]" : status === "Baixo" ? "bg-[#4f3b10] text-[#f0b028]" : "bg-[#4d1724] text-[#ff7c84]"}`}>{status}</span>
                      </td>
                      <td className="px-4 py-4">
                        {stalled ? (
                          <span className="rounded-full bg-[#5a3215] px-3 py-1 text-xs font-semibold text-[#ffb86b]">{product.stalledDays} dias</span>
                        ) : (
                          <span className="text-[#9d7a82]">{product.stalledDays ? `${product.stalledDays} dias` : "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div>{formatDateTime(product.lastStockChangedAt)}</div>
                        <div className="mt-1 text-[#a77b88]">{product.lastStockChangedBy || "—"}</div>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div>{formatDateTime(product.lastPriceChangedAt)}</div>
                        <div className="mt-1 text-[#a77b88]">{product.lastPriceChangedBy || "—"}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button type="button" onClick={() => handleEdit(product)} className="text-[#e0c4ca]"><Edit2 className="h-4 w-4" /></button>
                          <button type="button" onClick={() => handleDelete(product.id)} className="text-[#d8a4af]"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </SectionCard>

        {showForm && isAdmin && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[24px] border border-white/10 bg-[#24040d] p-4 md:p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{editingId ? "Editar Produto" : "Novo Produto"}</h2>
                <button type="button" onClick={resetForm} className="text-[#d3adb6]"><X className="h-6 w-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-[#c6a9ae]">Nome do Produto *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Legging Compressão Pro" className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none placeholder:text-[#8e6c74]" required />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-[#c6a9ae]">SKU</label>
                    <input value={previewSku} readOnly className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-[#c6a9ae]">Categoria</label>
                    <select value={form.category} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                      {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-[#c6a9ae]">Tamanho</label>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => (
                      <button key={size} type="button" onClick={() => setForm({ ...form, size })} className={`rounded-xl border px-4 py-3 md:px-5 ${form.size === size ? "border-[#ad8645] bg-[#7f5b2f] font-semibold text-[#efcf72]" : "border-[#5b2534] bg-[#310815] text-[#d1b1b8]"}`}>{size}</button>
                    ))}
                  </div>
                  {isClothingCategory(form.category) && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm text-[#c6a9ae]">Tamanho extra de roupa</label>
                      <input
                        value={isCustomClothingSize ? form.size : ""}
                        onChange={(e) => setForm({ ...form, size: e.target.value.trim() || "M" })}
                        placeholder="Ex.: X1, X2, EXG, G1"
                        className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none placeholder:text-[#8e6c74]"
                      />
                      <p className="mt-2 text-xs text-[#a98a91]">Use essa caixa somente quando surgir um tamanho de roupa fora do padrão fixo.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Custo">
                    <DynamicNumberInput decimals value={form.cost} onValueChange={(value) => setForm({ ...form, cost: value })} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" required />
                  </Field>
                  <Field label="Margem %">
                    <DynamicNumberInput decimals value={form.margin} onValueChange={(value) => setForm({ ...form, margin: value })} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" required />
                  </Field>
                  <Field label="Estoque Inicial">
                    <DynamicNumberInput value={form.stock} onValueChange={(value) => setForm({ ...form, stock: value })} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" required />
                  </Field>
                  <Field label="Estoque Mínimo">
                    <DynamicNumberInput value={form.minStock} onValueChange={(value) => setForm({ ...form, minStock: value })} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" required />
                  </Field>
                </div>

                <div className="rounded-2xl border border-[#6a3f1f] bg-[#311017] p-5">
                  <p className="text-sm text-[#c6a9ae]">Preço de venda calculado</p>
                  <p className="mt-2 text-2xl font-bold text-[#efcf72]">{formatCurrency(computedPrice)}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 font-semibold text-[#ead7dc]">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn-gold px-6 py-4 disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar Produto"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppPage>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-[#c6a9ae]">{label}</label>
      {children}
    </div>
  );
}
