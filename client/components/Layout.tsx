import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Bell,
  Boxes,
  CreditCard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  BarChart3,
  LayoutGrid,
  X,
} from "lucide-react";
import { getAuthUser, logoutSession } from "@/lib/api";

function hasPermission(user: any, permission: string) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes(permission);
}

function getRoleLabel(role?: string) {
  if (role === "admin") return "Administrador";
  if (role === "contador") return "Contador";
  return "Vendedor";
}

interface LayoutProps {
  children: React.ReactNode;
}

const sections: Array<{
  title: string;
  items: Array<{
    icon: any;
    label: string;
    path: string;
    roles: string[];
    permission?: string;
  }>;
}> = [
  {
    title: "PRINCIPAL",
    items: [
      { icon: LayoutGrid, label: "Início", path: "/dashboard", roles: ["admin"] },
    ],
  },
  {
    title: "OPERAÇÕES",
    items: [
      { icon: ShoppingCart, label: "Vendas e PDV", path: "/vendas", roles: ["admin", "vendedor"], permission: "sales.view" },
      { icon: Package, label: "Produtos", path: "/produtos", roles: ["admin"], permission: "products.view" },
      { icon: Boxes, label: "Compras e Estoque", path: "/estoque", roles: ["admin"], permission: "purchases.view" },
    ],
  },
  {
    title: "FISCAL E CONTÁBIL",
    items: [
      { icon: CreditCard, label: "Financeiro", path: "/financeiro", roles: ["admin", "contador"], permission: "financial.view" },
      { icon: ReceiptText, label: "Fiscal e NF-e", path: "/fiscal", roles: ["admin", "contador"], permission: "fiscal.view" },
    ],
  },
  {
    title: "ANÁLISE",
    items: [
      { icon: BarChart3, label: "Relatórios", path: "/relatorios", roles: ["admin"], permission: "reports.view" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { icon: Settings, label: "Configurações", path: "/configuracoes", roles: ["admin", "vendedor"], permission: "settings.labels.view" },
    ],
  },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getAuthUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user?.role) && (!item.permission || hasPermission(user, item.permission))),
    }))
    .filter((section) => section.items.length > 0);

  const handleLogout = async () => {
    await logoutSession();
    navigate("/login");
  };

  const NavContent = () => (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#e6e6e6] shadow-[0_8px_20px_rgba(216,179,90,0.12)]">
            <img src="/logo-allure.png" alt="Logo Allure" className="h-full w-full object-contain scale-[1.18]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold tracking-[0.02em] text-[#efcf72]">ERP</p>
            <p className="text-[12px] text-[#d7b0b8]">Gestão Profissional</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2.5 px-3 text-[10px] font-semibold tracking-[0.18em] text-[#b78b93]">
              {section.title}
            </p>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-[14px] transition-all ${
                      active
                        ? "border-[rgba(239,207,114,0.22)] bg-[rgba(107,16,39,0.86)] text-[#efcf72] shadow-[inset_0_0_0_1px_rgba(239,207,114,0.04)]"
                        : "border-transparent text-[#e0c4ca] hover:bg-[rgba(255,255,255,0.035)] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </span>
                    {active && <span className="text-[#d8b35a]">›</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/8 p-4">
        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8a613e] text-[#f3df87]">
              <span className="text-sm font-semibold">{(user?.name || "U").charAt(0)}</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">{user?.name || "Usuário"}</p>
              <p className="text-[11px] text-[#d7b0b8]">{getRoleLabel(user?.role)}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-[#d7b0b8] hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#15050b] text-white">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/55 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className="fixed inset-y-0 left-0 hidden w-[236px] border-r border-[#5b2534] bg-[linear-gradient(180deg,#4a091c_0%,#24040d_100%)] lg:flex lg:flex-col">
        <NavContent />
      </aside>

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-[#5b2534] bg-[linear-gradient(180deg,#4a091c_0%,#24040d_100%)] transition-transform lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-end px-4 pt-4">
          <button onClick={() => setMobileOpen(false)} className="rounded-xl border border-[#7a3748] bg-[#5b1f2d] p-2 text-[#e1b8c3]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavContent />
      </aside>

      <div className="lg:ml-[236px]">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-white/8 bg-[rgba(37,6,15,0.88)] px-4 md:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl border border-[#7a3748] bg-[#5b1f2d] p-2.5 text-[#f0d5ac] lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-[#e6e6e6]">
                <img src="/logo-allure.png" alt="Logo Allure" className="h-full w-full object-contain scale-[1.18]" />
              </div>
              <h1 className="text-[16px] font-semibold tracking-[0.02em] text-white">ERP</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-[#f0d5ac] transition-colors hover:bg-white/[0.05]">
              <Bell className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2 text-[12px] sm:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8a613e] text-[#f7df78]">
                <span className="text-[11px] font-bold">{(user?.name || "U").charAt(0)}</span>
              </div>
              <span>{user?.role === "admin" ? "Admin" : user?.role === "contador" ? "Contador" : "Vendedor"}</span>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)] bg-[#15050b] p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
