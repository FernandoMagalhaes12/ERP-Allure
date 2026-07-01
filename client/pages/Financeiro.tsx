import Layout from "@/components/Layout";
import { AppPage, MetricCard, SectionCard, StatusBanner } from "@/components/AppChrome";
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import type { FinancialEntry, Sale, Supplier, Client } from "@shared/api";
import { apiFetch, getAuthUser } from "@/lib/api";
import DynamicNumberInput from "@/components/DynamicNumberInput";

const emptyForm = {
  type: "expense",
  description: "",
  amount: 0,
  category: "Operacional",
  status: "pending",
  dueDate: new Date().toISOString().slice(0, 10),
  paymentDate: "",
  clientId: "",
  supplierId: "",
};

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
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Financeiro() {
  const user = getAuthUser();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<"receber" | "pagar" | "fluxo">("receber");
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = async () => {
    setErrorMessage("");
    const [financialResult, salesResult, clientsResult, suppliersResult] = await Promise.allSettled([
      apiFetch<FinancialEntry[]>("/api/v1/financial/entries"),
      apiFetch<Sale[]>("/api/v1/sales"),
      apiFetch<Client[]>("/api/v1/clients"),
      apiFetch<Supplier[]>("/api/v1/suppliers"),
    ]);

    if (financialResult.status === "fulfilled") setEntries(financialResult.value || []);
    else {
      setEntries([]);
      throw financialResult.reason;
    }

    if (salesResult.status === "fulfilled") setSales(salesResult.value || []);
    else {
      setSales([]);
      throw salesResult.reason;
    }

    if (clientsResult.status === "fulfilled") setClients(clientsResult.value || []);
    else setClients([]);

    if (suppliersResult.status === "fulfilled") setSuppliers(suppliersResult.value || []);
    else setSuppliers([]);
  };

  useEffect(() => {
    loadData().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar financeiro."));
  }, []);

  const receivableRows = useMemo(() => {
    return sales.map((sale, index) => ({
      id: sale.id,
      description: `Venda #${String(index + 1).padStart(3, "0")}`,
      category: "Vendas",
      dueDate: new Date(sale.createdAt).toLocaleDateString("pt-BR"),
      amount: sale.total,
      status: "Pago",
      sellerName: sale.sellerName,
      clientName: sale.clientName || "Consumidor Final",
      paymentMethod: paymentLabels[sale.paymentMethod],
    }));
  }, [sales]);

  const payableRows = useMemo(() => entries.filter((entry) => entry.type === "expense"), [entries]);

  const totalReceitasPagas = receivableRows.reduce((sum, row) => sum + row.amount, 0);
  const totalDespesasPagas = entries.filter((entry) => entry.type === "expense" && entry.status === "paid").reduce((sum, entry) => sum + entry.amount, 0);
  const saldoLiquido = totalReceitasPagas - totalDespesasPagas;
  const aLiquidar = entries.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + entry.amount, 0);

  const monthlyFlow = useMemo(() => {
    const monthlyMap = new Map<string, { period: string; in: number; out: number }>();
    const addMonth = (key: string, label: string) => {
      if (!monthlyMap.has(key)) monthlyMap.set(key, { period: label, in: 0, out: 0 });
      return monthlyMap.get(key)!;
    };

    sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace("/", ". ");
      addMonth(key, label).in += sale.total;
    });

    entries.filter((entry) => entry.type === "expense").forEach((entry) => {
      const date = new Date(entry.dueDate);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace("/", ". ");
      addMonth(key, label).out += entry.amount;
    });

    const sorted = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value)
      .slice(-6);

    let accumulated = 0;
    return sorted.map((row) => {
      const balance = row.in - row.out;
      accumulated += balance;
      return { ...row, balance, accumulated };
    });
  }, [sales, entries]);

  const pendingReceivables = receivableRows.slice(-5);
  const pendingPayables = payableRows.filter((entry) => entry.status === "pending").slice(0, 5);

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    await apiFetch("/api/v1/financial/entries", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        paymentDate: form.paymentDate || null,
        clientId: form.clientId || null,
        supplierId: form.supplierId || null,
      }),
    });
    setForm(emptyForm);
    setShowForm(false);
    await loadData();
    setMessage("Lançamento financeiro criado com sucesso.");
  };

  const markAsPaid = async (entry: FinancialEntry) => {
    setActionLoadingId(entry.id);
    try {
      await apiFetch(`/api/v1/financial/entries/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "paid", paymentDate: new Date().toISOString().slice(0, 10) }),
      });
      await loadData();
      setMessage("Conta marcada como paga.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const deletePayable = async (entry: FinancialEntry) => {
    if (!confirm(`Excluir a conta "${entry.description}"?`)) return;
    setActionLoadingId(entry.id);
    try {
      await apiFetch(`/api/v1/financial/entries/${entry.id}`, { method: "DELETE" });
      await loadData();
      setMessage("Conta a pagar excluída com sucesso.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao excluir conta.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const exportCashFlow = () => {
    downloadCsv(`fluxo-caixa-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Periodo", "Entradas", "Saidas", "Saldo do Mes", "Saldo Acumulado"],
      ...monthlyFlow.map((row) => [
        row.period,
        formatCurrency(row.in),
        formatCurrency(row.out),
        formatCurrency(row.balance),
        formatCurrency(row.accumulated),
      ]),
    ]);
    setMessage("Fluxo de caixa exportado com sucesso.");
  };

  return (
    <Layout>
      <AppPage
        title="Financeiro"
        subtitle="AP, AR, caixa empresarial e integrações de pagamento."
        actions={
          <>
            {tab === "fluxo" && (
              <button type="button" onClick={exportCashFlow} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#f7df78]">
                <Download className="h-5 w-5" /> Baixar Fluxo de Caixa
              </button>
            )}
            {isAdmin && (
              <button type="button" onClick={() => setShowForm(true)} className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-[13px]">
                <Plus className="h-5 w-5" /> Novo Lançamento
              </button>
            )}
          </>
        }
      >
        {message && <StatusBanner tone="success">{message}</StatusBanner>}
        {errorMessage && <StatusBanner tone="error">{errorMessage}</StatusBanner>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Receitas Pagas" value={formatCurrency(totalReceitasPagas)} accent="text-[#53e28f]" />
          <MetricCard title="Despesas Pagas" value={formatCurrency(totalDespesasPagas)} accent="text-[#ff8d95]" />
          <MetricCard title="Saldo Líquido" value={formatCurrency(saldoLiquido)} accent={saldoLiquido < 0 ? "text-[#ff5f73]" : "text-[#53e28f]"} />
          <MetricCard title="A Liquidar" value={formatCurrency(aLiquidar)} accent="text-[#efcf72]" />
        </div>

        <SectionCard className="!p-3 md:!p-4">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/8 pb-1">
            <button type="button" onClick={() => setTab("receber")} className={`rounded-2xl border px-4 py-2.5 text-[13px] ${tab === "receber" ? "border-[#a57d3d] bg-[#6b4b20] font-semibold text-[#efcf72]" : "border-white/10 bg-white/[0.03] text-[#c6a9ae]"}`}>Contas A Receber</button>
            <button type="button" onClick={() => setTab("pagar")} className={`rounded-2xl border px-4 py-2.5 text-[13px] ${tab === "pagar" ? "border-[#a57d3d] bg-[#6b4b20] font-semibold text-[#efcf72]" : "border-white/10 bg-white/[0.03] text-[#c6a9ae]"}`}>Contas A Pagar</button>
            <button type="button" onClick={() => setTab("fluxo")} className={`rounded-2xl border px-4 py-2.5 text-[13px] ${tab === "fluxo" ? "border-[#a57d3d] bg-[#6b4b20] font-semibold text-[#efcf72]" : "border-white/10 bg-white/[0.03] text-[#c6a9ae]"}`}>Fluxo De Caixa</button>
          </div>
        </SectionCard>

        {tab === "receber" && (
          <DataTable
            columns={["Descrição", "Categoria", "Vencimento", "Valor", "Status", "Detalhes"]}
            rows={receivableRows.map((row) => [
              row.description,
              <span className="rounded-md bg-[#5a1c2b] px-3 py-1 text-xs font-semibold text-[#dbb2bb]">{row.category}</span>,
              row.dueDate,
              <span className="font-semibold text-[#53e28f]">{formatCurrency(row.amount)}</span>,
              <span className="rounded-md bg-[#163b24] px-3 py-1 text-xs font-semibold text-[#4ce08a]">{row.status}</span>,
              <span>{row.clientName} · {row.sellerName || "—"} · {row.paymentMethod}</span>,
            ])}
          />
        )}

        {tab === "pagar" && (
          <DataTable
            columns={["Descrição", "Categoria", "Vencimento", "Valor", "Status", "Ações"]}
            rows={payableRows.map((entry) => [
              entry.description,
              <span className="rounded-md bg-[#5a1c2b] px-3 py-1 text-xs font-semibold text-[#dbb2bb]">{entry.category}</span>,
              new Date(entry.dueDate).toLocaleDateString("pt-BR"),
              <span className="font-semibold text-[#ff8d95]">{formatCurrency(entry.amount)}</span>,
              <span className={`rounded-md px-3 py-1 text-xs font-semibold ${entry.status === "paid" ? "bg-[#163b24] text-[#4ce08a]" : entry.status === "pending" ? "bg-[#4f3b10] text-[#f0b028]" : "bg-[#4d1724] text-[#ff7c84]"}`}>{entry.status === "paid" ? "Pago" : entry.status === "pending" ? "Pendente" : "Cancelado"}</span>,
              <div className="flex items-center gap-3">
                {entry.status === "pending" ? (
                  <button type="button" onClick={() => markAsPaid(entry)} disabled={actionLoadingId === entry.id} className="rounded-xl border border-[#24553a] bg-[#173726] px-4 py-2 text-sm font-semibold text-[#8ef0b6] disabled:opacity-60">
                    {actionLoadingId === entry.id ? "Quitando..." : "Quitar"}
                  </button>
                ) : <span className="text-[#9f7d86]">—</span>}
                <button type="button" onClick={() => deletePayable(entry)} disabled={actionLoadingId === entry.id} className="rounded-xl border border-[#5f2733] bg-[#32101a] px-3 py-2 text-sm font-semibold text-[#ffb3c0] disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>,
            ])}
          />
        )}

        {tab === "fluxo" && (
          <div className="space-y-5">
            <SectionCard title="Fluxo de Caixa — Últimos 6 meses">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#b78b93]">
                      <th className="px-5 py-4">Período</th>
                      <th className="px-5 py-4">Entradas</th>
                      <th className="px-5 py-4">Saídas</th>
                      <th className="px-5 py-4">Saldo do Mês</th>
                      <th className="px-5 py-4">Saldo Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyFlow.map((row) => (
                      <tr key={row.period} className="border-b border-[#31121d] text-[#e6d2d8]">
                        <td className="px-5 py-4 font-semibold text-white">{row.period}</td>
                        <td className="px-5 py-4 text-[#53e28f]">{formatCurrency(row.in)}</td>
                        <td className="px-5 py-4 text-[#ff8d95]">{formatCurrency(row.out)}</td>
                        <td className={`px-5 py-4 ${row.balance >= 0 ? "text-[#53e28f]" : "text-[#ff8d95]"}`}>{formatCurrency(row.balance)}</td>
                        <td className={`px-5 py-4 font-semibold ${row.accumulated >= 0 ? "text-[#efcf72]" : "text-[#ff8d95]"}`}>{formatCurrency(row.accumulated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ListCard title="Recebimentos recentes" items={pendingReceivables.map((row) => ({ title: row.description, subtitle: `Cliente: ${row.clientName}`, value: formatCurrency(row.amount), positive: true }))} />
              <ListCard title="Pagamentos pendentes" items={pendingPayables.map((entry) => ({ title: entry.description, subtitle: `Venc: ${new Date(entry.dueDate).toLocaleDateString("pt-BR")}`, value: formatCurrency(entry.amount), positive: false }))} />
            </div>
          </div>
        )}

        {showForm && isAdmin && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] border border-white/10 bg-[#24040d] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Novo Lançamento</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-[#b78a99]">×</button>
              </div>
              <form onSubmit={saveEntry} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <select className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="expense">Despesa</option>
                  <option value="revenue">Receita</option>
                </select>
                <input className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none md:col-span-2" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                <DynamicNumberInput decimals value={form.amount} onValueChange={(value) => setForm({ ...form, amount: value })} className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" placeholder="Valor" required />
                <input className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
                <select className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="canceled">Cancelado</option>
                </select>
                <input type="date" className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
                <input type="date" className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
                <select className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  <option value="">Sem cliente</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                <select className="rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">Sem fornecedor</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>)}
                </select>
                <div className="md:col-span-3 grid grid-cols-2 gap-4 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 font-semibold text-[#ead7dc]">Cancelar</button>
                  <button type="submit" className="btn-gold px-6 py-4">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppPage>
    </Layout>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#24040d]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#b78b93]">
              {columns.map((column) => <th key={column} className="px-5 py-3.5">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-[#31121d] text-[#e6d2d8]">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-3.5 align-middle">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: Array<{ title: string; subtitle: string; value: string; positive: boolean }> }) {
  return (
    <SectionCard title={title}>
      <div className="space-y-3">
        {items.length === 0 ? <div className="text-sm text-[#b78b93]">Sem registros.</div> : items.map((item) => (
          <div key={`${item.title}-${item.subtitle}`} className="panel-dark flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{item.title}</p>
              <p className="text-sm text-[#b78b93]">{item.subtitle}</p>
            </div>
            <p className={`font-semibold ${item.positive ? "text-[#53e28f]" : "text-[#ff8d95]"}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
