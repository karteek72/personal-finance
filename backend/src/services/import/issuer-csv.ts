import { createHash } from "node:crypto";
import { buildCreditIdentity, buildDepositoryIdentity } from "./account-key.js";
import {
  categorizeBankingTransaction,
  classifyBankingType,
} from "./banking-classify.js";
import {
  headerIndexMap,
  parseCsvRows,
  parseDateUs,
  parseSignedMoney,
  rowValue,
} from "./csv-parse.js";
import type { ParsedBankingTransaction, ParsedStatement } from "./types.js";

function externalId(prefix: string, parts: string[]): string {
  const hash = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
  return `csv:${prefix}:${hash}`;
}

function findHeaderRow(rows: string[][], required: string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const set = new Set(rows[i]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, " ")));
    if (required.every((r) => set.has(r))) {
      return i;
    }
  }
  return -1;
}

function mapIssuerCategory(raw: string): string {
  const t = raw.trim();
  if (!t) return "Uncategorized";
  return t.replace(/\s*-\s*/g, " — ");
}

function extractCitiCardMask(rows: string[][]): string | null {
  for (const row of rows.slice(0, 12)) {
    const joined = row.join(" ");
    const m = joined.match(/Card[-:\s]+(\d{4})/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** American Express: Date, Description, Amount, …, Reference, Category */
export function parseAmexCsv(content: string, filename: string): ParsedStatement {
  const rows = parseCsvRows(content);
  const idx = findHeaderRow(rows, ["date", "description", "amount"]);
  if (idx < 0) {
    throw new Error("Amex CSV: expected Date, Description, Amount columns");
  }

  const map = headerIndexMap(rows[idx]!);
  const banking: ParsedBankingTransaction[] = [];
  const accountRaw = inferMaskFromFilename(filename, "amex");

  for (let i = idx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateUs(rowValue(row, map, "Date"));
    if (!date) continue;

    const description = rowValue(row, map, "Description");
    const appearsAs = rowValue(row, map, "Appears On Your Statement As") || description;
    const reference = rowValue(row, map, "Reference");
    const categoryRaw = rowValue(row, map, "Category");
    const signed = Number.parseFloat(parseSignedMoney(rowValue(row, map, "Amount")));

    const isPayment = signed < 0 || /payment|credit|refund/i.test(description);
    const { transactionType, isTransfer } = isPayment
      ? { transactionType: "transfer" as const, isTransfer: true }
      : classifyBankingType(description, "credit", signed);

    banking.push({
      externalId: externalId("amex", [date, reference || description, String(signed)]),
      date,
      name: appearsAs,
      merchantName: description,
      amount: Math.abs(signed).toFixed(2),
      transactionType,
      isTransfer,
      category: mapIssuerCategory(categoryRaw) || categorizeBankingTransaction(description),
    });
  }

  return {
    format: "csv",
    formatVersion: "amex-activity",
    sourceFilename: filename,
    account: buildCreditIdentity("American Express", accountRaw, `American Express ••${accountRaw}`),
    bankingTransactions: banking,
    investmentTransactions: [],
    warnings: [],
  };
}

/** Discover: Trans. Date, Post Date, Description, Amount, Category */
export function parseDiscoverCsv(content: string, filename: string): ParsedStatement {
  const rows = parseCsvRows(content);
  const idx = findHeaderRow(rows, ["trans. date", "description", "amount"]);
  if (idx < 0) {
    throw new Error("Discover CSV: expected Trans. Date, Description, Amount columns");
  }

  const map = headerIndexMap(rows[idx]!);
  const banking: ParsedBankingTransaction[] = [];
  const accountRaw = inferMaskFromFilename(filename, "discover");

  for (let i = idx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateUs(rowValue(row, map, "Trans. Date", "Post Date"));
    if (!date) continue;

    const description = rowValue(row, map, "Description");
    const categoryRaw = rowValue(row, map, "Category");
    const signed = Number.parseFloat(parseSignedMoney(rowValue(row, map, "Amount")));

    const isCredit = signed < 0;
    const { transactionType, isTransfer } = isCredit
      ? { transactionType: "transfer" as const, isTransfer: true }
      : classifyBankingType(description, "credit", signed);

    banking.push({
      externalId: externalId("discover", [date, description, String(signed)]),
      date,
      name: description,
      merchantName: description,
      amount: Math.abs(signed).toFixed(2),
      transactionType,
      isTransfer,
      category: mapIssuerCategory(categoryRaw) || categorizeBankingTransaction(description),
    });
  }

  return {
    format: "csv",
    formatVersion: "discover-activity",
    sourceFilename: filename,
    account: buildCreditIdentity("Discover", accountRaw, `Discover ••${accountRaw}`),
    bankingTransactions: banking,
    investmentTransactions: [],
    warnings: [],
  };
}

/** Citi card: Date, Description, Debit, Credit, Category (with preamble rows) */
export function parseCitiCardCsv(content: string, filename: string): ParsedStatement {
  const rows = parseCsvRows(content);
  const idx = findHeaderRow(rows, ["date", "description", "debit", "credit"]);
  if (idx < 0) {
    throw new Error("Citi CSV: expected Date, Description, Debit, Credit columns");
  }

  const map = headerIndexMap(rows[idx]!);
  const banking: ParsedBankingTransaction[] = [];
  const accountRaw =
    extractCitiCardMask(rows) ?? inferMaskFromFilename(filename, "citi");

  for (let i = idx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateUs(rowValue(row, map, "Date"));
    if (!date) continue;

    const description = rowValue(row, map, "Description");
    const debit = rowValue(row, map, "Debit");
    const credit = rowValue(row, map, "Credit");
    const categoryRaw = rowValue(row, map, "Category");

    const debitAmt = debit ? Number.parseFloat(debit.replace(/,/g, "")) : 0;
    const creditAmt = credit ? Number.parseFloat(credit.replace(/,/g, "")) : 0;
    const isPayment = creditAmt > 0;
    const expenseAmt = debitAmt > 0 ? debitAmt : 0;

    if (!isPayment && expenseAmt === 0) continue;

    const amount = isPayment
      ? Math.abs(creditAmt).toFixed(2)
      : expenseAmt.toFixed(2);

    const { transactionType, isTransfer } = isPayment
      ? { transactionType: "transfer" as const, isTransfer: true }
      : classifyBankingType(description, "credit", expenseAmt);

    banking.push({
      externalId: externalId("citi", [date, description, debit, credit]),
      date,
      name: description,
      merchantName: description,
      amount,
      transactionType,
      isTransfer: isPayment,
      category: mapIssuerCategory(categoryRaw) || categorizeBankingTransaction(description),
    });
  }

  return {
    format: "csv",
    formatVersion: "citi-card-activity",
    sourceFilename: filename,
    account: buildCreditIdentity("Citi", accountRaw, `Citi ••${accountRaw}`),
    bankingTransactions: banking,
    investmentTransactions: [],
    warnings: [],
  };
}

/**
 * Fidelity monthly statement CSV (positions snapshot) — not an activity export.
 */
export function rejectFidelityStatementCsv(content: string, filename: string): never {
  const rows = parseCsvRows(content);
  const head = rows.slice(0, 8).flat().join(" ").toLowerCase();
  if (head.includes("beginning mkt value") || head.includes("symbol/cusip")) {
    throw new Error(
      `"${filename}" is a Fidelity holdings/summary export, not transaction history. ` +
        "In Fidelity, download **Accounts > Activity & Orders > Activity** as CSV (must include Run Date, Action, Symbol).",
    );
  }
  throw new Error(`Unsupported Fidelity CSV format in "${filename}".`);
}

function inferMaskFromFilename(filename: string, prefix: string): string {
  const digits = filename.replace(/\D/g, "");
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return createHash("sha256").update(`${prefix}-${filename}`).digest("hex").slice(0, 4);
}

export type IssuerCsvId = "amex" | "discover" | "citi-card";

export function detectIssuerCsv(content: string, filename = ""): IssuerCsvId | null {
  const rows = parseCsvRows(content);
  const headers = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const h of row) {
      headers.add(h.trim().toLowerCase().replace(/\s+/g, " "));
    }
  }

  const flat = rows
    .slice(0, 12)
    .flat()
    .join(" ")
    .toLowerCase();
  if (flat.includes("beginning mkt value") || flat.includes("symbol/cusip")) {
    return null;
  }

  if (headers.has("trans. date") && headers.has("description") && headers.has("amount")) {
    return "discover";
  }
  if (
    headers.has("date") &&
    headers.has("description") &&
    headers.has("debit") &&
    headers.has("credit")
  ) {
    return "citi-card";
  }
  if (headers.has("date") && headers.has("description") && headers.has("amount")) {
    const nameHint = /amex|american.?express/i.test(filename);
    if (
      headers.has("reference") ||
      headers.has("extended details") ||
      headers.has("appears on your statement as") ||
      (headers.has("category") && !headers.has("action") && !headers.has("symbol")) ||
      (nameHint && !headers.has("action") && !headers.has("symbol") && !headers.has("type"))
    ) {
      return "amex";
    }
  }

  return null;
}

export function parseIssuerCsv(
  issuerId: IssuerCsvId,
  content: string,
  filename: string,
): ParsedStatement {
  switch (issuerId) {
    case "amex":
      return parseAmexCsv(content, filename);
    case "discover":
      return parseDiscoverCsv(content, filename);
    case "citi-card":
      return parseCitiCardCsv(content, filename);
  }
}
