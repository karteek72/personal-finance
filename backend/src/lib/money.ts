/** Per-share option premium (E*Trade-style, up to 4 decimal places). */
export function formatOptionPremium(value: number | string): string {
  const parsed =
    typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(parsed)) {
    return "0.0000";
  }
  return parsed.toFixed(4);
}

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

const DB_PERCENT_MAX = 999.99;
const DB_PERCENT_MIN = -999.99;

/** Clamp a percent for PostgreSQL numeric(5, 2) columns. */
export function clampDbPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return roundDecimal(
    Math.min(DB_PERCENT_MAX, Math.max(DB_PERCENT_MIN, value)),
    2,
  );
}

/** Serialize a percent for PostgreSQL numeric(5, 2). */
export function formatDbPercent(value: number): string {
  return clampDbPercent(value).toFixed(2);
}

/** Clamp a value to PostgreSQL numeric(precision, scale). */
export function clampDbMoney(
  value: number,
  precision: number,
  scale = 2,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const intDigits = precision - scale;
  const max = 10 ** intDigits - 10 ** -scale;
  const min = -max;
  return roundDecimal(Math.min(max, Math.max(min, value)), scale);
}

/** Serialize money for bounded PostgreSQL numeric columns. */
export function formatDbMoney(
  value: number,
  precision: number,
  scale = 2,
): string {
  return clampDbMoney(value, precision, scale).toFixed(scale);
}
