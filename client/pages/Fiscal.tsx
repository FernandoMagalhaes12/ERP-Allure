import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileText, Save, ShieldCheck } from "lucide-react";
import type { FiscalOverview, FiscalOperationProfile, FiscalProductRule, Invoice, Sale } from "@shared/api";
import { apiFetch } from "@/lib/api";

type FiscalProfileForm = {
  crtCode: string;
  cnaePrimary: string;
  cnaeSecondary: string;
  ieSubstitute: string;
  accountingEmail: string;
  accountantName: string;
  accountantPhone: string;
  ibptVersion: string;
  lastIbptSync: string;
  nfseEnvironment: string;
  nfseMunicipalityCode: string;
  nfseSeries: string;
  defaultOperationProfileId: string;
  additionalInfo: string;
};

type OperationForm = {
  id?: string;
  name: string;
  documentModel: string;
  direction: string;
  destination: string;
  finalConsumer: boolean;
  taxpayerType: string;
  purpose: string;
  presenca: string;
  cfop: string;
  operationNature: string;
  isDefault: boolean;
  isActive: boolean;
};

const emptyProfile: FiscalProfileForm = {
  crtCode: "1",
  cnaePrimary: "",
  cnaeSecondary: "",
  ieSubstitute: "",
  accountingEmail: "",
  accountantName: "",
  accountantPhone: "",
  ibptVersion: "",
  lastIbptSync: "",
  nfseEnvironment: "homologacao",
  nfseMunicipalityCode: "",
  nfseSeries: "1",
  defaultOperationProfileId: "",
  additionalInfo: "",
};

const emptyOperation: OperationForm = {
  name: "",
  documentModel: "NFC-e",
  direction: "saida",
  destination: "interna",
  finalConsumer: true,
  taxpayerType: "nao_contribuinte",
  purpose: "normal",
  presenca: "1",
  cfop: "5102",
  operationNature: "Venda de mercadoria",
  isDefault: false,
  isActive: true,
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-[#c7aebb]">{label}</span>
      <input type={type} value={value} onChange={onChange} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-[#c7aebb]">{label}</span>
      <select value={value} onChange={onChange} className="w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export default function Fiscal() {
  const [overview, setOverview] = useState<FiscalOverview | null>(null);
  const [profile, setProfile] = useState<FiscalProfileForm>(emptyProfile);
  const [operation, setOperation] = useState<OperationForm>(emptyOperation);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOperation, setSavingOperation] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingRules, setEditingRules] = useState<Record<string, Partial<FiscalProductRule>>>({});

  const load = async () => {
    const data = await apiFetch<FiscalOverview>("/api/v1/fiscal/overview");
    setOverview(data);
    setProfile({
      crtCode: data.fiscalProfile?.crtCode || "1",
      cnaePrimary: data.fiscalProfile?.cnaePrimary || "",
      cnaeSecondary: data.fiscalProfile?.cnaeSecondary || "",
      ieSubstitute: data.fiscalProfile?.ieSubstitute || "",
      accountingEmail: data.fiscalProfile?.accountingEmail || "",
      accountantName: data.fiscalProfile?.accountantName || "",
      accountantPhone: data.fiscalProfile?.accountantPhone || "",
      ibptVersion: data.fiscalProfile?.ibptVersion || "",
      lastIbptSync: data.fiscalProfile?.lastIbptSync || "",
      nfseEnvironment: data.fiscalProfile?.nfseEnvironment || "homologacao",
      nfseMunicipalityCode: data.fiscalProfile?.nfseMunicipalityCode || "",
      nfseSeries: data.fiscalProfile?.nfseSeries || "1",
      defaultOperationProfileId: data.fiscalProfile?.defaultOperationProfileId || "",
      additionalInfo: data.fiscalProfile?.additionalInfo || "",
    });
    setEditingRules(Object.fromEntries((data.productRules || []).map((rule) => [rule.productId, { ...rule }])));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const invoices = overview?.invoices || [];
  const pendingSales = overview?.pendingSales || [];
  const checks = overview?.checks || [];
  const productRules = overview?.productRules || [];
  const operations = overview?.operationProfiles || [];
  const summary = overview?.summary;

  const emittedCount = invoices.filter((invoice) => invoice.fiscalStatus === "authorized").length;
  const waitingCount = pendingSales.length;
  const errorCount = invoices.filter((invoice) => invoice.fiscalStatus === "pending_config").length;
  const pendingProductRules = productRules.filter((rule) => !rule.isComplete).length;

  const topWarnings = useMemo(() => checks.filter((item) => !item.ok), [checks]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch("/api/v1/fiscal/company-profile", { method: "PUT", body: JSON.stringify(profile) });
      setMessage("Perfil fiscal salvo com sucesso.");
      await load();
    } finally {
      setSavingProfile(false);
    }
  };

  const saveOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOperation(true);
    try {
      await apiFetch(operation.id ? `/api/v1/fiscal/operation-profiles/${operation.id}` : "/api/v1/fiscal/operation-profiles", {
        method: operation.id ? "PUT" : "POST",
        body: JSON.stringify(operation),
      });
      setOperation(emptyOperation);
      setMessage("Perfil de operação fiscal salvo.");
      await load();
    } finally {
      setSavingOperation(false);
    }
  };

  const saveRule = async (productId: string) => {
    const payload = editingRules[productId];
    if (!payload) return;
    setSavingRuleId(productId);
    try {
      await apiFetch(`/api/v1/fiscal/product-rules/${productId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMessage("Regra fiscal do produto salva.");
      await load();
    } finally {
      setSavingRuleId(null);
    }
  };

  const emitPendingSale = async (sale: Sale | { id: string; clientId?: string | null; clientName?: string | null; total: number }) => {
    await apiFetch("/api/v1/fiscal/invoice", {
      method: "POST",
      body: JSON.stringify({
        saleId: sale.id,
        clientId: sale.clientId || null,
        clientName: sale.clientName || "Consumidor Final",
        amount: sale.total,
        type: "NFC-e",
      }),
    });
    setMessage("Documento fiscal gerado. Se faltarem dados contábeis, ele ficará como pendente de configuração.");
    await load();
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-[34px] font-bold text-white">Fiscal, NF-e e contador</h1>
          <p className="text-sm text-[#a77b88]">Estrutura pronta para legislação brasileira, aguardando apenas os dados definitivos do contador.</p>
        </div>

        {message && <div className="rounded-2xl border border-[#395a46] bg-[#173325] px-5 py-4 text-[#98f0bd]">{message}</div>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatusCard icon={<CheckCircle2 className="h-5 w-5 text-[#38e07b]" />} title="Docs autorizados" value={String(emittedCount)} accent="text-[#38e07b]" />
          <StatusCard icon={<Clock3 className="h-5 w-5 text-[#ffbf2f]" />} title="Vendas sem emissão" value={String(waitingCount)} accent="text-[#ffbf2f]" />
          <StatusCard icon={<AlertTriangle className="h-5 w-5 text-[#ff6b6b]" />} title="Pendências fiscais" value={String(errorCount + pendingProductRules)} accent="text-[#ff6b6b]" />
          <StatusCard icon={<ShieldCheck className="h-5 w-5 text-[#7dd3fc]" />} title="Prontidão legal" value={`${summary?.readinessScore || 0}%`} accent="text-[#7dd3fc]" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[#6b4f38] bg-[#2b1716] p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#5b4321] p-3 text-[#f7df78]"><FileText className="h-6 w-6" /></div>
              <div className="flex-1">
                <h2 className="text-[22px] font-bold text-[#f7df78]">Checklist legal e operacional</h2>
                <p className="mt-2 text-[#b78a99]">O módulo já separa cadastros, regras, operação fiscal e emissão. O contador só precisa preencher os dados oficiais faltantes.</p>
                <div className="mt-5 space-y-3">
                  {checks.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl border border-[#4f2c38] bg-[#22070f] px-4 py-3">
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-sm text-[#b78a99]">{item.detail}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.ok ? "bg-[#173325] text-[#98f0bd]" : "bg-[#4f3b10] text-[#f0b028]"}`}>{item.ok ? "OK" : item.dependsOnAccountant ? "Pendente contador" : "Pendente"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
            <h3 className="text-xl font-semibold text-white">Alertas principais</h3>
            <div className="mt-4 space-y-3">
              {topWarnings.length === 0 ? (
                <div className="rounded-2xl border border-[#173325] bg-[#102219] p-4 text-[#9df4c2]">Nenhuma pendência crítica no momento.</div>
              ) : topWarnings.slice(0, 5).map((item) => (
                <div key={item.key} className="rounded-2xl border border-[#5b2534] bg-[#19050a] p-4">
                  <p className="font-semibold text-[#f7df78]">{item.title}</p>
                  <p className="mt-1 text-sm text-[#c6a9ae]">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
            <h3 className="text-xl font-semibold text-white">Perfil fiscal da empresa</h3>
            <form onSubmit={saveProfile} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select label="CRT" value={profile.crtCode} onChange={(e) => setProfile({ ...profile, crtCode: e.target.value })} options={[{ value: "1", label: "1 - Simples Nacional" }, { value: "2", label: "2 - Simples excesso sublimite" }, { value: "3", label: "3 - Regime normal" }]} />
              <Input label="CNAE principal" value={profile.cnaePrimary} onChange={(e) => setProfile({ ...profile, cnaePrimary: e.target.value })} />
              <Input label="CNAE secundário" value={profile.cnaeSecondary} onChange={(e) => setProfile({ ...profile, cnaeSecondary: e.target.value })} />
              <Input label="IE substituta" value={profile.ieSubstitute} onChange={(e) => setProfile({ ...profile, ieSubstitute: e.target.value })} />
              <Input label="Nome do contador" value={profile.accountantName} onChange={(e) => setProfile({ ...profile, accountantName: e.target.value })} />
              <Input label="E-mail contábil" value={profile.accountingEmail} onChange={(e) => setProfile({ ...profile, accountingEmail: e.target.value })} />
              <Input label="Telefone contábil" value={profile.accountantPhone} onChange={(e) => setProfile({ ...profile, accountantPhone: e.target.value })} />
              <Input label="Versão IBPT" value={profile.ibptVersion} onChange={(e) => setProfile({ ...profile, ibptVersion: e.target.value })} />
              <Input label="Última atualização IBPT" type="date" value={profile.lastIbptSync} onChange={(e) => setProfile({ ...profile, lastIbptSync: e.target.value })} />
              <Select label="Ambiente NFS-e" value={profile.nfseEnvironment} onChange={(e) => setProfile({ ...profile, nfseEnvironment: e.target.value })} options={[{ value: "homologacao", label: "Homologação" }, { value: "producao", label: "Produção" }]} />
              <Input label="Município IBGE NFS-e" value={profile.nfseMunicipalityCode} onChange={(e) => setProfile({ ...profile, nfseMunicipalityCode: e.target.value })} />
              <Input label="Série NFS-e" value={profile.nfseSeries} onChange={(e) => setProfile({ ...profile, nfseSeries: e.target.value })} />
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm text-[#c7aebb]">Informações complementares</span>
                <textarea value={profile.additionalInfo} onChange={(e) => setProfile({ ...profile, additionalInfo: e.target.value })} className="min-h-[100px] w-full rounded-2xl border border-[#5b2534] bg-[#310815] px-4 py-3 text-white outline-none" />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014] disabled:opacity-50"><Save className="h-4 w-4" /> Salvar perfil fiscal</button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5">
            <h3 className="text-xl font-semibold text-white">Perfis de operação fiscal</h3>
            <div className="mt-4 space-y-3">
              {operations.map((item) => (
                <button key={item.id} type="button" onClick={() => setOperation({
                  id: item.id,
                  name: item.name,
                  documentModel: item.documentModel,
                  direction: item.direction,
                  destination: item.destination,
                  finalConsumer: item.finalConsumer,
                  taxpayerType: item.taxpayerType,
                  purpose: item.purpose,
                  presenca: item.presenca,
                  cfop: item.cfop,
                  operationNature: item.operationNature,
                  isDefault: Boolean(item.isDefault),
                  isActive: Boolean(item.isActive),
                })} className="w-full rounded-2xl border border-[#4f2c38] bg-[#22070f] p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-[#b78a99]">{item.documentModel} · CFOP {item.cfop} · {item.operationNature}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isDefault ? "bg-[#173325] text-[#98f0bd]" : "bg-[#2d1230] text-[#d2b8ff]"}`}>{item.isDefault ? "Padrão" : item.destination}</span>
                  </div>
                </button>
              ))}
            </div>

            <form onSubmit={saveOperation} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Nome do perfil" value={operation.name} onChange={(e) => setOperation({ ...operation, name: e.target.value })} />
              <Select label="Modelo" value={operation.documentModel} onChange={(e) => setOperation({ ...operation, documentModel: e.target.value })} options={[{ value: "NFC-e", label: "NFC-e" }, { value: "NFe", label: "NF-e" }, { value: "NFS-e", label: "NFS-e" }]} />
              <Select label="Destino" value={operation.destination} onChange={(e) => setOperation({ ...operation, destination: e.target.value })} options={[{ value: "interna", label: "Interna" }, { value: "interestadual", label: "Interestadual" }, { value: "exterior", label: "Exterior" }]} />
              <Input label="CFOP" value={operation.cfop} onChange={(e) => setOperation({ ...operation, cfop: e.target.value })} />
              <Input label="Natureza da operação" value={operation.operationNature} onChange={(e) => setOperation({ ...operation, operationNature: e.target.value })} />
              <Select label="Tipo do destinatário" value={operation.taxpayerType} onChange={(e) => setOperation({ ...operation, taxpayerType: e.target.value })} options={[{ value: "nao_contribuinte", label: "Não contribuinte" }, { value: "contribuinte_icms", label: "Contribuinte ICMS" }]} />
              <label className="flex items-center gap-3 text-sm text-[#c7aebb]"><input type="checkbox" checked={operation.finalConsumer} onChange={(e) => setOperation({ ...operation, finalConsumer: e.target.checked })} /> Consumidor final</label>
              <label className="flex items-center gap-3 text-sm text-[#c7aebb]"><input type="checkbox" checked={operation.isDefault} onChange={(e) => setOperation({ ...operation, isDefault: e.target.checked })} /> Tornar padrão</label>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={savingOperation} className="inline-flex items-center gap-2 rounded-2xl bg-[#f1dc86] px-6 py-3 font-semibold text-[#261014] disabled:opacity-50"><Save className="h-4 w-4" /> Salvar operação</button>
              </div>
            </form>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#3f1623] bg-[#24040d]">
          <div className="border-b border-[#3b1b26] px-5 py-4 text-xl font-semibold">Regras fiscais por produto</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#9a717d]">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">NCM</th>
                  <th className="px-4 py-3">CEST</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">CFOP interno</th>
                  <th className="px-4 py-3">CFOP consumidor</th>
                  <th className="px-4 py-3">CSOSN</th>
                  <th className="px-4 py-3">CST ICMS</th>
                  <th className="px-4 py-3">Alíquota ICMS</th>
                  <th className="px-4 py-3">IBPT</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {productRules.map((rule) => {
                  const edit = editingRules[rule.productId] || rule;
                  return (
                    <tr key={rule.productId} className="border-b border-[#31121d] text-[#e6d2d8]">
                      <td className="px-4 py-3"><div className="font-semibold text-white">{rule.productName}</div><div className="text-xs text-[#a77b88]">{rule.productCode}</div></td>
                      <td className="px-4 py-3"><input value={String(edit.ncm || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, ncm: e.target.value } })} className="w-28 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.cest || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, cest: e.target.value } })} className="w-28 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.taxOrigin || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, taxOrigin: e.target.value } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.cfopInternal || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, cfopInternal: e.target.value } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.cfopConsumer || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, cfopConsumer: e.target.value } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.csosn || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, csosn: e.target.value } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.cstIcms || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, cstIcms: e.target.value } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.icmsRate ?? "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, icmsRate: Number(e.target.value || 0) } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><input value={String(edit.ibptCode || "")} onChange={(e) => setEditingRules({ ...editingRules, [rule.productId]: { ...edit, ibptCode: e.target.value } })} className="w-24 rounded-xl border border-[#5b2534] bg-[#310815] px-3 py-2 text-white" /></td>
                      <td className="px-4 py-3"><button onClick={() => saveRule(rule.productId)} disabled={savingRuleId === rule.productId} className="rounded-xl border border-[#6b4f38] bg-[#3a1823] px-4 py-2 text-[#f7df78]">Salvar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-[#3f1623] bg-[#24040d]">
            <div className="border-b border-[#3b1b26] px-5 py-4 text-xl font-semibold">Vendas aguardando documento fiscal</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#3b1b26] bg-[#35121b] text-left text-[#9a717d]">
                    <th className="px-5 py-4">Venda</th>
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSales.map((sale, index) => (
                    <tr key={sale.id} className="border-b border-[#31121d] text-[#e6d2d8]">
                      <td className="px-5 py-4 font-semibold text-[#f7df78]">v{String(index + 1).padStart(3, "0")}</td>
                      <td className="px-5 py-4">{new Date(sale.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-5 py-4">{sale.clientName || "Consumidor Final"}</td>
                      <td className="px-5 py-4 font-semibold text-[#f7df78]">{formatCurrency(sale.total)}</td>
                      <td className="px-5 py-4"><button onClick={() => emitPendingSale(sale)} className="rounded-xl border border-[#6b4f38] bg-[#3a1823] px-4 py-2 text-[#f7df78] hover:text-white">Emitir</button></td>
                    </tr>
                  ))}
                  {pendingSales.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#9a717d]">Nenhuma venda pendente.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#3f1623] bg-[#24040d]">
            <div className="border-b border-[#3b1b26] px-5 py-4 text-xl font-semibold">Documentos emitidos</div>
            <div className="space-y-3 p-5">
              {invoices.slice(0, 8).map((invoice: Invoice) => (
                <div key={invoice.id} className="rounded-2xl border border-[#4f2c38] bg-[#22070f] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{invoice.type} {invoice.number}</p>
                      <p className="text-sm text-[#b78a99]">{invoice.clientName} · {formatCurrency(invoice.amount)} · {new Date(invoice.emissionDate).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${invoice.fiscalStatus === "authorized" ? "bg-[#173325] text-[#98f0bd]" : "bg-[#4f3b10] text-[#f0b028]"}`}>{invoice.fiscalStatus}</span>
                  </div>
                  {invoice.validationMessages && invoice.validationMessages.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#e4b3bc]">
                      {invoice.validationMessages.map((msg) => <li key={msg}>{msg}</li>)}
                    </ul>
                  )}
                </div>
              ))}
              {invoices.length === 0 && <div className="p-4 text-[#9a717d]">Nenhum documento emitido ainda.</div>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatusCard({ icon, title, value, accent }: { icon: React.ReactNode; title: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#3f1623] bg-[#24040d] p-5 transition-colors hover:border-[#69424f]">
      <div className="flex items-center gap-2 text-[#936a78]">{icon}<span>{title}</span></div>
      <p className={`mt-4 text-[22px] font-bold ${accent}`}>{value}</p>
    </div>
  );
}
