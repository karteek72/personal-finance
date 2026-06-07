import {
  paginateInMemory,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  auditsToLegacyHabits,
  generateCostAudits,
} from "./cost-audit-engine.js";
import { detectHiddenFees } from "./fee-detection.js";
import {
  detectRecurringFromTransactions,
  type DetectedRecurringItem,
  type RecurringFlags,
} from "./detect-recurring.js";
import { resolveHouseholdContext } from "./household-access.js";
import { resolveActiveAccountScope } from "./active-account-scope.js";
import {
  applyRecurringLifecycleFields,
  type RecurringLifecycleStatus,
} from "./recurring-lifecycle.js";

export interface SubscriptionRow {
  merchantName: string;
  merchantKey: string;
  category: string;
  kind: string;
  amount: string;
  cadence: string;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  previousAmount: string | null;
  priceChanged: boolean;
  status: RecurringLifecycleStatus;
  brandColor: string | null;
  flags: RecurringFlags;
}

export interface RecurringAnalyticsResponse {
  monthlyTotal: string;
  annualTotal: string;
  activeCount: number;
  priceChanges: number;
  zombieCount: number;
  duplicateCount: number;
  isLive: boolean;
  subscriptions: Page<SubscriptionRow>;
  bills: Page<SubscriptionRow>;
  leaks: {
    fees: Awaited<ReturnType<typeof detectHiddenFees>>;
    habits: ReturnType<typeof auditsToLegacyHabits>;
    audits: Awaited<ReturnType<typeof generateCostAudits>>;
  };
}

export const RECURRING_SORTABLE = [
  "amount",
  "merchantName",
  "category",
  "nextChargeDate",
  "status",
] as const;

function recurringSortKey(column: string): (row: SubscriptionRow) => number | string {
  switch (column) {
    case "merchantName":
      return (r) => r.merchantName.toLowerCase();
    case "category":
      return (r) => r.category.toLowerCase();
    case "nextChargeDate":
      return (r) => r.nextChargeDate ?? "";
    case "status":
      return (r) => r.status;
    default:
      return (r) => Number.parseFloat(r.amount);
  }
}

function paginateRecurring(
  rows: SubscriptionRow[],
  q: ParsedListQuery,
): Page<SubscriptionRow> {
  return paginateInMemory(rows, q, {
    sortKey: recurringSortKey,
    textFilter: (row, needle) =>
      row.merchantName.toLowerCase().includes(needle) ||
      row.category.toLowerCase().includes(needle),
  });
}

function isActiveSubscription(status: RecurringLifecycleStatus): boolean {
  return status === "active" || status === "price-changed";
}

function toRow(item: DetectedRecurringItem): SubscriptionRow {
  const lifecycle = applyRecurringLifecycleFields({
    lastChargeDate: item.lastChargeDate,
    cadence: item.cadence,
    priceChanged: item.priceChanged,
    nextChargeDate: item.nextChargeDate,
  });
  return {
    merchantName: item.merchantName,
    merchantKey: item.merchantKey,
    category: item.category,
    kind: item.kind,
    amount: item.amount,
    cadence: item.cadence,
    nextChargeDate: lifecycle.nextChargeDate,
    lastChargeDate: item.lastChargeDate,
    previousAmount: item.previousAmount,
    priceChanged: item.priceChanged,
    status: lifecycle.status,
    brandColor: item.brandColor,
    flags: item.flags,
  };
}

export async function getRecurringAnalytics(
  userId: string,
  q: ParsedListQuery,
): Promise<RecurringAnalyticsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);

  const detected = hasActiveAccounts
    ? await detectRecurringFromTransactions(ctx.userIds)
    : [];

  const subscriptions = detected
    .filter((d) => d.kind === "subscription")
    .map(toRow);
  const bills = detected.filter((d) => d.kind === "bill").map(toRow);

  const activeSubscriptions = subscriptions.filter((s) =>
    isActiveSubscription(s.status),
  );
  const monthlyTotal = activeSubscriptions.reduce(
    (s, r) => s + Number.parseFloat(r.amount),
    0,
  );

  const fees = hasActiveAccounts
    ? await detectHiddenFees(ctx.userIds)
    : [];
  const recurringForAudits = [...subscriptions, ...bills];
  const audits = hasActiveAccounts
    ? await generateCostAudits(ctx.userIds, recurringForAudits)
    : [];

  return {
    monthlyTotal: formatMoneyAmount(monthlyTotal),
    annualTotal: formatMoneyAmount(monthlyTotal * 12),
    activeCount: activeSubscriptions.length,
    priceChanges: detected.filter((d) => d.flags.priceCreep).length,
    zombieCount: detected.filter((d) => d.flags.zombie).length,
    duplicateCount: detected.filter((d) => d.flags.duplicate).length,
    isLive: detected.length > 0,
    subscriptions: paginateRecurring(subscriptions, q),
    bills: paginateRecurring(bills, q),
    leaks: {
      fees,
      habits: auditsToLegacyHabits(audits),
      audits,
    },
  };
}
