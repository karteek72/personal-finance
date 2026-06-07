import type { Env } from "../../config/env.js";
import type { getDb } from "../../db/client.js";
import { importFiles } from "../../db/schema.js";
import { IMPORT_BLOB_SALT } from "../../config/import-limits.js";
import { decryptBytes } from "../../lib/field-crypto.js";
import { createLogger } from "../../lib/logger.js";
import type { CategoryRule } from "../category-rules.js";
import { enrichStatementsWithClassification } from "./enrich-classification.js";
import { findMatchingImportAccount } from "./account-resolver.js";
import { parseImportFileAsync } from "./parse-file.js";
import type { ImportFilePreviewPayload } from "./types.js";
import { eq } from "drizzle-orm";

const log = createLogger("import.parse-file-record");

export type ParseImportFileOutcome = "preview_ready" | "failed";

export async function parseImportFileRecord(
  db: ReturnType<typeof getDb>,
  userId: string,
  file: typeof importFiles.$inferSelect,
  env: Env,
  categoryRules: Map<string, CategoryRule>,
): Promise<ParseImportFileOutcome> {
  await db
    .update(importFiles)
    .set({ status: "parsing", errorMessage: null })
    .where(eq(importFiles.id, file.id));

  try {
    if (!file.contentEncrypted?.trim()) {
      throw new Error(
        "Encrypted file content is no longer available. Replace this file with a new upload.",
      );
    }

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
        await findMatchingImportAccount(db, userId, stmt.account),
      );
    }

    const preview: ImportFilePreviewPayload = {
      statements,
      matchedAccountIds,
    };

    await db
      .update(importFiles)
      .set({
        status: "preview_ready",
        parsedPreview: preview,
        errorMessage:
          statements.flatMap((s) => s.warnings).join("; ") || null,
      })
      .where(eq(importFiles.id, file.id));

    log.info(
      {
        fileId: file.id,
        batchId: file.batchId,
        banking: statements.reduce(
          (n, s) => n + s.bankingTransactions.length,
          0,
        ),
        investment: statements.reduce(
          (n, s) => n + s.investmentTransactions.length,
          0,
        ),
      },
      "import file preview ready",
    );

    return "preview_ready";
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not parse this file.";

    await db
      .update(importFiles)
      .set({
        status: "failed",
        parsedPreview: null,
        errorMessage: message,
      })
      .where(eq(importFiles.id, file.id));

    log.warn({ err, fileId: file.id, batchId: file.batchId }, "import file parse failed");
    return "failed";
  }
}
