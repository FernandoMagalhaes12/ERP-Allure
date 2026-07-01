import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, getAuthUser } from "@/lib/api";
import type { AccountantSummary, Product, Sale } from "@shared/api";
import { BarChart3, Download, FileUp, FileText, Package, Receipt, ShieldCheck, ShoppingCart, TrendingUp, Upload } from "lucide-react";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8;") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  downloadText(filename, "\uFEFF" + csv, "text/csv;charset=utf-8;");
}

function parseNfeXml(raw: string) {
  const xml = new DOMParser().parseFromString(raw, "application/xml");
  const products = Array.from(xml.querySelectorAll("det"));
  return products.map((det, index) => {
    const prod = det.querySelector("prod");
    const code = prod?.querySelector("cProd")?.textContent?.trim() || `XML-${index + 1}`;
    const name = prod?.querySelector("xProd")?.textContent?.trim() || `Item ${index + 1}`;
    const ncm = prod?.querySelector("NCM")?.textContent?.trim() || "";
    const cfop = prod?.querySelector("CFOP")?.textContent?.trim() || "";
    const unit = prod?.querySelector("uCom")?.textContent?.trim() || "UN";
    const quantity = Number(prod?.querySelector("qCom")?.textContent?.replace(",", ".") || 0);
    const cost = Number(prod?.querySelector("vUnCom")?.textContent?.replace(",", ".") || 0);
    const total = Number(prod?.querySelector("vProd")?.textContent?.replace(",", ".") || 0);
    return {
      code,
      name,
      category: ncm ? `NCM ${ncm}` : "Importado XML",
      size: unit,
      cost,
      price: cost,
      stock: quantity,
      quantity,
      total,
      notes: cfop ? `CFOP ${cfop}` : "Nota fiscal importada via XML",
    };
  });
}

function parseImportInput(raw: string) {
  const source = raw.trim();
  if (!source) return [] as Record<string, string | number>[];
  if (source.startsWith("<")) {
    return parseNfeXml(source);
  }
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const lines = source.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      const values = line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
  }
}

export default function Relatorios() {
  const user = getAuthUser();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<"gerencial" | "importacao" | "contador">("gerencial");
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accountantSummary, setAccountantSummary] = useState<AccountantSummary | null>(null);
  const [period, setPeriod] = useState("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [importEntity, setImportEntity] = useState("products");
  const [importJson, setImportJson] = useState('[{"code":"SKU-001","name":"Produto Exemplo","category":"Moda","size":"M","cost":30,"price":59.9,"stock":10}]');
  const [importStatus, setImportStatus] = useState("");
  const [importFileName, setImportFileName] = useState("");

  const loadAll = async () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const [salesData, productsData, accountantData] = await Promise.all([
      apiFetch<Sale[]>(`/api/v1/sales${params.toString() ? `?${params.toString()}` : ""}`),
      apiFetch<Product[]>("/api/v1/products"),
      apiFetch<AccountantSummary>("/api/v1/accountant/summary"),
    ]);

    setSales(salesData || []);
    setProducts(productsData || []);
    setAccountantSummary(accountantData);
  };

  useEffect(() => {
    loadAll().catch(() => {
      setSales([]);
      setProducts([]);
      setAccountantSummary(null);
    });
  }, [startDate, endDate]);

  const filteredSales = useMemo(() => {
    const days = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return sales.filter((sale) => new Date(sale.createdAt) >= cutoff);
  }, [sales, period]);

  const stats = useMemo(() => {
    const revenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const orders = filteredSales.length;
    const averageTicket = orders ? revenue / orders : 0;
    const productsSold = filteredSales.reduce((sum, sale) => sum + (sale.items || []).reduce((acc, item) => acc + item.quantity, 0), 0);
    const cashbackDistributed = filteredSales.reduce((sum, sale) => sum + Number(sale.cashbackEarned || 0), 0);
    return { revenue, orders, averageTicket, productsSold, cashbackDistributed };
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const current = totals.get(item.productId) || { name: item.productName || "Produto", qty: 0, revenue: 0 };
        current.qty += item.quantity;
        current.revenue += item.totalPrice || 0;
        totals.set(item.productId, current);
      });
    });
    return Array.from(totals.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredSales]);

  const sellerRanking = useMemo(() => {
    const sellers = new Map<string, { name: string; sales: number; revenue: number }>();
    filteredSales.forEach((sale) => {
      const key = sale.sellerId || sale.userId || sale.sellerName || "sem-vendedor";
      const current = sellers.get(key) || { name: sale.sellerName || "Sem vendedor", sales: 0, revenue: 0 };
      current.sales += 1;
      current.revenue += sale.total;
      sellers.set(key, current);
    });
    return Array.from(sellers.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  const categoryPerformance = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]));
    const categories = new Map<string, { category: string; revenue: number; qty: number }>();
    filteredSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const fallbackCategory = productMap.get(item.productId)?.category || "Sem categoria";
        const current = categories.get(fallbackCategory) || { category: fallbackCategory, revenue: 0, qty: 0 };
        current.revenue += item.totalPrice || 0;
        current.qty += item.quantity;
        categories.set(fallbackCategory, current);
      });
    });
    return Array.from(categories.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products]);

  const exportReport = () => {
    downloadCsv(`relatorios-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Indicador", "Valor"],
      ["Receita", stats.revenue.toFixed(2)],
      ["Pedidos", String(stats.orders)],
      ["Ticket Médio", stats.averageTicket.toFixed(2)],
      ["Itens Vendidos", String(stats.productsSold)],
      ["Cashback Distribuído", stats.cashbackDistributed.toFixed(2)],
      [],
      ["Produtos Mais Vendidos"],
      ["Produto", "Quantidade", "Receita"],
      ...topProducts.map((item) => [item.name, String(item.qty), item.revenue.toFixed(2)]),
    ]);
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    const content = await file.text();
    setImportJson(content);
    setImportFileName(file.name);
    if (file.name.toLowerCase().endsWith(".xml")) {
      setImportEntity("products");
      setImportStatus("XML carregado. Revise os itens extraídos da nota e confirme a importação.");
      return;
    }
    setImportStatus(`Arquivo ${file.name} carregado. Revise o conteúdo e confirme a importação.`);
  };

  const runImport = async () => {
    try {
      setImportStatus("Validando importação...");
      const rows = parseImportInput(importJson);
      if (!rows.length) throw new Error("Nenhuma linha válida foi identificada. Cole JSON ou CSV com cabeçalho.");
      await apiFetch("/api/v1/imports/preview", { method: "POST", body: JSON.stringify({ entity: importEntity, rows }) });
      const result = await apiFetch<{ created: number; updated: number; message: string }>("/api/v1/imports/commit", { method: "POST", body: JSON.stringify({ entity: importEntity, rows }) });
      setImportStatus(`${result.message} Criados: ${result.created}. Atualizados: ${result.updated}.`);
      await loadAll();
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Falha ao importar dados.");
    }
  };

  const exportFiscalBundle = async () => {
    const data = await apiFetch<any>("/api/v1/accountant/exports/fiscal");
    downloadText(`exportacao-fiscal-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8;");
  };

  const downloadInvoiceFile = (id: string, kind: "pdf" | "xml") => {
    window.open(`/api/v1/fiscal/invoices/${id}/${kind}`, "_blank");
  };

  const emitInvoiceFromSale = async (sale: any) => {
    const invoice = await apiFetch<any>("/api/v1/fiscal/invoice", {
      method: "POST",
      body: JSON.stringify({
        saleId: sale.id,
        clientName: sale.customerName || sale.clientName || "Consumidor Final",
        amount: Number(sale.total || 0),
        type: "NFC-e",
        operationNature: "Venda de mercadoria",
      }),
    });
    window.open(`/api/v1/fiscal/invoices/${invoice.id}/pdf`, "_blank");
    await loadAll();
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[34px] font-bold text-white">Relatórios e Governança</h1>
            <p className="text-sm text-[#c6a9ae]">Gerencial, importação e portal do contador no mesmo fluxo.</p>
          </div>
          {isAdmin && tab === "gerencial" && (
            <div className="flex flex-wrap gap-3">
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-2xl border border-[#5b2534] bg-[#24040d] px-5 py-3 text-white outline-none">
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </select>
              <button onClick={exportReport} className="inline-flex items-center gap-2 rounded-2xl bg-[#d8b35a] px-5 py-3 font-semibold text-[#261014]">
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-[#5b2534] pb-2">
          <button onClick={() => setTab("gerencial")} className={`rounded-2xl border px-5 py-3 ${tab === "gerencial" ? "border-[#a57d3d] bg-[#6b4b20] font-semibold text-[#efcf72]" : "border-[#5b2534] bg-[#24040d] text-[#c6a9ae]"}`}>Gerencial</button>
          <button onClick={() => setTab("importacao")} className={`rounded-2xl border px-5 py-3 ${tab === "importacao" ? "border-[#a57d3d] bg-[#6b4b20] font-semibold text-[#efcf72]" : "border-[#5b2534] bg-[#24040d] text-[#c6a9ae]"}`}>Importação</button>
          <button onClick={() => setTab("contador")} className={`rounded-2xl border px-5 py-3 ${tab === "contador" ? "border-[#a57d3d] bg-[#6b4b20] font-semibold text-[#efcf72]" : "border-[#5b2534] bg-[#24040d] text-[#c6a9ae]"}`}>Portal do Contador</button>
        </div>

        {tab === "gerencial" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-[520px]">
              <div>
                <label className="mb-2 block text-sm text-[#c6a9ae]">Data inicial</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3 text-white outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-[#c6a9ae]">Data final</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3 text-white outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={<TrendingUp className="h-5 w-5 text-[#53e28f]" />} title="Receita" value={formatCurrency(stats.revenue)} accent="text-[#53e28f]" />
              <MetricCard icon={<ShoppingCart className="h-5 w-5 text-[#efcf72]" />} title="Pedidos" value={String(stats.orders)} accent="text-[#efcf72]" />
              <MetricCard icon={<BarChart3 className="h-5 w-5 text-[#d8b35a]" />} title="Ticket Médio" value={formatCurrency(stats.averageTicket)} accent="text-[#d8b35a]" />
              <MetricCard icon={<Package className="h-5 w-5 text-[#ff9fad]" />} title="Itens Vendidos" value={String(stats.productsSold)} accent="text-[#ff9fad]" />
              <MetricCard icon={<ShieldCheck className="h-5 w-5 text-[#8cc8ff]" />} title="Cashback" value={formatCurrency(stats.cashbackDistributed)} accent="text-[#8cc8ff]" />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Produtos Mais Vendidos">
                <SimpleTable headers={["Produto", "Qtd", "Receita"]} rows={topProducts.map((item) => [item.name, item.qty, formatCurrency(item.revenue)])} empty="Sem vendas no período selecionado." />
              </Panel>
              <Panel title="Ranking de Vendedores">
                <SimpleTable headers={["Vendedor", "Vendas", "Receita"]} rows={sellerRanking.map((item) => [item.name, item.sales, formatCurrency(item.revenue)])} empty="Sem dados de vendedores no período selecionado." />
              </Panel>
            </div>

            <Panel title="Desempenho por Categoria">
              {categoryPerformance.length === 0 ? <EmptyState text="Sem categorias com vendas no período selecionado." /> : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {categoryPerformance.map((item) => (
                    <div key={item.category} className="rounded-2xl border border-[#5b2534] bg-[#2d0913] p-4">
                      <p className="font-semibold text-white">{item.category}</p>
                      <p className="mt-2 text-sm text-[#b78b93]">{item.qty} itens vendidos</p>
                      <p className="mt-3 text-xl font-bold text-[#efcf72]">{formatCurrency(item.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}


        {tab === "importacao" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <Panel title="Importação rápida">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-[#c6a9ae]">Entidade</label>
                  <select value={importEntity} onChange={(e) => setImportEntity(e.target.value)} className="w-full rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3 text-white outline-none">
                    <option value="products">Produtos</option>
                    <option value="clients">Clientes</option>
                    <option value="suppliers">Fornecedores</option>
                    <option value="stock">Estoque</option>
                  </select>
                </div>
                <div className="rounded-2xl border border-[#5b2534] bg-[#2d0913] p-4 text-sm text-[#d7b0b8] space-y-3">
                  <p>Aceita <strong>JSON</strong>, <strong>CSV com cabeçalho</strong> e <strong>XML de nota fiscal</strong>. Exemplo CSV: <code>code;name;category;size;cost;price;stock</code></p>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#7a4f37] bg-[#3a1823] px-4 py-3 font-semibold text-[#f7df78]">
                    <Upload className="h-4 w-4" /> Anexar arquivo
                    <input type="file" accept=".json,.csv,.xml,text/csv,application/json,text/xml,application/xml" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} />
                  </label>
                  {importFileName && <p className="text-xs text-[#efcf72]">Arquivo anexado: {importFileName}</p>}
                </div>
                <button onClick={runImport} className="inline-flex items-center gap-2 rounded-2xl bg-[#d8b35a] px-5 py-3 font-semibold text-[#261014]"><FileUp className="h-4 w-4" /> Validar e importar</button>
                {importStatus && <div className="rounded-2xl border border-[#395a46] bg-[#173325] px-4 py-3 text-sm text-[#98f0bd]">{importStatus}</div>}
              </div>
            </Panel>
            <Panel title="Conteúdo de entrada">
              <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} className="min-h-[340px] w-full rounded-2xl border border-[#5b2534] bg-[#24040d] px-4 py-3 font-mono text-sm text-white outline-none" />
            </Panel>
          </div>
        )}

        {tab === "contador" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<TrendingUp className="h-5 w-5 text-[#53e28f]" />} title="Cashback em aberto" value={formatCurrency(accountantSummary?.cashbackBalance || 0)} accent="text-[#53e28f]" />
              <MetricCard icon={<Package className="h-5 w-5 text-[#efcf72]" />} title="Últimas compras" value={String(accountantSummary?.recentPurchases?.length || 0)} accent="text-[#efcf72]" />
              <MetricCard icon={<ShoppingCart className="h-5 w-5 text-[#d8b35a]" />} title="Últimas vendas" value={String(accountantSummary?.recentSales?.length || 0)} accent="text-[#d8b35a]" />
              <MetricCard icon={<ShieldCheck className="h-5 w-5 text-[#8cc8ff]" />} title="Docs fiscais" value={String(accountantSummary?.fiscalDocuments?.length || 0)} accent="text-[#8cc8ff]" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={exportFiscalBundle} className="inline-flex items-center gap-2 rounded-2xl bg-[#d8b35a] px-5 py-3 font-semibold text-[#261014]"><Download className="h-4 w-4" /> Exportar pacote fiscal</button>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Documentos fiscais recentes">
                {((accountantSummary?.fiscalDocuments || []).length === 0) ? <EmptyState text="Sem documentos fiscais." /> : (
                  <div className="space-y-3">
                    {(accountantSummary?.fiscalDocuments || []).map((doc: any) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#5b2534] bg-[#2d0913] p-4">
                        <div>
                          <p className="font-semibold text-white">Nota {doc.number} · {doc.clientName}</p>
                          <p className="text-sm text-[#b78b93]">{new Date(doc.emissionDate).toLocaleDateString("pt-BR")} · {formatCurrency(Number(doc.amount || 0))} · {doc.fiscalStatus}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => downloadInvoiceFile(doc.id, "pdf")} className="inline-flex items-center gap-2 rounded-xl border border-[#7a4f37] bg-[#3a1823] px-4 py-2 text-sm font-semibold text-[#f7df78]"><FileText className="h-4 w-4" /> PDF</button>
                          <button onClick={() => downloadInvoiceFile(doc.id, "xml")} className="inline-flex items-center gap-2 rounded-xl border border-[#24553a] bg-[#173726] px-4 py-2 text-sm font-semibold text-[#8ef0b6]"><Download className="h-4 w-4" /> XML</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel title="Financeiro em aberto">
                <SimpleTable headers={["Tipo", "Descrição", "Valor", "Vencimento", "Status"]} rows={(accountantSummary?.openFinancial || []).map((item: any) => [item.type, item.description, formatCurrency(Number(item.amount || 0)), new Date(item.dueDate).toLocaleDateString("pt-BR"), item.status])} empty="Sem lançamentos abertos." />
              </Panel>
            </div>
            <Panel title="Emitir nota a partir das vendas recentes">
              {((accountantSummary?.recentSales || []).length === 0) ? <EmptyState text="Sem vendas recentes para emissão." /> : (
                <div className="space-y-3">
                  {(accountantSummary?.recentSales || []).map((sale: any) => (
                    <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#5b2534] bg-[#2d0913] p-4">
                      <div>
                        <p className="font-semibold text-white">Venda {sale.id.slice(0, 8)} · {sale.customerName || "Consumidor Final"}</p>
                        <p className="text-sm text-[#b78b93]">{new Date(sale.createdAt).toLocaleString("pt-BR")} · {formatCurrency(Number(sale.total || 0))}</p>
                      </div>
                      <button onClick={() => emitInvoiceFromSale(sale)} className="inline-flex items-center gap-2 rounded-xl bg-[#d8b35a] px-4 py-2 text-sm font-semibold text-[#261014]"><Receipt className="h-4 w-4" /> Emitir nota PDF</button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </Layout>
  );
}

function MetricCard({ icon, title, value, accent }: { icon: React.ReactNode; title: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#5b2534] bg-[#24040d] p-5 transition-colors hover:border-[#805664]">
      <div className="flex items-center gap-2 text-[#b78b93]">{icon}<span>{title}</span></div>
      <p className={`mt-4 text-[22px] font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#5b2534] bg-[#24040d] p-5">
      <h2 className="mb-4 text-xl font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-[#b78b93]">{text}</div>;
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: Array<Array<string | number>>; empty: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#3b1b26] text-left text-[#b78b93]">
          {headers.map((header) => <th key={header} className="pb-3">{header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-[#31121d] text-[#e6d2d8]">
            {row.map((cell, cellIndex) => <td key={cellIndex} className="py-3 pr-3">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
