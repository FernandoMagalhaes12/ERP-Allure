import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { Search, UploadCloud, X } from "lucide-react";
import type { Product, StockMovement } from "@shared/api";
import { apiFetch, getAuthUser } from "@/lib/api";
import DynamicNumberInput from "@/components/DynamicNumberInput";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getStatus(product: Product) {
  if (product.stock <= 0) return "Sem estoque";
  if (product.stock <= product.minStock) return "Baixo";
  return "Normal";
}

export default function Estoque() {
  const user = getAuthUser();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<"posicao" | "movimentacoes">("posicao");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [form, setForm] = useState({ productId: "", type: "input", quantity: 1, reason: "Reposição de estoque" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [productData, movementData] = await Promise.all([
        apiFetch<Product[]>("/api/v1/products"),
        apiFetch<StockMovement[]>("/api/v1/stock/movements"),
      ]);
      setProducts(productData);
      setMovements(movementData);
      if (!form.productId && productData[0]) setForm((current) => ({ ...current, productId: productData[0].id }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const filteredMovements = useMemo(() => {
    return movements.filter(
      (movement) =>
        (movement.productName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        movement.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [movements, searchQuery]);

  const totalStockValue = filteredProducts.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const totalUnits = filteredProducts.reduce((sum, product) => sum + product.stock, 0);
  const totalMovements = filteredMovements.length;

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch("/api/v1/stock/movements", {
      method: "POST",
      body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
    });
    setShowMovementForm(false);
    await loadData();
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-[34px] font-bold text-white">Estoque e Movimentações</h1>
          <p className="text-sm text-[#a77b88]">Posição de estoque e histórico operacional em tempo real.</p>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-3 border-b border-[#4a1f2d] pb-2 flex-wrap">
            <button type="button" onClick={() => setTab("posicao")} className={`rounded-2xl border px-5 py-3 ${tab === "posicao" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Posição de Estoque</button>
            <button type="button" onClick={() => setTab("movimentacoes")} className={`rounded-2xl border px-5 py-3 ${tab === "movimentacoes" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Movimentações</button>
          </div>
          {isAdmin && (
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={() => setShowMovementForm(true)} className="inline-flex items-center gap-2 rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-6 py-3 font-semibold text-[#f7df78]">
                <UploadCloud className="h-5 w-5" /> Lançar Movimentação
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3 max-w-[430px]">
          <Search className="h-5 w-5 text-[#8f6774]" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={tab === "posicao" ? "Buscar produto..." : "Buscar produto ou motivo..."} className="w-full bg-transparent text-white outline-none placeholder:text-[#7f5d67]" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <InfoCard title="Total de SKUs" value={String(filteredProducts.length)} />
          <InfoCard title="Valor em Estoque" value={formatCurrency(totalStockValue)} />
          <InfoCard title="Unidades Totais" value={`${totalUnits} un`} />
          <InfoCard title="Movimentações filtradas" value={String(totalMovements)} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#3f1623] bg-[#24040d]">
          <div className="overflow-x-auto">
            {tab === "posicao" ? (
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#9a717d]">
                    <th className="px-4 py-4">SKU</th>
                    <th className="px-4 py-4">Produto</th>
                    <th className="px-4 py-4">Categoria</th>
                    <th className="px-4 py-4">Custo</th>
                    <th className="px-4 py-4">Estoque</th>
                    <th className="px-4 py-4">Estoque Mínimo</th>
                    <th className="px-4 py-4">Valor</th>
                    <th className="px-4 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-[#a77b88]">Carregando estoque...</td></tr>
                  ) : filteredProducts.map((product) => {
                    const status = getStatus(product);
                    const percentage = product.minStock > 0 ? Math.min(100, Math.round((product.stock / Math.max(product.minStock * 2, 1)) * 100)) : 100;
                    return (
                      <tr key={product.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                        <td className="px-4 py-4 text-[#b68a97]">{product.code}</td>
                        <td className="px-4 py-4 font-semibold text-white">{product.name}</td>
                        <td className="px-4 py-4 text-[#c99bab]">{product.category}</td>
                        <td className="px-4 py-4">{formatCurrency(product.cost)}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-[70px] rounded-full bg-[#47212c]"><div className={`h-1.5 rounded-full ${status === "Normal" ? "bg-[#39d57b]" : status === "Baixo" ? "bg-[#f0b028]" : "bg-[#ff6b6b]"}`} style={{ width: `${percentage}%` }} /></div>
                            <span>{product.stock}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">{product.minStock}</td>
                        <td className="px-4 py-4">{formatCurrency(product.stock * product.cost)}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Normal" ? "bg-[#163b24] text-[#4ce08a]" : status === "Baixo" ? "bg-[#4f3b10] text-[#f0b028]" : "bg-[#4d1724] text-[#ff7c84]"}`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#9a717d]">
                    <th className="px-4 py-4">Data</th>
                    <th className="px-4 py-4">Produto</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Quantidade</th>
                    <th className="px-4 py-4">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-[#a77b88]">Carregando movimentações...</td></tr>
                  ) : filteredMovements.map((movement) => (
                    <tr key={movement.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                      <td className="px-4 py-4">{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-4 font-semibold text-white">{movement.productName}</td>
                      <td className="px-4 py-4">{movement.type === "input" ? "Entrada" : movement.type === "output" ? "Saída" : "Ajuste"}</td>
                      <td className="px-4 py-4">{movement.quantity}</td>
                      <td className="px-4 py-4 text-[#c99bab]">{movement.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showMovementForm && isAdmin && (
          <Modal title="Lançar Movimentação" onClose={() => setShowMovementForm(false)}>
            <form onSubmit={handleMovementSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none md:col-span-2">
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}
              </select>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
                <option value="input">Entrada</option>
                <option value="output">Saída</option>
                <option value="adjustment">Ajuste</option>
              </select>
              <DynamicNumberInput min={1} value={form.quantity} onValueChange={(value) => setForm({ ...form, quantity: value })} className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" />
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Motivo da movimentação" className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none md:col-span-2" />
              <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-2">
                <button type="button" onClick={() => setShowMovementForm(false)} className="rounded-2xl bg-[#462830] px-6 py-4 font-semibold text-[#ead7dc]">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-[#f1dc86] px-6 py-4 font-semibold text-[#261014]">Salvar Movimentação</button>
              </div>
            </form>
          </Modal>
        )}

      </div>
    </Layout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-[24px] border border-[#5b2534] bg-[#24040d] p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[22px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-[#b78a99]"><X className="h-6 w-6" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
      <p className="text-sm text-[#936a78]">{title}</p>
      <p className="mt-3 text-[22px] font-bold text-[#f7df78]">{value}</p>
    </div>
  );
}
