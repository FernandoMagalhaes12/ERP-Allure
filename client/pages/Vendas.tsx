import Layout from "@/components/Layout";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Search, Tag, Trash2, Wallet } from "lucide-react";
import type { Client, Product, Sale, SaleItem } from "@shared/api";
import { apiFetch, getAuthUser } from "@/lib/api";
import DynamicNumberInput from "@/components/DynamicNumberInput";

const paymentLabels = {
  money: "Dinheiro",
  pix: "Pix",
  debit_card: "Débito",
  credit_card: "Crédito",
} as const;

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Vendas() {
  const navigate = useNavigate();
  const user = getAuthUser();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<"pdv" | "historico">("pdv");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"money" | "pix" | "credit_card" | "debit_card">("pix");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashbackRedeem, setCashbackRedeem] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [cashbackPercent, setCashbackPercent] = useState(7.5);
  const [cashbackEnabled, setCashbackEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId) || null, [clients, selectedClientId]);

  const loadAll = async () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const [productData, salesData, clientData, contextData] = await Promise.all([
      apiFetch<Product[]>("/api/v1/products"),
      apiFetch<Sale[]>(`/api/v1/sales${params.toString() ? `?${params.toString()}` : ""}`),
      apiFetch<Client[]>("/api/v1/clients"),
      apiFetch<{ cashbackEnabled: boolean; cashbackPercent: number }>("/api/v1/sales/context"),
    ]);
    setProducts(productData);
    setSales(salesData);
    setClients(clientData);
    setCashbackEnabled(Boolean(contextData.cashbackEnabled));
    setCashbackPercent(Number(contextData.cashbackPercent || 0));
  };

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [startDate, endDate]);

  useEffect(() => {
    if (selectedClient) {
      setClientName(selectedClient.name);
      setCashbackRedeem((current) => Math.min(current, selectedClient.availableCashback || 0));
    }
  }, [selectedClient]);

  const suggestions = useMemo(() => {
    const term = searchProduct.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((product) => product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term))
      .slice(0, 6);
  }, [products, searchProduct]);

  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const effectiveDiscount = discountPercent > 0 ? Number((subtotal * discountPercent / 100).toFixed(2)) : discountValue;
  const redeemDiscount = Number((cashbackRedeem || 0).toFixed(2));
  const total = Math.max(0, Number((subtotal - effectiveDiscount - redeemDiscount).toFixed(2)));
  const projectedCashback = selectedClient && cashbackEnabled ? Number((total * (cashbackPercent || 0) / 100).toFixed(2)) : 0;

  useEffect(() => {
    setPaidAmount(total);
  }, [total]);

  const addProduct = (product: Product) => {
    const quantity = 1;
    setItems((current) => {
      const index = current.findIndex((item) => item.productId === product.id);
      if (index >= 0) {
        const next = [...current];
        const newQty = next[index].quantity + quantity;
        next[index] = {
          ...next[index],
          quantity: newQty,
          totalPrice: Number(((next[index].unitPrice || 0) * newQty).toFixed(2)),
        };
        return next;
      }
      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.price,
          totalPrice: Number((product.price * quantity).toFixed(2)),
        },
      ];
    });
    setSearchProduct("");
    setTab("pdv");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const findProductBySearch = (rawValue: string) => {
    const term = rawValue.trim().toLowerCase();
    if (!term) return null;
    const exactCode = products.find((product) => product.code.trim().toLowerCase() === term);
    if (exactCode) return exactCode;
    const exactName = products.find((product) => product.name.trim().toLowerCase() === term);
    if (exactName) return exactName;
    if (suggestions.length === 1) return suggestions[0];
    return null;
  };

  const handleSearchEnter = () => {
    const product = findProductBySearch(searchProduct);
    if (!product) {
      setErrorMessage("Nenhum produto correspondente foi encontrado para a leitura.");
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    addProduct(product);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const qty = Math.max(1, quantity || 1);
    const next = [...items];
    next[index] = {
      ...next[index],
      quantity: qty,
      totalPrice: Number(((next[index].unitPrice || 0) * qty).toFixed(2)),
    };
    setItems(next);
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const clearSale = () => {
    setItems([]);
    setClientName("");
    setSelectedClientId("");
    setSearchProduct("");
    setDiscountValue(0);
    setDiscountPercent(0);
    setCashbackRedeem(0);
    setPaidAmount(0);
    setPaymentMethod("pix");
  };

  const syncDiscountValue = (value: number) => {
    const nextValue = Math.max(0, value || 0);
    setDiscountValue(nextValue);
    if (subtotal > 0) setDiscountPercent(Number(((nextValue / subtotal) * 100).toFixed(2)));
    else setDiscountPercent(0);
  };

  const syncDiscountPercent = (percent: number) => {
    const nextPercent = Math.max(0, percent || 0);
    setDiscountPercent(nextPercent);
    setDiscountValue(Number((subtotal * nextPercent / 100).toFixed(2)));
  };

  const handleCompleteSale = async () => {
    setSuccessMessage("");
    setErrorMessage("");

    if (!items.length) {
      setErrorMessage("Adicione itens ao carrinho.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/v1/sales", {
        method: "POST",
        body: JSON.stringify({
          clientId: selectedClientId || null,
          clientName: clientName || null,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          discount: effectiveDiscount,
          cashbackRedeemed: redeemDiscount,
          cashbackPercentOverride: cashbackPercent,
          paymentMethod,
        }),
      });
      await loadAll();
      clearSale();
      setSuccessMessage("Venda finalizada com sucesso. Cashback e cliente foram atualizados.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao finalizar venda");
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = () => {
    downloadCsv(`historico-vendas-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Data", "Cliente", "Vendedor", "Pagamento", "Itens", "Cashback usado", "Cashback gerado", "Total"],
      ...sales.map((sale) => [
        new Date(sale.createdAt).toLocaleString("pt-BR"),
        sale.clientName || "Consumidor Final",
        sale.sellerName || "-",
        paymentLabels[sale.paymentMethod],
        String(sale.itemsCount || sale.items?.length || 0),
        formatCurrency(sale.cashbackRedeemed || 0),
        formatCurrency(sale.cashbackEarned || 0),
        formatCurrency(sale.total),
      ]),
    ]);
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[34px] font-bold text-white">Vendas e PDV</h1>
            <p className="text-sm text-[#a77b88]">Operação fluida com cliente, cashback e histórico comercial.</p>
          </div>
          <button onClick={() => navigate("/configuracoes")} className="inline-flex items-center gap-2 rounded-2xl border border-[#8b6147] bg-[#5b4321] px-4 py-3 font-semibold text-[#f7df78]">
            <Tag className="h-4 w-4" /> Impressão de etiquetas
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-[#4a1f2d] pb-3">
          <button onClick={() => setTab("pdv")} className={`rounded-2xl border px-5 py-3 ${tab === "pdv" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>PDV</button>
          <button onClick={() => setTab("historico")} className={`rounded-2xl border px-5 py-3 ${tab === "historico" ? "border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78]" : "border-[#4a1f2d] bg-[#24040d] text-[#a77b88]"}`}>Histórico</button>
        </div>

        {successMessage && <div className="rounded-2xl border border-[#395a46] bg-[#173325] px-5 py-4 text-[#98f0bd]">{successMessage}</div>}
        {errorMessage && <div className="rounded-2xl border border-[#6f2735] bg-[#32101a] px-5 py-4 text-[#ffb3c0]">{errorMessage}</div>}

        {tab === "pdv" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b78a99] mb-3">Leitura e inclusão</p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#9a717d]" />
                    <input
                      ref={searchInputRef}
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchEnter()}
                      placeholder="Digite ou bip o SKU / nome"
                      className="h-11 w-full rounded-xl border border-[#4a1f2d] bg-[#160308] pl-10 pr-4 text-white outline-none"
                    />
                  </div>
                  <button onClick={handleSearchEnter} className="rounded-xl border border-[#8b6147] bg-[#5b4321] px-4 text-[#f7df78]">Adicionar</button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {suggestions.map((product) => (
                      <button key={product.id} onClick={() => addProduct(product)} className="rounded-xl border border-[#3f1623] bg-[#1a060d] px-4 py-3 text-left hover:border-[#8b6147]">
                        <p className="font-semibold text-white">{product.name}</p>
                        <p className="text-sm text-[#a77b88]">{product.code} · {product.size} · {formatCurrency(product.price)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b78a99] mb-3">Itens do carrinho</p>
                <div className="space-y-3">
                  {items.length === 0 && <div className="rounded-xl border border-dashed border-[#4a1f2d] px-4 py-8 text-center text-[#8f6975]">Nenhum item no carrinho ainda.</div>}
                  {items.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="rounded-xl border border-[#3f1623] bg-[#18050b] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.productName}</p>
                          <p className="text-sm text-[#a77b88]">Unitário {formatCurrency(item.unitPrice || 0)}</p>
                        </div>
                        <button onClick={() => handleRemoveItem(index)} className="rounded-lg border border-[#5b2534] p-2 text-[#c895a2]"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <DynamicNumberInput min={1} value={item.quantity} onValueChange={(value) => handleQuantityChange(index, value)} className="h-10 w-24 rounded-xl border border-[#4a1f2d] bg-[#160308] px-3 text-white" />
                        <p className="text-lg font-bold text-[#f7df78]">{formatCurrency(item.totalPrice || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5 space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b78a99]">Cliente, cashback e pagamento</p>
                <div>
                  <label className="mb-2 block text-sm text-[#d0b4bc]">Cliente</label>
                  <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="h-11 w-full rounded-xl border border-[#4a1f2d] bg-[#160308] px-4 text-white">
                    <option value="">Consumidor final / sem cadastro</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                {!selectedClientId && (
                  <div>
                    <label className="mb-2 block text-sm text-[#d0b4bc]">Nome do cliente na venda</label>
                    <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-11 w-full rounded-xl border border-[#4a1f2d] bg-[#160308] px-4 text-white" placeholder="Opcional" />
                  </div>
                )}

                {selectedClient && (
                  <div className="rounded-2xl border border-[#1f4d3e] bg-[#0e241e] p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-[#13392f] p-3 text-[#8ef5cb]"><Wallet className="h-5 w-5" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">Programa de cashback</p>
                        <p className="text-sm text-[#9ed8c4]">Saldo disponível: {formatCurrency(selectedClient.availableCashback || 0)}</p>
                        {selectedClient.cashbackExpiringSoon && <p className="mt-1 text-xs text-[#fcd34d]">Há saldo expirando nos próximos dias.</p>}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm text-[#d0b4bc]">Resgatar cashback nesta venda</label>
                        <DynamicNumberInput decimals min={0} max={selectedClient.availableCashback || 0} value={cashbackRedeem} onValueChange={(value) => setCashbackRedeem(Math.max(0, Math.min(value, selectedClient.availableCashback || 0)))} className="h-11 w-full rounded-xl border border-[#2a6652] bg-[#102d25] px-4 text-white" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm text-[#d0b4bc]">% de cashback nesta venda</label>
                        <DynamicNumberInput decimals min={0} max={100} value={cashbackPercent} onValueChange={(value) => setCashbackPercent(Math.max(0, Math.min(value, 100)))} disabled={!cashbackEnabled} className="h-11 w-full rounded-xl border border-[#2a6652] bg-[#102d25] px-4 text-white disabled:opacity-50" />
                      </div>
                      <p className="md:col-span-2 text-xs text-[#9ed8c4]">Projeção de cashback gerado nesta venda: {formatCurrency(projectedCashback)} {cashbackEnabled ? `(taxa aplicada: ${cashbackPercent.toFixed(2)}%)` : "(cashback desativado na empresa)"}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm text-[#d0b4bc]">Desconto (R$)</label>
                    <DynamicNumberInput decimals min={0} value={discountValue} onValueChange={syncDiscountValue} className="h-11 w-full rounded-xl border border-[#4a1f2d] bg-[#160308] px-4 text-white" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-[#d0b4bc]">Desconto (%)</label>
                    <DynamicNumberInput decimals min={0} value={discountPercent} onValueChange={syncDiscountPercent} className="h-11 w-full rounded-xl border border-[#4a1f2d] bg-[#160308] px-4 text-white" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-[#d0b4bc]">Forma de pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="h-11 w-full rounded-xl border border-[#4a1f2d] bg-[#160308] px-4 text-white">
                    {Object.entries(paymentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>

                <div className="rounded-2xl border border-[#5b2534] bg-[#18050b] p-4 space-y-2">
                  <Row label="Subtotal" value={formatCurrency(subtotal)} />
                  <Row label="Desconto manual" value={formatCurrency(effectiveDiscount)} />
                  <Row label="Cashback resgatado" value={formatCurrency(redeemDiscount)} accent="text-[#8ef5cb]" />
                  <Row label="Total a pagar" value={formatCurrency(total)} accent="text-[#f7df78] text-xl font-bold" />
                  <Row label="Valor recebido" value={formatCurrency(paidAmount)} />
                </div>

                <button disabled={loading} onClick={handleCompleteSale} className="h-12 w-full rounded-2xl border border-[#8b6147] bg-[#5b4321] font-semibold text-[#f7df78] disabled:opacity-60">
                  {loading ? "Finalizando venda..." : "Finalizar venda"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "historico" && (
          <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3b1b26] px-5 py-4">
              <div className="flex flex-wrap gap-3">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-xl border border-[#4a1f2d] bg-[#160308] px-3 text-white" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-xl border border-[#4a1f2d] bg-[#160308] px-3 text-white" />
              </div>
              <button onClick={exportHistory} className="inline-flex items-center gap-2 rounded-xl border border-[#8b6147] bg-[#5b4321] px-4 py-2 text-[#f7df78]"><Download className="h-4 w-4" /> Exportar</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#9a717d]">
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Pagamento</th>
                    <th className="px-5 py-4">Cashback</th>
                    <th className="px-5 py-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                      <td className="px-5 py-4">{new Date(sale.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-4">{sale.clientName || "Consumidor Final"}</td>
                      <td className="px-5 py-4">{paymentLabels[sale.paymentMethod]}</td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-[#9fd4ff]">Usado: {formatCurrency(sale.cashbackRedeemed || 0)}</div>
                        <div className="text-xs text-[#8ef5cb]">Gerado: {formatCurrency(sale.cashbackEarned || 0)}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#f7df78]">{formatCurrency(sale.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Row({ label, value, accent = "text-white" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#a77b88]">{label}</span>
      <span className={accent}>{value}</span>
    </div>
  );
}
