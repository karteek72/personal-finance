import { createHash } from "node:crypto";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

function hashParts(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function bankingDedupFingerprint(
  accountId: string,
  date: string,
  amount: string,
  name: string,
): string {
  return hashParts([accountId, date, amount, normalizeName(name)]);
}

export function investmentDedupFingerprint(
  accountId: string,
  date: string,
  type: string,
  amount: string,
  ticker: string | undefined,
  quantity: string | undefined,
): string {
  return hashParts([
    accountId,
    date,
    type,
    amount,
    (ticker ?? "").toUpperCase(),
    quantity ?? "",
  ]);
}
