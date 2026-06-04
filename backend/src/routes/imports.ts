import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { eq, and, inArray } from "drizzle-orm";
import {
  getImportLimits,
  sanitizeImportFilename,
  IMPORT_BLOB_SALT,
} from "../config/import-limits.js";
import { getDb } from "../db/client.js";
import { importBatches, importFiles } from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import { encryptBytes } from "../lib/field-crypto.js";
import { requireRequestUser } from "../lib/auth-http.js";
import {
  detectImportFormat,
  isAllowedImportExtension,
} from "../services/import/detect-format.js";
import {
  computeImportBatchSummary,
  fileCanReplace,
  fileCanRetryParse,
} from "../services/import/import-batch-summary.js";
import {
  previewImportBatch,
  confirmImportBatch,
  retryImportFile,
  retryAllFailedImportFiles,
  replaceImportFile,
} from "../services/import/process-import-batch.js";
import {
  getAccountLinkSuggestions,
  mergeImportAccountIntoPlaid,
} from "../services/import/link-suggestions.js";
import type { ImportFilePreviewPayload } from "../services/import/types.js";
import {
  auditContextFromRequest,
  logImportAuditEvent,
  recordStatementImportConsent,
} from "../services/import/import-audit.js";
import { enqueueImportBatch, isRedisConfigured } from "../jobs/queue.js";

const CONSENT_VERSION = "statement_import_v1";

const FORMAT_INFO = [
  {
    id: "qfx_ofx",
    label: "QFX / OFX",
    extensions: [".qfx", ".ofx"],
    description:
      "Best for bank, credit, and brokerage. Rich account metadata and trade IDs.",
    brokers: ["Fidelity (QFX)", "Some E*TRADE exports"],
  },
  {
    id: "csv",
    label: "CSV",
    extensions: [".csv"],
    description:
      "Broker activity exports. Ideal for day-trading history (E*TRADE, Fidelity, Webull).",
    brokers: ["E*TRADE", "Fidelity", "Webull", "Schwab", "Robinhood", "Coinbase", "SoFi"],
  },
  {
    id: "pdf",
    label: "PDF",
    extensions: [".pdf"],
    description:
      "Monthly statements when CSV/OFX is unavailable. Parsed per institution.",
    brokers: ["SoFi Invest", "Bank statements (BoFA via CLI)"],
  },
] as const;

function buildFilePreviewSummary(
  preview: ImportFilePreviewPayload | null,
): {
  accounts: {
    institutionName: string;
    mask: string;
    type: string;
    subtype: string;
    matchedAccountId: string | null;
    bankingCount: number;
    investmentCount: number;
  }[];
  dateRange: { min: string | null; max: string | null };
  sampleTransactions: { date: string; name: string; amount: string }[];
} | null {
  if (!preview) return null;

  const dates: string[] = [];
  const samples: { date: string; name: string; amount: string }[] = [];

  const accounts = preview.statements.map((stmt, i) => {
    for (const t of stmt.bankingTransactions) {
      dates.push(t.date);
      if (samples.length < 5) {
        samples.push({ date: t.date, name: t.name, amount: t.amount });
      }
    }
    for (const t of stmt.investmentTransactions) {
      dates.push(t.date);
      if (samples.length < 5) {
        samples.push({ date: t.date, name: t.name, amount: t.amount });
      }
    }
    return {
      institutionName: stmt.account.institutionName,
      mask: stmt.account.mask,
      type: stmt.account.type,
      subtype: stmt.account.subtype,
      matchedAccountId: preview.matchedAccountIds[i] ?? null,
      bankingCount: stmt.bankingTransactions.length,
      investmentCount: stmt.investmentTransactions.length,
    };
  });

  dates.sort();
  return {
    accounts,
    dateRange: { min: dates[0] ?? null, max: dates.at(-1) ?? null },
    sampleTransactions: samples,
  };
}

export const importRoutes: FastifyPluginAsync = async (app) => {
  const limits = getImportLimits(app.config.env);

  await app.register(multipart, {
    limits: {
      files: limits.maxFiles,
      fileSize: limits.maxFileBytes,
    },
  });

  app.get("/imports/formats", async (request) => {
    await requireRequestUser(request, app.config.env);

    return {
      formats: FORMAT_INFO,
      limits: {
        maxFiles: limits.maxFiles,
        maxFileBytes: limits.maxFileBytes,
        maxBatchBytes: limits.maxBatchBytes,
      },
      consentVersion: CONSENT_VERSION,
    };
  });

  app.post("/imports/batches", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);
    const db = getDb();

    const active = await db
      .select({ id: importBatches.id })
      .from(importBatches)
      .where(
        and(
          eq(importBatches.userId, user.id),
          inArray(importBatches.status, [
            "pending",
            "processing",
            "awaiting_confirmation",
          ]),
        ),
      )
      .limit(1);

    if (active.length > 0) {
      throw AppError.validation(
        "An import is already in progress. Wait for it to finish or cancel it.",
      );
    }

    let consentAccepted = false;
    const parts = request.parts();
    const fileBuffers: {
      filename: string;
      buffer: Buffer;
      format: ReturnType<typeof detectImportFormat>;
    }[] = [];
    let totalBytes = 0;

    for await (const part of parts) {
      if (part.type === "field") {
        if (part.fieldname === "consentAccepted") {
          const raw: unknown = await part.value;
          const value = String(raw).trim().toLowerCase();
          consentAccepted = value === "true" || value === "1" || value === "yes";
        }
        continue;
      }

      if (part.type !== "file") {
        continue;
      }

      if (fileBuffers.length >= limits.maxFiles) {
        throw AppError.validation(
          `Too many files. Maximum ${limits.maxFiles} files per upload.`,
        );
      }

      const rawName = part.filename ?? "upload";
      const filename = sanitizeImportFilename(rawName);

      if (!isAllowedImportExtension(filename)) {
        throw AppError.validation(
          `Unsupported file type: ${filename}. Use .qfx, .ofx, .csv, or .pdf.`,
        );
      }

      const buffer = await part.toBuffer();

      if (buffer.length > limits.maxFileBytes) {
        throw AppError.validation(
          `File "${filename}" exceeds the ${limits.maxFileBytes} byte limit.`,
        );
      }

      totalBytes += buffer.length;
      if (totalBytes > limits.maxBatchBytes) {
        throw AppError.validation(
          `Total upload size exceeds the ${limits.maxBatchBytes} byte batch limit.`,
        );
      }

      const format = detectImportFormat(filename, buffer);
      if (format === "unknown") {
        throw AppError.validation(
          `Could not verify format for "${filename}". Check the file is a valid statement export.`,
        );
      }

      fileBuffers.push({ filename, buffer, format });
    }

    if (!consentAccepted) {
      throw AppError.validation(
        "Consent is required before uploading financial statement files.",
      );
    }

    if (fileBuffers.length === 0) {
      throw AppError.validation("At least one file is required.");
    }

    const [batch] = await db
      .insert(importBatches)
      .values({
        userId: user.id,
        status: "pending",
        filesTotal: fileBuffers.length,
        consentVersion: CONSENT_VERSION,
      })
      .returning({ id: importBatches.id });

    if (!batch) {
      throw AppError.internal();
    }

    for (const file of fileBuffers) {
      const encrypted = encryptBytes(
        file.buffer,
        app.config.env,
        IMPORT_BLOB_SALT,
      );

      await db.insert(importFiles).values({
        batchId: batch.id,
        userId: user.id,
        filename: file.filename,
        format: file.format,
        byteSize: file.buffer.length,
        contentEncrypted: encrypted,
        status: "stored",
      });
    }

    request.log.info(
      {
        userId: user.id,
        batchId: batch.id,
        fileCount: fileBuffers.length,
        totalBytes,
      },
      "statement import batch stored (encrypted)",
    );

    const auditCtx = auditContextFromRequest(request);
    await recordStatementImportConsent(
      db,
      user.id,
      CONSENT_VERSION,
      auditCtx,
    );
    await logImportAuditEvent(
      db,
      user.id,
      "statement_import_upload",
      "import_batch",
      batch.id,
      { filesTotal: fileBuffers.length, totalBytes },
      auditCtx,
    );

    const enqueued = await enqueueImportBatch(app.config.env, batch.id);
    if (enqueued) {
      request.log.info({ batchId: batch.id }, "import batch queued for parsing");
    } else if (isRedisConfigured(app.config.env)) {
      request.log.warn({ batchId: batch.id }, "failed to enqueue import batch");
    } else {
      void previewImportBatch(batch.id, app.config.env).catch((err: unknown) => {
        request.log.error({ err, batchId: batch.id }, "inline import preview failed");
      });
    }

    reply.header("Cache-Control", "no-store");

    return {
      batchId: batch.id,
      status: enqueued ? ("processing" as const) : ("pending" as const),
      filesTotal: fileBuffers.length,
      message: enqueued
        ? "Files received securely. Parsing has started."
        : isRedisConfigured(app.config.env)
          ? "Files received securely. Parsing will start shortly."
          : "Files received securely. Parsing in background (no Redis queue).",
    };
  });

  app.get("/imports/batches/:batchId", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const { batchId } = request.params as { batchId: string };
    const db = getDb();

    const [batch] = await db
      .select()
      .from(importBatches)
      .where(
        and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id)),
      )
      .limit(1);

    if (!batch) {
      throw AppError.notFound("Import batch not found.");
    }

    const files = await db
      .select({
        id: importFiles.id,
        filename: importFiles.filename,
        format: importFiles.format,
        byteSize: importFiles.byteSize,
        status: importFiles.status,
        errorMessage: importFiles.errorMessage,
        parsedPreview: importFiles.parsedPreview,
        contentEncrypted: importFiles.contentEncrypted,
      })
      .from(importFiles)
      .where(eq(importFiles.batchId, batchId));

    const summary = computeImportBatchSummary(files);

    return {
      batch: {
        id: batch.id,
        status: batch.status,
        filesTotal: batch.filesTotal,
        filesProcessed: batch.filesProcessed,
        txnsInserted: batch.txnsInserted,
        txnsSkipped: batch.txnsSkipped,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt.toISOString(),
        completedAt: batch.completedAt?.toISOString() ?? null,
      },
      summary: {
        ...summary,
        canRetryFailed: files.some((f) =>
          fileCanRetryParse(f.status, f.contentEncrypted),
        ),
        canConfirm: summary.ready > 0,
      },
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        format: f.format,
        byteSize: f.byteSize,
        status: f.status,
        errorMessage: f.errorMessage,
        canRetry: fileCanRetryParse(f.status, f.contentEncrypted),
        canReplace: fileCanReplace(f.status),
        preview: buildFilePreviewSummary(
          f.parsedPreview as ImportFilePreviewPayload | null,
        ),
      })),
    };
  });

  app.post("/imports/batches/:batchId/confirm", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);
    const { batchId } = request.params as { batchId: string };
    const body = (request.body ?? {}) as {
      accountMappings?: Record<string, string>;
      fileIds?: string[];
    };
    const db = getDb();

    const [batch] = await db
      .select({ id: importBatches.id })
      .from(importBatches)
      .where(
        and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id)),
      )
      .limit(1);

    if (!batch) {
      throw AppError.notFound("Import batch not found.");
    }

    try {
      const result = await confirmImportBatch(batchId, app.config.env, {
        accountMappings: body.accountMappings,
        fileIds: body.fileIds,
      });

      const [updated] = await db
        .select({ status: importBatches.status })
        .from(importBatches)
        .where(eq(importBatches.id, batchId))
        .limit(1);

      reply.header("Cache-Control", "no-store");
      return {
        batchId,
        status: (updated?.status === "completed"
          ? "completed"
          : "awaiting_confirmation") as "completed" | "awaiting_confirmation",
        txnsInserted: result.txnsInserted,
        txnsSkipped: result.txnsSkipped,
        filesImported: result.filesImported ?? 0,
        message:
          updated?.status === "completed"
            ? `Imported ${result.txnsInserted} transactions (${result.txnsSkipped} duplicates skipped).`
            : `Imported ${result.filesImported ?? 0} file(s). ${result.txnsInserted} transactions added (${result.txnsSkipped} duplicates skipped). More files still awaiting confirmation.`,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not confirm import.";
      throw AppError.validation(message);
    }
  });

  app.post("/imports/batches/:batchId/retry-failed", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);
    const { batchId } = request.params as { batchId: string };
    const db = getDb();

    const [batch] = await db
      .select({ id: importBatches.id })
      .from(importBatches)
      .where(
        and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id)),
      )
      .limit(1);

    if (!batch) {
      throw AppError.notFound("Import batch not found.");
    }

    try {
      const result = await retryAllFailedImportFiles(batchId, app.config.env);
      reply.header("Cache-Control", "no-store");
      return {
        batchId,
        retried: result.retried,
        message: `Retrying ${result.retried} failed file(s).`,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not retry failed files.";
      throw AppError.validation(message);
    }
  });

  app.post(
    "/imports/batches/:batchId/files/:fileId/retry",
    async (request, reply) => {
      const user = await requireRequestUser(request, app.config.env);
      const { batchId, fileId } = request.params as {
        batchId: string;
        fileId: string;
      };
      const db = getDb();

      const [batch] = await db
        .select({ id: importBatches.id })
        .from(importBatches)
        .where(
          and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id)),
        )
        .limit(1);

      if (!batch) {
        throw AppError.notFound("Import batch not found.");
      }

      try {
        await retryImportFile(batchId, fileId, app.config.env);
        reply.header("Cache-Control", "no-store");
        return {
          batchId,
          fileId,
          message: "File parse retried.",
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not retry file.";
        throw AppError.validation(message);
      }
    },
  );

  app.post(
    "/imports/batches/:batchId/files/:fileId/replace",
    async (request, reply) => {
      const user = await requireRequestUser(request, app.config.env);
      const { batchId, fileId } = request.params as {
        batchId: string;
        fileId: string;
      };
      const db = getDb();

      const [batch] = await db
        .select({ id: importBatches.id })
        .from(importBatches)
        .where(
          and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id)),
        )
        .limit(1);

      if (!batch) {
        throw AppError.notFound("Import batch not found.");
      }

      const parts = request.parts();
      let buffer: Buffer | null = null;
      let filename: string | null = null;

      for await (const part of parts) {
        if (part.type !== "file") {
          continue;
        }
        buffer = await part.toBuffer();
        filename = sanitizeImportFilename(part.filename ?? "upload");
        break;
      }

      if (!buffer || !filename) {
        throw AppError.validation("A replacement file is required.");
      }

      if (!isAllowedImportExtension(filename)) {
        throw AppError.validation(
          `Unsupported file type: ${filename}. Use .qfx, .ofx, .csv, or .pdf.`,
        );
      }

      if (buffer.length > limits.maxFileBytes) {
        throw AppError.validation(
          `File "${filename}" exceeds the ${limits.maxFileBytes} byte limit.`,
        );
      }

      const format = detectImportFormat(filename, buffer);
      if (format === "unknown") {
        throw AppError.validation(
          `Could not verify format for "${filename}". Check the file is a valid statement export.`,
        );
      }

      try {
        await replaceImportFile(
          batchId,
          fileId,
          buffer,
          filename,
          format,
          app.config.env,
        );
        reply.header("Cache-Control", "no-store");
        return {
          batchId,
          fileId,
          message: "File replaced and re-parsed.",
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not replace file.";
        throw AppError.validation(message);
      }
    },
  );

  app.get("/imports/link-suggestions", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const db = getDb();
    const suggestions = await getAccountLinkSuggestions(db, user.id);
    return { suggestions };
  });

  app.post("/imports/accounts/merge", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = request.body as {
      importAccountId?: string;
      plaidAccountId?: string;
    };

    if (!body.importAccountId || !body.plaidAccountId) {
      throw AppError.validation(
        "importAccountId and plaidAccountId are required.",
      );
    }

    const db = getDb();
    await mergeImportAccountIntoPlaid(
      db,
      user.id,
      body.importAccountId,
      body.plaidAccountId,
    );

    return { ok: true };
  });

  app.delete("/imports/batches/:batchId", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);
    const { batchId } = request.params as { batchId: string };
    const db = getDb();

    const deleted = await db
      .delete(importBatches)
      .where(
        and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id)),
      )
      .returning({ id: importBatches.id });

    if (deleted.length === 0) {
      throw AppError.notFound("Import batch not found.");
    }

    const auditCtx = auditContextFromRequest(request);
    await logImportAuditEvent(
      db,
      user.id,
      "statement_import_delete",
      "import_batch",
      batchId,
      {},
      auditCtx,
    );

    request.log.info({ userId: user.id, batchId }, "import batch deleted");

    reply.header("Cache-Control", "no-store");
    return reply.status(204).send();
  });
};
