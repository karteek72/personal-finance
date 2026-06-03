/** Serialize a currency value for JSON API responses (always 2 decimal places). */
export function formatMoneyAmount(value: number | string): string {
  const parsed =
    typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(parsed)) {
    return "0.00";
  }
  return parsed.toFixed(2);
}

/** Round a number to a fixed number of decimal places. */
export function roundDecimal(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Round a percentage to 2 decimal places for JSON API responses. */
export function roundPercent(value: number): number {
  return roundDecimal(value, 2);
}
