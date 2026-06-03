/** Round a percentage to 2 decimal places. */
export function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

/** Format a percentage for display (always 2 decimal places). */
export function formatPercent(value: number): string {
  return `${roundPercent(value).toFixed(2)}%`;
}
