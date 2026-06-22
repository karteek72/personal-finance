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

export type DashboardPeriodMode = "rolling" | "month";

/** Current calendar month as `YYYY-MM`. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive calendar-month bounds for `YYYY-MM`. */
export function monthDateRange(month: string): { from: string; to: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number.parseInt(yearStr ?? "1970", 10);
  const monthIndex = Number.parseInt(monthStr ?? "1", 10) - 1;
  const fromDate = new Date(year, monthIndex, 1);
  const toDate = new Date(year, monthIndex + 1, 0);
  return {
    from: formatLocalDate(fromDate),
    to: formatLocalDate(toDate),
  };
}

export function resolveDashboardDateRange(
  mode: DashboardPeriodMode,
  month: string,
): { from: string; to: string } {
  if (mode === "month") {
    return monthDateRange(month);
  }
  return analyticsDateRange();
}

export function dashboardPeriodLabel(
  mode: DashboardPeriodMode,
  month: string,
): string {
  if (mode === "month") {
    const [yearStr, monthStr] = month.split("-");
    const year = Number.parseInt(yearStr ?? "1970", 10);
    const monthIndex = Number.parseInt(monthStr ?? "1", 10) - 1;
    return new Date(year, monthIndex, 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  return analyticsPeriodLabel();
}

/** @deprecated Prefer `analyticsPeriodLabel`. */
export function plaidHistoryPeriodLabel(): string {
  return analyticsPeriodLabel();
}
