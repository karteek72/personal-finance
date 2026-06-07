export interface PortfolioDailyPoint {
  date: string;
  value: number;
  cost?: number;
}

export interface CashFlowOnDate {
  date: string;
  amount: number;
}

export interface TwrResult {
  twr: number;
  subPeriodCount: number;
}

export interface DrawdownResult {
  maxDrawdown: number;
  peakDate: string;
  troughDate: string;
}

export interface BenchmarkPoint {
  date: string;
  close: number;
}

/** Geometrically linked time-weighted return over daily portfolio values. */
export function computeTwr(
  values: PortfolioDailyPoint[],
  cashFlows: CashFlowOnDate[] = [],
): TwrResult | null {
  if (values.length < 2) return null;

  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const flowByDate = new Map<string, number>();
  for (const flow of cashFlows) {
    flowByDate.set(flow.date, (flowByDate.get(flow.date) ?? 0) + flow.amount);
  }

  let linked = 1;
  let subPeriodCount = 0;

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr || prev.value <= 0) continue;

    const netFlow = flowByDate.get(curr.date) ?? 0;
    const adjustedEnd = curr.value - netFlow;
    const periodReturn = adjustedEnd / prev.value;
    if (!Number.isFinite(periodReturn) || periodReturn <= 0) continue;

    linked *= periodReturn;
    subPeriodCount += 1;
  }

  if (subPeriodCount === 0) return null;
  return { twr: linked - 1, subPeriodCount };
}

/** Max drawdown = min(value / running_peak - 1). Returns negative fraction. */
export function computeMaxDrawdown(values: PortfolioDailyPoint[]): DrawdownResult | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  let peak = sorted[0]?.value ?? 0;
  let peakDate = sorted[0]?.date ?? "";
  let maxDrawdown = 0;
  let troughDate = sorted[0]?.date ?? "";
  let recordPeakDate = peakDate;

  for (const point of sorted) {
    if (point.value > peak) {
      peak = point.value;
      peakDate = point.date;
    }
    if (peak <= 0) continue;
    const dd = point.value / peak - 1;
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
      troughDate = point.date;
      recordPeakDate = peakDate;
    }
  }

  return {
    maxDrawdown,
    peakDate: recordPeakDate,
    troughDate,
  };
}

/** Buy-and-hold benchmark return from price series over the same window. */
export function computeBenchmarkReturn(
  prices: BenchmarkPoint[],
  from: string,
  to: string,
): number | null {
  const inRange = prices
    .filter((p) => p.date >= from && p.date <= to && p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (inRange.length < 2) return null;
  const start = inRange[0]?.close ?? 0;
  const end = inRange[inRange.length - 1]?.close ?? 0;
  if (start <= 0) return null;
  return end / start - 1;
}

/** Portfolio TWR minus benchmark return (both as fractions). */
export function computeBenchmarkDelta(
  portfolioTwr: number,
  benchmarkReturn: number,
): number {
  return portfolioTwr - benchmarkReturn;
}
