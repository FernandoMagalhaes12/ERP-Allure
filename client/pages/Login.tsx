import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveAuthSession } from "@/lib/api";
import type { LoginResponse } from "@shared/api";

function getDefaultRoute(role?: string) {
  if (role === "vendedor") return "/vendas";
  if (role === "contador") return "/fiscal";
  return "/dashboard";
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@completefitness.com.br");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginResponse | { error?: string };

      if (!response.ok || !("user" in data)) {
        throw new Error((data as { error?: string }).error || "Falha no login");
      }

      saveAuthSession(data.user);
      navigate(getDefaultRoute(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#17070d] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card-dark mb-8 border-[#5b2534] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="mb-8 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#d9d9d9] shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
              <img src="/logo-allure.png" alt="Logo Allure" className="h-full w-full object-contain scale-[1.12]" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 text-white">
            ERP
          </h1>
          <p className="text-center text-[#c6a4af] mb-8">Gestão Profissional</p>

          {error && (
            <div className="mb-6 rounded-xl border border-[#a53548] bg-[#551321]/30 p-4 text-sm text-[#ff9ead]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#e6d2d8] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#5b2534] bg-[#22040d] px-4 py-3 text-white placeholder-[#7f5a66] focus:outline-none focus:border-[#d8b35a]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e6d2d8] mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#5b2534] bg-[#22040d] px-4 py-3 text-white placeholder-[#7f5a66] focus:outline-none focus:border-[#d8b35a]"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-gold mt-6 disabled:opacity-50">
              {loading ? "Entrando..." : "Entrar no ERP"}
            </button>
          </form>

          <p className="text-center text-[#8d6874] text-sm mt-8">
            Usuários iniciais do seed:
            <br />
            <span className="text-[#d2b9c0]">admin@completefitness.com.br</span>
            <br />
            <span className="text-[#d2b9c0]">contador@completefitness.com.br</span>
            <br />
            <span className="text-[#d2b9c0]">vendedor@completefitness.com.br</span>
            <br />
            <span className="text-[#d2b9c0]">senha: password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
