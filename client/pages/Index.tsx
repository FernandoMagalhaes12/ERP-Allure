import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthUser } from "@/lib/api";

function getDefaultRoute(role?: string) {
  if (role === "vendedor") return "/vendas";
  if (role === "contador") return "/fiscal";
  return "/dashboard";
}

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getAuthUser();
    if (user) {
      navigate(getDefaultRoute(user.role));
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#17070d]">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-[#d8b35a] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-[#c9aab3]">Carregando Allure ERP...</p>
      </div>
    </div>
  );
}
