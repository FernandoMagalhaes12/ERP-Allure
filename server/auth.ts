import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ensureEnterpriseInfrastructure } from "./platform";
import { normalizePermissions } from "./permissions";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  if (configured) return configured;
  if (isProduction) throw new Error("JWT_SECRET is required in production");
  return "dev-jwt-secret-change-me";
}
export const AUTH_COOKIE_NAME = "allure_erp_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name: string;
  companyId: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthenticatedUser) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      companyId: user.companyId,
      permissions: user.permissions,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
}

export function parsePermissions(raw: unknown, role?: string) {
  return normalizePermissions(role || "vendedor", raw);
}

export function hasPermission(user: Pick<AuthenticatedUser, "role" | "permissions"> | undefined, permission: string) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions.includes("*") || user.permissions.includes(permission);
}

function parseCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) return {} as Record<string, string>;

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export function getTokenFromRequest(req: Request) {
  const bearerToken = req.headers.authorization?.replace("Bearer ", "").trim();
  if (bearerToken) return bearerToken;

  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME];
}

export function setAuthCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureEnterpriseInfrastructure();
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: "Sessão não encontrada" });
    }

    const payload = verifyToken(token);
    const userId = String(payload.sub || "");

    if (!userId) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Usuário não encontrado ou inativo" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      companyId: user.companyId || null,
      permissions: parsePermissions((user as any).permissionsJson, user.role),
    };

    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permissões insuficientes" });
    }

    next();
  };
}

export function authorizePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const allowed = permissions.some((permission) => hasPermission(req.user, permission));
    if (!allowed) {
      return res.status(403).json({ error: "Permissão granular insuficiente" });
    }

    next();
  };
}
