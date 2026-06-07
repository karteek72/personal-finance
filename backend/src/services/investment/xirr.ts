export interface XirrCashflow {
  date: string;
  amount: number;
}

const DAY_MS = 86_400_000;
const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

function parseDateMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

function yearFraction(fromMs: number, dateMs: number): number {
  return (dateMs - fromMs) / (365 * DAY_MS);
}

function npv(rate: number, flows: XirrCashflow[], baseMs: number): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (const flow of flows) {
    const t = yearFraction(baseMs, parseDateMs(flow.date));
    sum += flow.amount / (1 + rate) ** t;
  }
  return sum;
}

function npvDerivative(rate: number, flows: XirrCashflow[], baseMs: number): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (const flow of flows) {
    const t = yearFraction(baseMs, parseDateMs(flow.date));
    sum -= (t * flow.amount) / (1 + rate) ** (t + 1);
  }
  return sum;
}

/**
 * Money-weighted return (XIRR) as a 0–1 fraction.
 * Outflows (investments) are negative; inflows (proceeds, dividends, terminal) positive.
 */
export function computeXirr(flows: XirrCashflow[]): number | null {
  if (flows.length < 2) return null;

  const hasNegative = flows.some((f) => f.amount < 0);
  const hasPositive = flows.some((f) => f.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const baseMs = Math.min(...flows.map((f) => parseDateMs(f.date)));
  let rate = 0.1;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const value = npv(rate, flows, baseMs);
    if (Math.abs(value) < TOLERANCE) {
      return rate;
    }
    const derivative = npvDerivative(rate, flows, baseMs);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) {
      break;
    }
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.999) {
      break;
    }
    rate = next;
  }

  // Bisection fallback between -99% and 1000%
  let low = -0.99;
  let high = 10;
  let fLow = npv(low, flows, baseMs);
  let fHigh = npv(high, flows, baseMs);
  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const mid = (low + high) / 2;
    const fMid = npv(mid, flows, baseMs);
    if (Math.abs(fMid) < TOLERANCE) return mid;
    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}
