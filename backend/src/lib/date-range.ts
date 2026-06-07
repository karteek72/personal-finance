const DAY_MS = 86_400_000;

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

/** Prior period of the same inclusive day count immediately before `from`. */
export function priorComparablePeriod(
  from: string,
  to: string,
): { priorFrom: string; priorTo: string } {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  const periodDays =
    Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  const priorToDate = subtractDays(fromDate, 1);
  const priorFromDate = subtractDays(priorToDate, periodDays - 1);
  return {
    priorFrom: formatIsoDate(priorFromDate),
    priorTo: formatIsoDate(priorToDate),
  };
}

/** Percent change vs prior period; returns 0 when prior is 0 (avoids divide-by-zero). */
export function deltaPercentVsPrior(current: number, prior: number): number {
  if (prior <= 0) {
    return 0;
  }
  return ((current - prior) / prior) * 100;
}

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
