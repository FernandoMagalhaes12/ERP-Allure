import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import { apiFetch, clearAuthSession, getAuthUser, setAuthUser } from "./lib/api";
import type { User } from "@shared/api";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Vendas = lazy(() => import("./pages/Vendas"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Estoque = lazy(() => import("./pages/Estoque"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Fiscal = lazy(() => import("./pages/Fiscal"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));

const queryClient = new QueryClient();

type AuthMeResponse = {
  user: User;
};

function getDefaultRoute(role?: string) {
  if (role === "vendedor") return "/vendas";
  if (role === "contador") return "/fiscal";
  return "/dashboard";
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const cachedUser = getAuthUser();
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">(cachedUser ? "authorized" : "loading");
  const user = getAuthUser();

  useEffect(() => {
    if (cachedUser) return;

    apiFetch<AuthMeResponse>("/api/v1/auth/me")
      .then((data) => {
        setAuthUser(data.user);
        setStatus("authorized");
      })
      .catch(() => {
        clearAuthSession();
        setStatus("unauthorized");
      });
  }, [cachedUser]);

  if (status === "loading") {
    return <div className="min-h-screen bg-[#1a0b12] text-white flex items-center justify-center">Carregando...</div>;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return <>{children}</>;
}

function AppShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#12040a] text-[#d9c7cb]">
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.24)] backdrop-blur-sm">
        Carregando módulo…
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<AppShellFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={["admin"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/vendas" element={<ProtectedRoute roles={["admin", "vendedor"]}><Vendas /></ProtectedRoute>} />
            <Route path="/produtos" element={<ProtectedRoute roles={["admin"]}><Produtos /></ProtectedRoute>} />
            <Route path="/estoque" element={<ProtectedRoute roles={["admin"]}><Estoque /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute roles={["admin", "contador"]}><Financeiro /></ProtectedRoute>} />
            <Route path="/fiscal" element={<ProtectedRoute roles={["admin", "contador"]}><Fiscal /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute roles={["admin"]}><Relatorios /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute roles={["admin", "vendedor"]}><Configuracoes /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
