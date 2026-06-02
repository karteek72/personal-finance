const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export function parseMoney(amount: string): number {
  const trimmed = amount.trim();
  if (!MONEY_PATTERN.test(trimmed)) {
    throw new Error(`Invalid money string: ${amount}`);
  }
  return Number.parseFloat(trimmed);
}

export function formatMoney(amount: string, currency = "USD"): string {
  const value = parseMoney(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
