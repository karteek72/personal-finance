/** Recurring subscription/bill lifecycle — see analytics-architecture.md §13.3 */

export type RecurringLifecycleStatus = "active" | "lapsed" | "price-changed";

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function cadenceToDays(cadence: string): number {
  if (cadence === "weekly") return 7;
  if (cadence === "quarterly") return 91;
  if (cadence === "annual") return 365;
  return 30;
}

/**
 * Derive lifecycle status and next charge date from the last observed charge.
 * - active: last charge within ~1.5× cadence (not yet lapsed)
 * - lapsed: no charge for > ~1.5× cadence
 * - nextChargeDate null when predicted date is in the past or item is lapsed
 */
export function resolveRecurringLifecycle(
  lastChargeDate: string,
  cadenceDays: number,
  today: string = new Date().toISOString().slice(0, 10),
): { status: "active" | "lapsed"; nextChargeDate: string | null } {
  const daysSinceLast = daysBetween(lastChargeDate, today);
  const predictedNext = addDays(lastChargeDate, Math.round(cadenceDays));
  const status = daysSinceLast > cadenceDays * 1.5 ? "lapsed" : "active";
  const nextChargeDate =
    status === "lapsed" || predictedNext <= today ? null : predictedNext;
  return { status, nextChargeDate };
}

export function applyRecurringLifecycleFields(input: {
  lastChargeDate: string | null;
  cadence: string;
  priceChanged: boolean;
  nextChargeDate?: string | null;
}): { status: RecurringLifecycleStatus; nextChargeDate: string | null } {
  if (!input.lastChargeDate) {
    return {
      status: input.priceChanged ? "price-changed" : "active",
      nextChargeDate: input.nextChargeDate ?? null,
    };
  }
  const { status, nextChargeDate } = resolveRecurringLifecycle(
    input.lastChargeDate,
    cadenceToDays(input.cadence),
  );
  if (status === "lapsed") {
    return { status: "lapsed", nextChargeDate: null };
  }
  if (input.priceChanged) {
    return { status: "price-changed", nextChargeDate };
  }
  return { status: "active", nextChargeDate };
}
