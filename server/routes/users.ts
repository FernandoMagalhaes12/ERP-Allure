import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../drizzle/schema";
import { hashPassword } from "../auth";
import { normalizePermissions } from "../permissions";
import { ensureEnterpriseInfrastructure } from "../platform";
import { requireTenantCompanyId } from "../tenant";

export const listUsers: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const items = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        permissionsJson: users.permissionsJson,
      })
      .from(users)
      .where(eq(users.companyId, companyId));

    res.json(items.map((item) => ({ ...item, permissions: normalizePermissions(item.role, item.permissionsJson) })));
  } catch (error) {
    console.error("List users error", error);
    res.status(500).json({ error: "Falha ao listar usuários" });
  }
};

export const createUser: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Nome, email, senha e perfil são obrigatórios" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedRole = role === "seller" ? "vendedor" : String(role);

    const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing) return res.status(409).json({ error: "Já existe um usuário com este email" });

    const [created] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        companyId,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(String(password)),
        role: normalizedRole,
        permissionsJson: JSON.stringify(normalizePermissions(normalizedRole, permissions)),
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        permissionsJson: users.permissionsJson,
      });

    res.status(201).json({ ...created, permissions: normalizePermissions(created.role, (created as any).permissionsJson) });
  } catch (error) {
    console.error("Create user error", error);
    res.status(500).json({ error: "Falha ao criar usuário" });
  }
};

export const updateUser: RequestHandler = async (req, res) => {
  try {
    await ensureEnterpriseInfrastructure();
    const companyId = requireTenantCompanyId(req, res);
    if (!companyId) return;

    const id = String(req.params.id);
    const [existing] = await db.select().from(users).where(and(eq(users.id, id), eq(users.companyId, companyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });

    const nextEmail = req.body.email ? String(req.body.email).toLowerCase().trim() : existing.email;
    if (nextEmail !== existing.email) {
      const [conflict] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, nextEmail), eq(users.isActive, true)))
        .limit(1);

      if (conflict && conflict.id !== existing.id) {
        return res.status(409).json({ error: "Já existe outro usuário com este email" });
      }
    }

    const nextRole = req.body.role ? (req.body.role === "seller" ? "vendedor" : String(req.body.role)) : existing.role;
    const nextPassword = req.body.password ? await hashPassword(String(req.body.password)) : existing.passwordHash;
    const nextPermissions = JSON.stringify(normalizePermissions(nextRole, req.body.permissions ?? (existing as any).permissionsJson));

    const [updated] = await db
      .update(users)
      .set({
        name: req.body.name ?? existing.name,
        email: nextEmail,
        role: nextRole,
        isActive: req.body.isActive ?? existing.isActive,
        passwordHash: nextPassword,
        permissionsJson: nextPermissions,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        permissionsJson: users.permissionsJson,
      });

    res.json({ ...updated, permissions: normalizePermissions(updated.role, (updated as any).permissionsJson) });
  } catch (error) {
    console.error("Update user error", error);
    res.status(500).json({ error: "Falha ao atualizar usuário" });
  }
};
