import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { db } from "../db";
import { companySettings, users } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { clearAuthCookie, comparePassword, generateToken, parsePermissions, setAuthCookie } from "../auth";
import { ensureEnterpriseInfrastructure } from "../platform";

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, String(email).toLowerCase().trim()), eq(users.isActive, true)))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const [company] = user.companyId
      ? await db.select().from(companySettings).where(eq(companySettings.id, user.companyId)).limit(1)
      : [];

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      companyId: user.companyId || company?.id || null,
      permissions: parsePermissions((user as any).permissionsJson, user.role),
    };

    const token = generateToken(authUser);
    setAuthCookie(res, token);

    res.json({
      user: authUser,
      sessionId: randomUUID(),
    });
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json({ error: "Falha ao realizar login" });
  }
};

export const handleLogout: RequestHandler = async (_req, res) => {
  clearAuthCookie(res);
  res.status(204).send();
};

export const handleMe: RequestHandler = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  res.json({ user: req.user });
};
