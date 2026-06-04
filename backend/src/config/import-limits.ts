import type { Env } from "./env.js";

export const IMPORT_BLOB_SALT = "spendflow-import-v1";

/** One file per month — full calendar year in a single upload. */
const DEFAULT_MAX_FILES = 12;
const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
const DEFAULT_MAX_BATCH_BYTES = 120 * 1024 * 1024; // 12 × 10 MiB
const DEFAULT_BLOB_RETENTION_HOURS = 24;

export const IMPORT_ALLOWED_EXTENSIONS = new Set([
  ".qfx",
  ".ofx",
  ".csv",
  ".pdf",
]);

export interface ImportLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxBatchBytes: number;
  blobRetentionHours: number;
}

export function getImportLimits(_env: Env): ImportLimits {
  const maxFiles = parsePositiveInt(
    process.env.IMPORT_MAX_FILES,
    DEFAULT_MAX_FILES,
  );
  const maxFileBytes = parsePositiveInt(
    process.env.IMPORT_MAX_FILE_BYTES,
    DEFAULT_MAX_FILE_BYTES,
  );
  const maxBatchBytes = parsePositiveInt(
    process.env.IMPORT_MAX_BATCH_BYTES,
    DEFAULT_MAX_BATCH_BYTES,
  );
  const blobRetentionHours = parsePositiveInt(
    process.env.IMPORT_BLOB_RETENTION_HOURS,
    DEFAULT_BLOB_RETENTION_HOURS,
  );

  return { maxFiles, maxFileBytes, maxBatchBytes, blobRetentionHours };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function sanitizeImportFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 255);
  return cleaned.length > 0 ? cleaned : "upload";
}
