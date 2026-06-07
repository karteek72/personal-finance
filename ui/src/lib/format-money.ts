const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

const moneyFormatterCache = new Map<string, Intl.NumberFormat>();

function getMoneyFormatter(currency: string): Intl.NumberFormat {
  let fmt = moneyFormatterCache.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatterCache.set(currency, fmt);
  }
  return fmt;
}

export function parseMoney(amount: string): number {
  const trimmed = amount.trim();
  if (!MONEY_PATTERN.test(trimmed)) {
    throw new Error(`Invalid money string: ${amount}`);
  }
  return Number.parseFloat(trimmed);
}

/** Canonical money display — always currency symbol + 2 decimals. */
export function formatMoneyValue(value: number, currency = "USD"): string {
  if (!Number.isFinite(value)) {
    return getMoneyFormatter(currency).format(0);
  }
  return getMoneyFormatter(currency).format(value);
}

export function formatMoney(amount: string, currency = "USD"): string {
  return formatMoneyValue(parseMoney(amount), currency);
}

/** Compact axis/tooltip labels; defers to full formatter below $1k. */
export function formatMoneyCompact(value: number, currency = "USD"): string {
  if (!Number.isFinite(value)) {
    return formatMoneyValue(0, currency);
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const symbol =
    getMoneyFormatter(currency).formatToParts(0).find((p) => p.type === "currency")
      ?.value ?? "$";
  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`;
  }
  return formatMoneyValue(value, currency);
}

export function formatDelta(amount: string, percent: number): string {
  const value = parseMoney(amount);
  const sign = value >= 0 ? "+" : "−";
  const absFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const percentSign = percent >= 0 ? "+" : "−";
  const absPercent = Math.abs(percent).toFixed(1);
  return `${sign}${absFormatted} (${percentSign}${absPercent}%)`;
}
