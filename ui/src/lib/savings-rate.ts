/**
 * Savings rate contract: API values are 0–1 fractions (unit=percent).
 * Multiply by 100 exactly once at display.
 */

/** Normalize to 0–1; accepts legacy mock/API values already scaled 0–100. */
export function normalizeSavingsRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 0;
  }
  if (rate > 1) {
    return rate / 100;
  }
  return rate;
}

/** Format for display (single ×100). */
export function formatSavingsRatePercent(rate: number, digits = 1): string {
  return `${(normalizeSavingsRate(rate) * 100).toFixed(digits)}%`;
}
