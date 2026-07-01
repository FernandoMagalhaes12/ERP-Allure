import { Request, Response } from "express";

export function getTenantCompanyId(req: Request) {
  return req.user?.companyId || null;
}

export function requireTenantCompanyId(req: Request, res: Response) {
  const companyId = getTenantCompanyId(req);
  if (!companyId) {
    res.status(400).json({ error: "Empresa do usuário não configurada" });
    return null;
  }
  return companyId;
}
