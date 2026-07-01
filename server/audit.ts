import { randomUUID } from "node:crypto";
import { db } from "./db";
import { auditLogs } from "../drizzle/schema";

export async function logAudit(params: {
  companyId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  metadata?: unknown;
}) {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    companyId: params.companyId || null,
    userId: params.userId || null,
    entityType: params.entityType,
    entityId: params.entityId || null,
    action: params.action,
    description: params.description,
    metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}
