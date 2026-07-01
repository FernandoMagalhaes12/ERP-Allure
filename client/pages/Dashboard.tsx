import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { AppPage, MetricCard, SectionCard } from "@/components/AppChrome";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardMetrics } from "@shared/api";
import { apiFetch } from "@/lib/api";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await apiFetch<DashboardMetrics>("/api/v1/dashboard/metrics");
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#FFE699] border-t-transparent"></div>
            <p className="text-gray-400">Carregando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!metrics) {
    return (
      <Layout>
        <div className="card-dark text-[#f87171]">{error || "Não foi possível carregar o dashboard."}</div>
      </Layout>
    );
  }

  const revenueSeries = metrics.revenueSeries || [];
  const salesSeries = metrics.salesSeries || [];
  const alerts = metrics.operationalAlerts || [];

  return (
    <Layout>
      <AppPage title="Dashboard" subtitle="Visão operacional, comercial e fiscal em tempo real.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Receita Total" value={`R$ ${metrics.totalRevenue.toFixed(2)}`} accent="text-white" />
          <MetricCard title="Despesas Totais" value={`R$ ${metrics.totalExpenses.toFixed(2)}`} accent="text-[#fca5a5]" />
          <MetricCard title="Lucro Líquido" value={`R$ ${metrics.netProfit.toFixed(2)}`} accent="text-[#FFE699]" />
          <MetricCard title="Vendas" value={String(metrics.salesCount)} accent="text-[#9fd4ff]" />
          <MetricCard title="Produtos" value={String(metrics.productsInStock)} accent="text-[#d8c58f]" />
          <MetricCard title="Baixo Estoque" value={String(metrics.lowStockProducts)} accent="text-[#f87171]" />
          <MetricCard title="Clientes Ativos" value={String(metrics.activeClients || 0)} accent="text-[#9fd4ff]" />
          <MetricCard title="Fornecedores" value={String(metrics.activeSuppliers || 0)} accent="text-[#d8c58f]" />
          <MetricCard title="Margem Média" value={`${metrics.averageMargin}%`} accent="text-[#FFE699]" />
          <MetricCard title="Passivo de Cashback" value={`R$ ${(metrics.cashbackLiability || 0).toFixed(2)}`} accent="text-[#a7f3d0]" />
          <MetricCard title="Cashback expirando" value={String(metrics.cashbackExpiringSoon || 0)} accent="text-[#facc15]" />
          <MetricCard title="Pendências fiscais" value={String(metrics.pendingInvoices || 0)} accent="text-[#fca5a5]" />
        </div>

        {alerts.length > 0 && (
          <SectionCard title="Automação e inteligência operacional">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {alerts.map((alert, index) => (
                <div key={`${alert.title}-${index}`} className="panel-dark">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#b78a99]">{alert.severity}</p>
                  <p className="mt-2 text-[14px] font-semibold text-white">{alert.title}</p>
                  <p className="mt-1 text-[13px] text-[#a77b88]">{alert.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {metrics.topProduct && (
          <SectionCard title="Produto destaque">
            <p className="text-[15px] font-semibold text-white">{metrics.topProduct.name}</p>
            <p className="text-[13px] text-gray-400">
              Código {metrics.topProduct.code} · Estoque {metrics.topProduct.stock} · Preço R$ {metrics.topProduct.price.toFixed(2)}
            </p>
          </SectionCard>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Receita vs Despesas">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3D2B32" />
                <XAxis dataKey="date" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#2D1B24", border: "1px solid #3D2B32", borderRadius: "8px" }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: number, name: string) => [formatCurrency(Number(value || 0)), name === "revenue" ? "Receitas" : "Despesas"]}
                />
                <Legend formatter={(value) => (value === "revenue" ? "Receitas" : value === "expenses" ? "Despesas" : value)} />
                <Line type="monotone" dataKey="revenue" name="Receitas" stroke="#4ade80" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#f87171" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Volume de vendas">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3D2B32" />
                <XAxis dataKey="month" stroke="#999" />
                <YAxis stroke="#999" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#2D1B24", border: "1px solid #3D2B32", borderRadius: "8px" }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: number) => [`${Number(value || 0)} venda(s)`, "Vendas"]}
                />
                <Bar dataKey="sales" name="Vendas" fill="#FFE699" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      </AppPage>
    </Layout>
  );
}
