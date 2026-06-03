/** Inclusive calendar months between two ISO dates (YYYY-MM-DD). */
export function countMonthsInclusive(from: string, to: string): number {
  const fromParts = from.split("-");
  const toParts = to.split("-");
  const fromYear = Number.parseInt(fromParts[0] ?? "0", 10);
  const fromMonth = Number.parseInt(fromParts[1] ?? "1", 10);
  const toYear = Number.parseInt(toParts[0] ?? "0", 10);
  const toMonth = Number.parseInt(toParts[1] ?? "1", 10);

  if (
    !Number.isFinite(fromYear) ||
    !Number.isFinite(fromMonth) ||
    !Number.isFinite(toYear) ||
    !Number.isFinite(toMonth)
  ) {
    return 1;
  }

  const months = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  return Math.max(1, months);
}
