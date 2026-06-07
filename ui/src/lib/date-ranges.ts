import { formatLocalDate } from "./local-date";

/** Default dashboard / chart / activity window (statement import friendly). */
export const DEFAULT_ANALYTICS_MONTHS = 12;

/** Rolling calendar-month window for analytics and transaction views. */
export function analyticsDateRange(
  monthsBack = DEFAULT_ANALYTICS_MONTHS,
): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date(
    toDate.getFullYear(),
    toDate.getMonth() - (monthsBack - 1),
    1,
  );
  return {
    from: formatLocalDate(fromDate),
    to: formatLocalDate(toDate),
  };
}

/** @deprecated Prefer `analyticsDateRange` — alias for existing call sites. */
export function plaidHistoryDateRange(): { from: string; to: string } {
  return analyticsDateRange();
}

/** Calendar year (used where a YTD view is intentional). */
export function calendarYearDateRange(year = new Date().getFullYear()): {
  from: string;
  to: string;
} {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Human label for the default analytics window on the dashboard. */
export function analyticsPeriodLabel(
  months = DEFAULT_ANALYTICS_MONTHS,
): string {
  return `Last ${months} months`;
}

/** @deprecated Prefer `analyticsPeriodLabel`. */
export function plaidHistoryPeriodLabel(): string {
  return analyticsPeriodLabel();
}
