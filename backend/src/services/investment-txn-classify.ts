/** Maps broker activity labels to persisted investment_transactions.type values. */
export type PersistedInvestmentTxnType =
  | "buy"
  | "sell"
  | "dividend"
  | "contribution"
  | "fee";

const NON_CONTRIBUTION_NAME =
  /withdraw|transfer|journal|acat|wire out|wire in|disbursement|reversal|corporate action|stock split|spinoff|merger|adjustment|interest paid|interest earned|margin interest|tax withholding|foreign tax|adr fee|management fee|platform fee|regulatory fee|assignment|exercise|expiration|cash in lieu|return of capital|distribution(?! reinvest)/i;

/** SnapTrade fallback labels when description is missing, e.g. "TRANSFER AAPL". */
const NON_BUY_ACTIVITY_PREFIX =
  /^(transfer|withdrawal|disbursement|journal|acat|fee|tax|commission|interest|split|merger|spinoff|adjustment|activity|sell|sto|stc|ssh|dividend)(\s|$)/i;

/** Activity names that look like cash movement, not a security purchase. */
export function isNonContributionActivityName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return (
    NON_CONTRIBUTION_NAME.test(trimmed) ||
    NON_BUY_ACTIVITY_PREFIX.test(trimmed)
  );
}

/** True when a persisted row should not count as buy/contribution cash deployed. */
export function shouldReclassifyAsNonContribution(input: {
  type: string;
  name: string;
  securityId: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
}): boolean {
  if (isNonContributionActivityName(input.name)) return true;

  if (input.type === "contribution") {
    return NON_BUY_ACTIVITY_PREFIX.test(input.name.trim());
  }

  if (input.type !== "buy") return false;

  const qty = Math.abs(Number.parseFloat(input.quantity ?? "0"));
  const price = Number.parseFloat(input.price ?? "0");
  const reported = Math.abs(Number.parseFloat(input.amount));
  if (reported <= 0) return true;

  // Cash movements mis-labeled as buys often have no linked security.
  if (!input.securityId && qty <= 0 && price <= 0 && reported >= 500) {
    return true;
  }

  // Missing fill details with a huge amount is usually broker notional noise.
  if (qty <= 0 && price <= 0 && reported >= 25_000) {
    return true;
  }

  return false;
}

/** SnapTrade account activity `type` → stored transaction type. */
export function mapSnaptradeActivityType(
  raw: string | null | undefined,
): PersistedInvestmentTxnType {
  const t = (raw ?? "").trim().toUpperCase();
  if (!t) return "fee";

  if (t === "BUY" || t === "BTO" || t === "BTC" || t === "REI") return "buy";
  if (t === "SELL" || t === "STO" || t === "STC" || t === "SSH") return "sell";
  if (t.includes("DIVIDEND")) return "dividend";
  if (t === "CONTRIBUTION" || t === "DEPOSIT" || t === "ACH") {
    return "contribution";
  }

  // Withdrawals, transfers, and journals are not new money invested in securities.
  if (
    t === "WITHDRAWAL" ||
    t === "DISBURSEMENT" ||
    t === "TRANSFER" ||
    t === "JOURNAL" ||
    t === "ACAT"
  ) {
    return "fee";
  }

  if (
    t === "FEE" ||
    t === "TAX" ||
    t === "COMMISSION" ||
    t === "INTEREST" ||
    t === "SPLIT" ||
    t === "MERGER" ||
    t === "SPINOFF" ||
    t === "ADJUSTMENT"
  ) {
    return "fee";
  }

  return "fee";
}
