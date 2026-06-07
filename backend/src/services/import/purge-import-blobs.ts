import { and, lt, ne, sql } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getImportLimits } from "../../config/import-limits.js";
import { getDb } from "../../db/client.js";
import { importFiles } from "../../db/schema.js";
import { createLogger } from "../../lib/logger.js";
import { logImportAuditEvent } from "./import-audit.js";

const log = createLogger("import.purge-blobs");

export interface PurgeImportBlobsResult {
  filesPurged: number;
}

/** Remove stale encrypted upload blobs past retention window. */
export async function purgeStaleImportBlobs(
  env: Env,
): Promise<PurgeImportBlobsResult> {
  const { blobRetentionHours } = getImportLimits(env);
  const cutoff = new Date(Date.now() - blobRetentionHours * 60 * 60 * 1000);
  const db = getDb();

  const stale = await db
    .select({
      id: importFiles.id,
      userId: importFiles.userId,
      batchId: importFiles.batchId,
    })
    .from(importFiles)
    .where(
      and(
        ne(importFiles.contentEncrypted, ""),
        lt(importFiles.createdAt, cutoff),
      ),
    );

  if (stale.length === 0) {
    return { filesPurged: 0 };
  }

  await db
    .update(importFiles)
    .set({
      contentEncrypted: "",
      status: sql`CASE WHEN ${importFiles.status} IN ('stored', 'preview_ready', 'failed') THEN 'purged' ELSE ${importFiles.status} END`,
    })
    .where(
      and(
        ne(importFiles.contentEncrypted, ""),
        lt(importFiles.createdAt, cutoff),
      ),
    );

  for (const file of stale) {
    await logImportAuditEvent(
      db,
      file.userId,
      "statement_import_blob_purge",
      "import_file",
      file.id,
      { batchId: file.batchId, reason: "retention_expired" },
    );
  }

  log.info({ filesPurged: stale.length, blobRetentionHours }, "purged stale import blobs");

  return { filesPurged: stale.length };
}
