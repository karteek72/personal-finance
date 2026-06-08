import {
  analyticsDateRange,
  DEFAULT_ANALYTICS_MONTHS,
} from "@/lib/date-ranges";
import type { ChartMonthlyPoint } from "@/types/api";

/** Default analytics range: rolling last 12 calendar months. */
export function yearToDateRange(): { from: string; to: string } {
  return analyticsDateRange();
}

/** Keep monthly overview / charts at most N months even if the API returns more. */
export function sliceLastMonthlyPoints(
  points: ChartMonthlyPoint[],
  maxMonths = DEFAULT_ANALYTICS_MONTHS,
): ChartMonthlyPoint[] {
  if (points.length <= maxMonths) return points;
  return points.slice(-maxMonths);
}

/** Overview strips show newest periods first; charts keep API oldest-first order. */
export function latestPeriodsFirst<T>(points: readonly T[]): T[] {
  return [...points].reverse();
}

export function formatMonthLabel(month: string): string {
  const [, monthPart] = month.split("-");
  const monthIndex = Number.parseInt(monthPart ?? "1", 10) - 1;
  return new Date(2000, monthIndex, 1).toLocaleString("en-US", {
    month: "short",
  });
}

export {
  formatMoneyCompact as formatCurrencyCompact,
  formatMoneyValue as formatCurrency,
} from "@/lib/format-money";

export function createGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number },
  color: string,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(
    0,
    chartArea.top,
    0,
    chartArea.bottom,
  );
  gradient.addColorStop(0, color.replace(")", ", 0.35)").replace("rgb", "rgba"));
  gradient.addColorStop(1, color.replace(")", ", 0.02)").replace("rgb", "rgba"));
  return gradient;
}

export function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}
