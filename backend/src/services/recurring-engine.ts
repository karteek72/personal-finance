import { roundDecimal } from "../lib/money.js";
import { daysBetween } from "./recurring-lifecycle.js";

export type RecurringCadence = "weekly" | "monthly" | "quarterly" | "annual";

export interface RecurringCharge {
  date: string;
  amount: number;
  category: string;
}

export interface RecurringFlags {
  priceCreep: boolean;
  zombie: boolean;
  duplicate: boolean;
  freeTrialJump: boolean;
  confidence: number;
  priceCreepPct: number | null;
}

export interface RecurringSeriesCandidate {
  merchantKey: string;
  displayName: string;
  charges: RecurringCharge[];
  cadence: RecurringCadence;
  medAmount: number;
  category: string;
}

const CADENCE_WINDOWS: Record<
  RecurringCadence,
  { minDays: number; maxDays: number; periodDays: number }
> = {
  weekly: { minDays: 6, maxDays: 8, periodDays: 7 },
  monthly: { minDays: 25, maxDays: 35, periodDays: 30 },
  quarterly: { minDays: 85, maxDays: 95, periodDays: 91 },
  annual: { minDays: 350, maxDays: 380, periodDays: 365 },
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Detect cadence from inter-charge intervals (≥3 charges required). */
export function detectCadence(intervals: number[]): RecurringCadence | null {
  if (intervals.length < 2) return null;
  const med = median(intervals);
  for (const [cadence, window] of Object.entries(CADENCE_WINDOWS) as Array<
    [RecurringCadence, (typeof CADENCE_WINDOWS)[RecurringCadence]]
  >) {
    if (med >= window.minDays && med <= window.maxDays) {
      const deviation = stddev(intervals);
      if (deviation <= window.periodDays * 0.35) {
        return cadence;
      }
    }
  }
  return null;
}

/** Simple linear regression slope (amount vs charge index). */
export function linearRegressionSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i]! - xMean) * (values[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Price creep via regression + comparison to charge ~6 periods ago. */
export function detectPriceCreep(
  charges: RecurringCharge[],
  cadence: RecurringCadence,
): { priceChanged: boolean; priceCreepPct: number | null; confidence: number } {
  const amounts = charges.map((c) => c.amount);
  if (amounts.length < 3) {
    return { priceChanged: false, priceCreepPct: null, confidence: 0.4 };
  }

  const slope = linearRegressionSlope(amounts);
  const base = amounts[0]!;
  const slopePct = base > 0 ? (slope * (amounts.length - 1)) / base : 0;

  const lookbackIdx = Math.max(0, amounts.length - 1 - cadenceLookback(cadence));
  const prior = amounts[lookbackIdx]!;
  const latest = amounts[amounts.length - 1]!;
  const periodPct = prior > 0 ? latest / prior - 1 : 0;

  const priceCreepPct = roundDecimal(Math.max(slopePct, periodPct) * 100, 2);
  const priceChanged =
    priceCreepPct >= 5 ||
    (amounts.length >= 2 &&
      Math.abs(latest - amounts[amounts.length - 2]!) >= 0.5 &&
      Math.abs(latest - amounts[amounts.length - 2]!) /
        Math.max(amounts[amounts.length - 2]!, 0.01) >=
        0.05);

  const confidence = priceChanged
    ? Math.min(0.95, 0.55 + amounts.length * 0.08)
    : 0.5;

  return {
    priceChanged,
    priceCreepPct: priceChanged ? priceCreepPct : null,
    confidence,
  };
}

function cadenceLookback(cadence: RecurringCadence): number {
  if (cadence === "weekly") return 26;
  if (cadence === "monthly") return 6;
  if (cadence === "quarterly") return 2;
  return 1;
}

/** First charge tiny then ≥2× jump suggests free trial → paid. */
export function detectFreeTrialJump(charges: RecurringCharge[]): boolean {
  if (charges.length < 2) return false;
  const first = charges[0]!.amount;
  const second = charges[1]!.amount;
  return first <= 5 && second >= first * 2 && second >= 9.99;
}

export function amountsSimilar(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  return diff <= 2 || diff / Math.max(a, b, 1) <= 0.1;
}

/** Build recurring series from grouped charges keyed by canonical merchant. */
export function buildRecurringSeries(
  groups: Map<string, { displayName: string; charges: RecurringCharge[] }>,
): RecurringSeriesCandidate[] {
  const series: RecurringSeriesCandidate[] = [];

  for (const [merchantKey, group] of groups) {
    if (group.charges.length < 3) continue;

    const charges = [...group.charges].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const intervals: number[] = [];
    for (let i = 1; i < charges.length; i += 1) {
      intervals.push(daysBetween(charges[i - 1]!.date, charges[i]!.date));
    }

    const cadence = detectCadence(intervals);
    if (!cadence) continue;

    const amounts = charges.map((c) => c.amount);
    series.push({
      merchantKey,
      displayName: group.displayName,
      charges,
      cadence,
      medAmount: median(amounts),
      category: charges[charges.length - 1]!.category,
    });
  }

  return series;
}

/** Mark duplicate series (same category + similar amount). */
export function markDuplicateFlags(
  series: RecurringSeriesCandidate[],
  zombieKeys: Set<string>,
): Map<string, boolean> {
  const duplicates = new Map<string, boolean>();
  for (const item of series) {
    duplicates.set(item.merchantKey, false);
  }

  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const a = series[i]!;
      const b = series[j]!;
      if (a.category !== b.category) continue;
      if (!amountsSimilar(a.medAmount, b.medAmount)) continue;
      if (zombieKeys.has(a.merchantKey) || zombieKeys.has(b.merchantKey)) {
        continue;
      }
      duplicates.set(a.merchantKey, true);
      duplicates.set(b.merchantKey, true);
    }
  }

  return duplicates;
}

export function buildRecurringFlags(input: {
  charges: RecurringCharge[];
  cadence: RecurringCadence;
  priceChanged: boolean;
  priceCreepPct: number | null;
  priceConfidence: number;
  isZombie: boolean;
  isDuplicate: boolean;
  freeTrialJump: boolean;
}): RecurringFlags {
  let confidence = input.priceConfidence;
  if (input.isZombie) confidence = Math.max(confidence, 0.75);
  if (input.isDuplicate) confidence = Math.max(confidence, 0.8);
  if (input.freeTrialJump) confidence = Math.max(confidence, 0.7);

  return {
    priceCreep: input.priceChanged,
    zombie: input.isZombie,
    duplicate: input.isDuplicate,
    freeTrialJump: input.freeTrialJump,
    confidence: roundDecimal(Math.min(confidence, 0.95), 2),
    priceCreepPct: input.priceCreepPct,
  };
}
