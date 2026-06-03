import type { FastifyRequest } from "fastify";
import type { getDb } from "../../db/client.js";
import { auditEvents, consentRecords } from "../../db/schema.js";

export const STATEMENT_IMPORT_CONSENT_TYPE = "statement_import";

export type ImportAuditAction =
  | "statement_import_upload"
  | "statement_import_complete"
  | "statement_import_delete"
  | "statement_import_blob_purge";

export interface RequestAuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export function auditContextFromRequest(
  request: FastifyRequest,
): RequestAuditContext {
  const forwarded = request.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : request.ip;

  const ua = request.headers["user-agent"];
  return {
    ipAddress: ip ?? undefined,
    userAgent: typeof ua === "string" ? ua.slice(0, 512) : undefined,
  };
}

export async function recordStatementImportConsent(
  db: ReturnType<typeof getDb>,
  userId: string,
  version: string,
  ctx: RequestAuditContext,
): Promise<void> {
  await db.insert(consentRecords).values({
    userId,
    consentType: STATEMENT_IMPORT_CONSENT_TYPE,
    version,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
}

export async function logImportAuditEvent(
  db: ReturnType<typeof getDb>,
  userId: string,
  action: ImportAuditAction,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
  ctx?: RequestAuditContext,
): Promise<void> {
  await logAuditEvent(
    db,
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    ctx,
  );
}

export async function logAuditEvent(
  db: ReturnType<typeof getDb>,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
  ctx?: RequestAuditContext,
): Promise<void> {
  await db.insert(auditEvents).values({
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress: ctx?.ipAddress ?? null,
  });
}
