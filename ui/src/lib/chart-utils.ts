import { plaidHistoryDateRange } from "@/lib/date-ranges";

/** Default analytics range: up to 2 years of Plaid history. */
export function yearToDateRange(): { from: string; to: string } {
  return plaidHistoryDateRange();
}

export function formatMonthLabel(month: string): string {
  const [, monthPart] = month.split("-");
  const monthIndex = Number.parseInt(monthPart ?? "1", 10) - 1;
  return new Date(2000, monthIndex, 1).toLocaleString("en-US", {
    month: "short",
  });
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return formatCurrency(value);
}

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
