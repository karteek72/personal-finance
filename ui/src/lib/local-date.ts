const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Format a local calendar date as YYYY-MM-DD (no UTC shift). */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD as local midnight. ISO timestamps pass through `Date` as-is.
 */
export function parseLocalDate(value: string): Date {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) {
    return new Date(value);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
