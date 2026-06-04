import { and, eq, inArray } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { importBatches, importFiles } from "../../db/schema.js";
import { createLogger } from "../../lib/logger.js";
import { getImportBatchQueue, isRedisConfigured } from "../../jobs/queue.js";
import {
  previewImportBatch,
  reconcileImportBatchPreview,
} from "./process-import-batch.js";

const log = createLogger("import.kick-stale");

const STALE_PENDING_MS = 20_000;
/** Processing with no progress — e.g. crashed worker or duplicate parse race */
const STALE_PROCESSING_MS = 90_000;

/**
 * When a batch stays `pending` (worker not consuming) or `processing` (stuck), parse inline once.
 */
export async function kickStaleImportBatchIfNeeded(
  batchId: string,
  env: Env,
): Promise<void> {
  const db = getDb();
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    return;
  }

  const ageMs = Date.now() - batch.createdAt.getTime();

  if (batch.status === "processing") {
    const files = await db
      .select({ status: importFiles.status })
      .from(importFiles)
      .where(eq(importFiles.batchId, batchId));
    const anyParsing = files.some((f) => f.status === "parsing");
    const allTerminal = files.every((f) =>
      ["preview_ready", "parsed", "failed"].includes(f.status),
    );
    if (allTerminal && files.length > 0) {
      log.warn({ batchId }, "batch processing but all files terminal — finalizing");
      await reconcileImportBatchPreview(batchId);
      return;
    }
    if (anyParsing && ageMs < STALE_PROCESSING_MS) {
      return;
    }
    if (!anyParsing && ageMs < STALE_PROCESSING_MS) {
      return;
    }
  } else if (batch.status === "pending") {
    if (ageMs < STALE_PENDING_MS) {
      return;
    }
  } else {
    return;
  }

  if (batch.status === "pending" && isRedisConfigured(env)) {
    const queue = getImportBatchQueue(env);
    const job = await queue?.getJob(`import-batch-${batchId}`);
    if (job) {
      const state = await job.getState();
      if (state === "active" || state === "completed") {
        return;
      }
      if (state === "waiting" || state === "delayed") {
        await job.remove().catch((err: unknown) => {
          log.warn({ err, batchId }, "could not remove stale import queue job");
        });
      }
    }
  }

  const [claimed] = await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null })
    .where(
      and(
        eq(importBatches.id, batchId),
        inArray(importBatches.status, ["pending", "processing"]),
      ),
    )
    .returning({ id: importBatches.id });

  if (!claimed) {
    return;
  }

  log.info({ batchId, ageMs }, "stale import batch — parsing inline");

  try {
    await previewImportBatch(batchId, env);
  } catch (err) {
    log.error({ err, batchId }, "inline parse after stale kick failed");
    await db
      .update(importBatches)
      .set({
        status: "failed",
        errorMessage:
          err instanceof Error ? err.message : "Parsing failed unexpectedly.",
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));
  }
}
