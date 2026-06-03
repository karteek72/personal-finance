import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { IMPORT_BLOB_SALT } from "../../config/import-limits.js";
import { getDb } from "../../db/client.js";
import { importBatches, importFiles } from "../../db/schema.js";
import { decryptBytes } from "../../lib/field-crypto.js";
import { createLogger } from "../../lib/logger.js";
import { getMerchantCategoryRulesMap } from "../category-rules.js";
import {
  findMatchingImportAccount,
  resolveOrCreateImportAccount,
} from "./account-resolver.js";
import { enrichStatementsWithClassification } from "./enrich-classification.js";
import { parseImportFileAsync } from "./parse-file.js";
import { purgeStaleImportBlobs } from "./purge-import-blobs.js";
import { logImportAuditEvent } from "./import-audit.js";
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
}

export interface ConfirmImportBatchOptions {
  accountMappings?: Record<string, string>;
}

function summarizePreview(statements: ParsedStatement[]): {
  bankingCount: number;
  investmentCount: number;
  dateMin: string | null;
  dateMax: string | null;
} {
  let bankingCount = 0;
  let investmentCount = 0;
  const dates: string[] = [];

  for (const stmt of statements) {
    bankingCount += stmt.bankingTransactions.length;
    investmentCount += stmt.investmentTransactions.length;
    for (const t of stmt.bankingTransactions) dates.push(t.date);
    for (const t of stmt.investmentTransactions) dates.push(t.date);
  }

  dates.sort();
  return {
    bankingCount,
    investmentCount,
    dateMin: dates[0] ?? null,
    dateMax: dates.at(-1) ?? null,
  };
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
    }
  }

  return { inserted, skipped };
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
    return {
      batchId,
      filesProcessed: batch.filesProcessed,
      txnsInserted: batch.txnsInserted,
      txnsSkipped: batch.txnsSkipped,
    };
  }

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null })
    .where(eq(importBatches.id, batchId));

  const files = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.batchId, batchId));

  const categoryRules = await getMerchantCategoryRulesMap(batch.userId);

  let filesProcessed = 0;

  try {
    for (const file of files) {
      if (file.status === "preview_ready" || file.status === "parsed") {
        filesProcessed++;
        continue;
      }

      await db
        .update(importFiles)
        .set({ status: "parsing", errorMessage: null })
        .where(eq(importFiles.id, file.id));

      const plaintext = decryptBytes(file.contentEncrypted, env, IMPORT_BLOB_SALT);
      const statements = enrichStatementsWithClassification(
        await parseImportFileAsync(
          file.format,
          file.format === "pdf" ? plaintext : plaintext.toString("utf8"),
          file.filename,
        ),
        categoryRules,
      );

      const matchedAccountIds: (string | null)[] = [];
      for (const stmt of statements) {
        matchedAccountIds.push(
          await findMatchingImportAccount(db, batch.userId, stmt.account),
        );
      }

      const preview: ImportFilePreviewPayload = {
        statements,
        matchedAccountIds,
      };

      const summary = summarizePreview(statements);

      await db
        .update(importFiles)
        .set({
          status: "preview_ready",
          parsedPreview: preview,
          errorMessage:
            statements.flatMap((s) => s.warnings).join("; ") || null,
        })
        .where(eq(importFiles.id, file.id));

      filesProcessed++;

      log.info(
        {
          batchId,
          fileId: file.id,
          banking: summary.bankingCount,
          investment: summary.investmentCount,
        },
        "import file preview ready",
      );
    }

    await db
      .update(importBatches)
      .set({
        status: "awaiting_confirmation",
        filesProcessed,
        errorMessage: null,
      })
      .where(eq(importBatches.id, batchId));

    void purgeStaleImportBlobs(env).catch((err: unknown) => {
      log.warn({ err }, "stale blob purge failed after preview");
    });

    return {
      batchId,
      filesProcessed,
      txnsInserted: 0,
      txnsSkipped: 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import preview failed";

    await db
      .update(importBatches)
      .set({
        status: "failed",
        filesProcessed,
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    log.error({ err, batchId }, "import batch preview failed");
    throw err;
  }
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

  await db
    .update(importBatches)
    .set({ status: "processing", errorMessage: null })
    .where(eq(importBatches.id, batchId));

  const files = await db
    .select()
    .from(importFiles)
    .where(eq(importFiles.batchId, batchId));

  const categoryRules = await getMerchantCategoryRulesMap(batch.userId);

  let filesProcessed = 0;
  let txnsInserted = 0;
  let txnsSkipped = 0;

  try {
    for (const file of files) {
      if (file.status === "parsed") {
        filesProcessed++;
        continue;
      }

      if (file.status !== "preview_ready" || !file.parsedPreview) {
        throw new Error(`File "${file.filename}" is not ready for confirmation.`);
      }

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
      filesProcessed++;

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

    await db
      .update(importBatches)
      .set({
        status: "completed",
        filesProcessed,
        txnsInserted,
        txnsSkipped,
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(importBatches.id, batchId));

    log.info({ batchId, txnsInserted, txnsSkipped }, "import batch confirmed");

    await logImportAuditEvent(
      db,
      batch.userId,
      "statement_import_complete",
      "import_batch",
      batchId,
      {
        filesProcessed,
        txnsInserted,
        txnsSkipped,
      },
    );

    void purgeStaleImportBlobs(env).catch((err: unknown) => {
      log.warn({ err }, "stale blob purge failed after confirm");
    });

    return { batchId, filesProcessed, txnsInserted, txnsSkipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import confirm failed";

    await db
      .update(importBatches)
      .set({
        status: "failed",
        filesProcessed,
        txnsInserted,
        txnsSkipped,
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
