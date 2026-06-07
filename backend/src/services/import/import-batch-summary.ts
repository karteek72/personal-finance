import type { ImportFilePreviewPayload } from "./types.js";

export interface ImportBatchSummary {
  total: number;
  pending: number;
  ready: number;
  failed: number;
  imported: number;
  bankingTransactions: number;
  investmentTransactions: number;
}

interface FileRowForSummary {
  status: string;
  parsedPreview: ImportFilePreviewPayload | null | unknown;
}

function countTransactions(preview: ImportFilePreviewPayload | null): {
  banking: number;
  investment: number;
} {
  if (!preview) {
    return { banking: 0, investment: 0 };
  }
  let banking = 0;
  let investment = 0;
  for (const stmt of preview.statements) {
    banking += stmt.bankingTransactions.length;
    investment += stmt.investmentTransactions.length;
  }
  return { banking, investment };
}

export function computeImportBatchSummary(
  files: FileRowForSummary[],
): ImportBatchSummary {
  let pending = 0;
  let ready = 0;
  let failed = 0;
  let imported = 0;
  let bankingTransactions = 0;
  let investmentTransactions = 0;

  for (const file of files) {
    switch (file.status) {
      case "preview_ready":
        ready++;
        break;
      case "parsed":
        imported++;
        break;
      case "failed":
        failed++;
        break;
      case "stored":
      case "parsing":
        pending++;
        break;
      default:
        break;
    }

    if (file.status === "preview_ready" && file.parsedPreview) {
      const counts = countTransactions(
        file.parsedPreview as ImportFilePreviewPayload,
      );
      bankingTransactions += counts.banking;
      investmentTransactions += counts.investment;
    }
  }

  return {
    total: files.length,
    pending,
    ready,
    failed,
    imported,
    bankingTransactions,
    investmentTransactions,
  };
}

export function fileCanRetryParse(
  status: string,
  contentEncrypted: string | null | undefined,
): boolean {
  return status === "failed" && Boolean(contentEncrypted?.trim());
}

export function fileCanReplace(status: string): boolean {
  return status === "failed";
}
