import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { IMPORT_BLOB_SALT } from "../../config/import-limits.js";
import { getDb } from "../../db/client.js";
import { encryptBytes } from "../../lib/field-crypto.js";
import { importBatches, importFiles } from "../../db/schema.js";
import { createLogger } from "../../lib/logger.js";
import { getMerchantCategoryRulesMap } from "../category-rules.js";
import { backfillTransactionMerchantIds } from "../dim-merchant-store.js";
import {
  writeInvestmentSnapshotsForAccount,
} from "../investment-snapshots.js";
import {
  resolveOrCreateImportAccount,
} from "./account-resolver.js";
import { computeImportBatchSummary } from "./import-batch-summary.js";
import { logImportAuditEvent } from "./import-audit.js";
import { parseImportFileRecord } from "./parse-import-file-record.js";
import { purgeStaleImportBlobs } from "./purge-import-blobs.js";
import { persistBankingTransactions } from "./persist-banking.js";
import type { BankingTransactionSource } from "./persist-banking.js";
import { persistInvestmentTransactions } from "./persist-investment.js";
import type { ImportFilePreviewPayload, ParsedStatement } from "./types.js";

const log = createLogger("import.process-batch");

export interface ProcessImportBatchResult {
  batchId: string;
  filesProcessed: number;
  txnsInserted: number;
  txnsSkipped: number;
  filesImported?: number;
  filesSkipped?: number;
}

export interface ConfirmImportBatchOptions {
  accountMappings?: Record<string, string>;
  fileIds?: string[];
}

async function finalizeBatchAfterPreview(
  db: ReturnType<typeof getDb>,
  batchId: string,
): Promise<{ ready: number; failed: number }> {
  const files = await db
    .select({
      status: importFiles.status,
      parsedPreview: importFiles.parsedPreview,
    })
    .from(importFiles)
    .where(eq(importFiles.batchId, batchId));

  const summary = computeImportBatchSummary(files);
  const filesProcessed =
    summary.ready + summary.failed + summary.imported + summary.pending;

  let status: "awaiting_confirmation" | "failed" | "processing";
  let errorMessage: string | null = null;
  let completedAt: Date | null = null;

  if (summary.ready + summary.imported > 0) {
    status = "awaiting_confirmation";
    if (summary.failed > 0) {
      errorMessage = `${summary.ready} file(s) ready, ${summary.failed} failed.`;
    }
  } else if (summary.failed > 0) {
    status = "failed";
    errorMessage = `${summary.failed} file(s) could not be parsed.`;
    completedAt = new Date();
  } else {
    status = "failed";
    errorMessage = "No files could be parsed.";
    completedAt = new Date();
  }

  await db
    .update(importBatches)
    .set({
      status,
      filesProcessed,
      errorMessage,
      completedAt,
    })
    .where(eq(importBatches.id, batchId));

  return { ready: summary.ready, failed: summary.failed };
}

/** Fix batch status when all files finished parsing but batch row was not updated. */
export async function reconcileImportBatchPreview(batchId: string): Promise<void> {
  const db = getDb();
  await finalizeBatchAfterPreview(db, batchId);
}

async function persistStatementsForFile(
  db: ReturnType<typeof getDb>,
  userId: string,
  statements: ParsedStatement[],
  matchedAccountIds: (string | null)[],
  accountMappings: Record<string, string> | undefined,
  fileId: string,
  categoryRules: Awaited<ReturnType<typeof getMerchantCategoryRulesMap>>,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]!;
    const mappedId =
      statements.length === 1 ? accountMappings?.[fileId] : undefined;
    let accountId = mappedId ?? matchedAccountIds[i] ?? null;

    if (!accountId) {
      accountId = await resolveOrCreateImportAccount(
        db,
        userId,
        statement.account,
      );
    }

    const bankSource: BankingTransactionSource =
      statement.format === "ofx"
        ? "ofx"
        : statement.format === "csv"
          ? "csv"
          : "qfx";

    if (statement.bankingTransactions.length > 0) {
      const bankResult = await persistBankingTransactions(
        db,
        userId,
        accountId,
        statement.bankingTransactions,
        bankSource,
        categoryRules,
      );
      inserted += bankResult.inserted;
      skipped += bankResult.skipped;
    }

    if (statement.investmentTransactions.length > 0) {
      const invResult = await persistInvestmentTransactions(
        db,
        userId,
        accountId,
        statement.investmentTransactions,
      );
      inserted += invResult.inserted;
      skipped += invResult.skipped;
      await writeInvestmentSnapshotsForAccount(db, userId, accountId);
    }
  }

  return { inserted, skipped };
}

async function parseBatchFiles(
  db: ReturnType<typeof getDb>,
  batchId: string,
  userId: string,
  env: Env,
  onlyFileIds?: string[],
): Promise<void> {
  const categoryRules = await getMerchantCategoryRulesMap(userId);

  let files = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.batchId, batchId));

  if (onlyFileIds?.length) {
    const allowed = new Set(onlyFileIds);
    files = files.filter((f) => allowed.has(f.id));
  }

  let processed = 0;
  for (const file of files) {
    if (file.status === "preview_ready" || file.status === "parsed") {
      processed++;
      continue;
    }

    if (
      file.status === "failed" ||
      file.status === "stored" ||
      file.status === "parsing"
    ) {
      await parseImportFileRecord(db, userId, file, env, categoryRules);
      processed++;
      await db
        .update(importBatches)
        .set({ filesProcessed: processed })
        .where(eq(importBatches.id, batchId));
    }
  }
}

/** Parse files and store preview — does not persist transactions. */
export async function previewImportBatch(
  batchId: string,
  env: Env,
): Promise<ProcessImportBatchResult> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error(`Import batch not found: ${batchId}`);
  }

  if (batch.status === "awaiting_confirmation" || batch.status === "completed") {
    const files = await db
      .select({ status: importFiles.status, parsedPreview: importFiles.parsedPreview })
      .from(importFiles)
      .where(eq(importFiles.batchId, batchId));
    const summary = computeImportBatchSummary(files);
    return {
      batchId,
      filesProcessed: batch.filesProcessed,
      txnsInserted: batch.txnsInserted,
      txnsSkipped: batch.txnsSkipped,
      filesImported: summary.imported,
      filesSkipped: summary.failed,
    };
  }

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null, completedAt: null })
    .where(eq(importBatches.id, batchId));

  await parseBatchFiles(db, batchId, batch.userId, env);

  const { ready, failed } = await finalizeBatchAfterPreview(db, batchId);

  void purgeStaleImportBlobs(env).catch((err: unknown) => {
    log.warn({ err }, "stale blob purge failed after preview");
  });

  log.info({ batchId, ready, failed }, "import batch preview finished");

  return {
    batchId,
    filesProcessed: ready + failed,
    txnsInserted: 0,
    txnsSkipped: 0,
    filesImported: 0,
    filesSkipped: failed,
  };
}

export async function retryImportFile(
  batchId: string,
  fileId: string,
  env: Env,
): Promise<void> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Import batch not found.");
  }

  if (!["awaiting_confirmation", "failed"].includes(batch.status)) {
    throw new Error(
      `Cannot retry files while batch status is "${batch.status}".`,
    );
  }

  const [file] = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.id, fileId))
    .limit(1);

  if (!file || file.batchId !== batchId) {
    throw new Error("Import file not found.");
  }

  if (file.status !== "failed") {
    throw new Error("Only failed files can be retried.");
  }

  if (!file.contentEncrypted?.trim()) {
    throw new Error(
      "Encrypted content is no longer available. Replace the file with a new upload.",
    );
  }

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null, completedAt: null })
    .where(eq(importBatches.id, batchId));

  const categoryRules = await getMerchantCategoryRulesMap(batch.userId);
  await parseImportFileRecord(db, batch.userId, file, env, categoryRules);
  await finalizeBatchAfterPreview(db, batchId);
}

export async function retryAllFailedImportFiles(
  batchId: string,
  env: Env,
): Promise<{ retried: number }> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Import batch not found.");
  }

  if (!["awaiting_confirmation", "failed"].includes(batch.status)) {
    throw new Error(
      `Cannot retry files while batch status is "${batch.status}".`,
    );
  }

  const failedFiles = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.batchId, batchId));

  const toRetry = failedFiles.filter(
    (f) => f.status === "failed" && f.contentEncrypted?.trim(),
  );

  if (toRetry.length === 0) {
    throw new Error("No failed files are available to retry.");
  }

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null, completedAt: null })
    .where(eq(importBatches.id, batchId));

  await parseBatchFiles(
    db,
    batchId,
    batch.userId,
    env,
    toRetry.map((f) => f.id),
  );
  await finalizeBatchAfterPreview(db, batchId);

  return { retried: toRetry.length };
}

export async function replaceImportFile(
  batchId: string,
  fileId: string,
  buffer: Buffer,
  filename: string,
  format: "ofx" | "csv" | "pdf" | "qfx",
  env: Env,
): Promise<void> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Import batch not found.");
  }

  if (!["awaiting_confirmation", "failed"].includes(batch.status)) {
    throw new Error(
      `Cannot replace files while batch status is "${batch.status}".`,
    );
  }

  const [file] = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.id, fileId))
    .limit(1);

  if (!file || file.batchId !== batchId) {
    throw new Error("Import file not found.");
  }

  if (file.status !== "failed") {
    throw new Error("Only failed files can be replaced.");
  }

  const encrypted = encryptBytes(buffer, env, IMPORT_BLOB_SALT);

  await db
    .update(importFiles)
    .set({
      filename,
      format,
      byteSize: buffer.length,
      contentEncrypted: encrypted,
      status: "stored",
      parsedPreview: null,
      errorMessage: null,
    })
    .where(eq(importFiles.id, fileId));

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null, completedAt: null })
    .where(eq(importBatches.id, batchId));

  const categoryRules = await getMerchantCategoryRulesMap(batch.userId);
  const [updated] = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.id, fileId))
    .limit(1);

  if (updated) {
    await parseImportFileRecord(db, batch.userId, updated, env, categoryRules);
  }

  await finalizeBatchAfterPreview(db, batchId);
}

/** Persist transactions after user confirms preview. */
export async function confirmImportBatch(
  batchId: string,
  env: Env,
  options: ConfirmImportBatchOptions = {},
): Promise<ProcessImportBatchResult> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error(`Import batch not found: ${batchId}`);
  }

  if (batch.status === "completed") {
    return {
      batchId,
      filesProcessed: batch.filesProcessed,
      txnsInserted: batch.txnsInserted,
      txnsSkipped: batch.txnsSkipped,
    };
  }

  if (batch.status !== "awaiting_confirmation") {
    throw new Error(
      `Batch is not ready to confirm (status: ${batch.status}). Wait for parsing to finish.`,
    );
  }

  const allFiles = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.batchId, batchId));

  const selectedIds = options.fileIds?.length
    ? new Set(options.fileIds)
    : null;

  const filesToConfirm = allFiles.filter((f) => {
    if (f.status !== "preview_ready" || !f.parsedPreview) {
      return false;
    }
    if (selectedIds) {
      return selectedIds.has(f.id);
    }
    return true;
  });

  if (filesToConfirm.length === 0) {
    throw new Error("No files are ready to import.");
  }

  if (selectedIds) {
    for (const id of selectedIds) {
      const match = allFiles.find((f) => f.id === id);
      if (!match) {
        throw new Error(`File not found in batch: ${id}`);
      }
      if (match.status !== "preview_ready") {
        throw new Error(`File "${match.filename}" is not ready to import.`);
      }
    }
  }

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null })
    .where(eq(importBatches.id, batchId));

  const categoryRules = await getMerchantCategoryRulesMap(batch.userId);

  let filesImported = 0;
  let txnsInserted = 0;
  let txnsSkipped = 0;

  try {
    for (const file of filesToConfirm) {
      const preview = file.parsedPreview as ImportFilePreviewPayload;
      const result = await persistStatementsForFile(
        db,
        batch.userId,
        preview.statements,
        preview.matchedAccountIds,
        options.accountMappings,
        file.id,
        categoryRules,
      );

      txnsInserted += result.inserted;
      txnsSkipped += result.skipped;
      filesImported++;

      await db
        .update(importFiles)
        .set({
          status: "parsed",
          parsedAt: new Date(),
          contentEncrypted: "",
          parsedPreview: null,
        })
        .where(eq(importFiles.id, file.id));
    }

    const remaining = await db
      .select({
        status: importFiles.status,
        parsedPreview: importFiles.parsedPreview,
      })
      .from(importFiles)
      .where(eq(importFiles.batchId, batchId));

    const summary = computeImportBatchSummary(remaining);
    const hasReadyLeft = summary.ready > 0;
    const batchStatus = hasReadyLeft ? "awaiting_confirmation" : "completed";
    const errorMessage =
      !hasReadyLeft && summary.failed > 0
        ? `${filesImported} imported, ${summary.failed} file(s) failed.`
        : hasReadyLeft && summary.failed > 0
          ? `${summary.ready} file(s) still awaiting confirmation, ${summary.failed} failed.`
          : null;

    const filesProcessed =
      summary.imported + summary.failed + summary.ready + summary.pending;

    await db
      .update(importBatches)
      .set({
        status: batchStatus,
        filesProcessed,
        txnsInserted: batch.txnsInserted + txnsInserted,
        txnsSkipped: batch.txnsSkipped + txnsSkipped,
        completedAt: batchStatus === "completed" ? new Date() : null,
        errorMessage,
      })
      .where(eq(importBatches.id, batchId));

    log.info(
      { batchId, txnsInserted, txnsSkipped, filesImported },
      "import batch confirmed",
    );

    if (batchStatus === "completed") {
      await logImportAuditEvent(
        db,
        batch.userId,
        "statement_import_complete",
        "import_batch",
        batchId,
        {
          filesProcessed,
          txnsInserted: batch.txnsInserted + txnsInserted,
          txnsSkipped: batch.txnsSkipped + txnsSkipped,
        },
      );
      await backfillTransactionMerchantIds(batch.userId);
    }

    void purgeStaleImportBlobs(env).catch((err: unknown) => {
      log.warn({ err }, "stale blob purge failed after confirm");
    });

    return {
      batchId,
      filesProcessed,
      txnsInserted,
      txnsSkipped,
      filesImported,
      filesSkipped: allFiles.length - filesToConfirm.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import confirm failed";

    await db
      .update(importBatches)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    log.error({ err, batchId }, "import batch confirm failed");
    throw err;
  }
}

/** @deprecated Use previewImportBatch + confirmImportBatch */
export async function processImportBatch(
  batchId: string,
  env: Env,
): Promise<ProcessImportBatchResult> {
  await previewImportBatch(batchId, env);
  return confirmImportBatch(batchId, env);
}
