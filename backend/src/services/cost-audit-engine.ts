import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  DISCRETIONARY_CATEGORIES,
  isDeliverySpend,
  subCategoryEmoji,
  subscriptionLaneForMerchant,
} from "./analytics-categories.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import type { DetectedRecurringItem } from "./detect-recurring.js";
import { daysBetween } from "./recurring-lifecycle.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

/** Documented rate for 10-year opportunity cost (matches legacy UI). */
export const OPPORTUNITY_COST_ANNUAL_RATE = 0.07;

export interface RecurringAuditInput {
  merchantName: string;
  kind: string;
  amount: string;
  priceChanged: boolean;
  previousAmount: string | null;
  status: DetectedRecurringItem["status"];
  lastChargeDate: string | null;
}

export type CostAuditType =
  | "habit"
  | "delivery"
  | "duplicate_subscription"
  | "price_hike"
  | "lapsed_subscription"
  | "impulse"
  | "fee"
  | "category_overspend"
  | "merchant_frequency";

export interface CostAudit {
  id: string;
  type: CostAuditType;
  emoji: string;
  title: string;
  monthly: string;
  annual: string;
  opportunityCost10y: string;
  rationale: string;
  action: string;
  savingsEstimate: string;
  confidence: number;
}

/** Legacy shape for Time Machine / older UI panels. */
export interface DerivedLifestyleHabit {
  id: string;
  emoji: string | null;
  label: string;
  monthly: string;
}

interface TxRow {
  category: string;
  subCategory: string | null;
  merchantName: string | null;
  name: string;
  amount: string;
  date: string;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function futureValueMonthly(
  monthly: number,
  years: number,
  rate = OPPORTUNITY_COST_ANNUAL_RATE,
): number {
  const r = rate / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}

function buildAudit(
  partial: Omit<
    CostAudit,
    "monthly" | "annual" | "opportunityCost10y" | "savingsEstimate"
  > & {
    monthlyAmount: number;
    savingsFraction?: number;
  },
): CostAudit {
  const monthly = roundDecimal(partial.monthlyAmount);
  const annual = roundDecimal(monthly * 12);
  const savingsEstimate = roundDecimal(
    monthly * (partial.savingsFraction ?? 0.35),
  );
  return {
    id: partial.id,
    type: partial.type,
    emoji: partial.emoji,
    title: partial.title,
    monthly: formatMoneyAmount(monthly),
    annual: formatMoneyAmount(annual),
    opportunityCost10y: formatMoneyAmount(
      futureValueMonthly(savingsEstimate, 10),
    ),
    rationale: partial.rationale,
    action: partial.action,
    savingsEstimate: formatMoneyAmount(savingsEstimate),
    confidence: partial.confidence,
  };
}

async function loadTransactions(
  userIds: string[],
  since: string,
): Promise<TxRow[]> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return [];

  const db = getDb();
  return db
    .select({
      category: transactions.category,
      subCategory: transactions.subCategory,
      merchantName: transactions.merchantName,
      name: transactions.name,
      amount: transactions.amount,
      date: transactions.date,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, since),
      ),
    );
}

function habitAudits(rows: TxRow[], lookbackMonths: number): CostAudit[] {
  const bySub = new Map<string, { category: string; total: number; count: number }>();
  const byMerchant = new Map<
    string,
    {
      displayName: string;
      total: number;
      count: number;
      category: string;
      subCategory: string | null;
    }
  >();

  for (const row of rows) {
    const spend = Math.abs(Number.parseFloat(row.amount));
    if (!Number.isFinite(spend) || spend <= 0) continue;
    if (!DISCRETIONARY_CATEGORIES.has(row.category)) continue;

    const sub = row.subCategory ?? "Other";
    const subKey = `${row.category}::${sub}`;
    const subBucket = bySub.get(subKey) ?? {
      category: row.category,
      total: 0,
      count: 0,
    };
    subBucket.total += spend;
    subBucket.count += 1;
    bySub.set(subKey, subBucket);

    const merchant = (row.merchantName ?? row.name).trim();
    if (!merchant) continue;
    const mKey = merchant.toLowerCase();
    const mBucket = byMerchant.get(mKey) ?? {
      displayName: merchant,
      total: 0,
      count: 0,
      category: row.category,
      subCategory: row.subCategory,
    };
    mBucket.total += spend;
    mBucket.count += 1;
    byMerchant.set(mKey, mBucket);
  }

  const audits: CostAudit[] = [];
  const minMonthly = 15;

  for (const [key, bucket] of bySub) {
    const monthly = bucket.total / Math.max(lookbackMonths, 1);
    if (monthly < minMonthly) continue;
    const [, subCategory] = key.split("::");
    audits.push(
      buildAudit({
        id: `habit-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        type: "habit",
        emoji: subCategoryEmoji(bucket.category, subCategory!),
        title: subCategory!,
        monthlyAmount: monthly,
        savingsFraction: 0.3,
        rationale: `${bucket.count} purchases in ${lookbackMonths} months (~${formatMoneyAmount(monthly)}/mo).`,
        action: `Trim ${subCategory} spend by ~30% — set a weekly cap.`,
        confidence: 0.75,
      }),
    );
  }

  for (const [, bucket] of byMerchant) {
    const monthly = bucket.total / Math.max(lookbackMonths, 1);
    if (bucket.count < 6 || monthly < 25) continue;
    audits.push(
      buildAudit({
        id: `merchant-${bucket.displayName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`,
        type: "merchant_frequency",
        emoji: subCategoryEmoji(
          bucket.category,
          bucket.subCategory ?? "Other",
        ),
        title: bucket.displayName,
        monthlyAmount: monthly,
        savingsFraction: 0.25,
        rationale: `${bucket.count} visits in ${lookbackMonths} months (~${formatMoneyAmount(monthly)}/mo at this merchant).`,
        action: "Batch purchases or swap to a lower-cost alternative.",
        confidence: 0.65,
      }),
    );
  }

  return audits;
}

function deliveryAudits(rows: TxRow[], lookbackMonths: number): CostAudit[] {
  let deliveryTotal = 0;
  let deliveryCount = 0;
  let groceryTotal = 0;

  for (const row of rows) {
    const spend = Math.abs(Number.parseFloat(row.amount));
    if (!Number.isFinite(spend) || spend <= 0) continue;
    const text = `${row.merchantName ?? ""} ${row.name ?? ""}`;
    if (isDeliverySpend(text, row.subCategory)) {
      deliveryTotal += spend;
      deliveryCount += 1;
    } else if (
      row.category === "Food & Groceries" ||
      row.subCategory === "Grocery Stores"
    ) {
      groceryTotal += spend;
    }
  }

  const monthlyDelivery = deliveryTotal / Math.max(lookbackMonths, 1);
  if (monthlyDelivery < 20 || deliveryCount < 3) return [];

  const markupPct =
    groceryTotal > 0
      ? Math.round((deliveryTotal / groceryTotal) * 100)
      : 35;

  return [
    buildAudit({
      id: "delivery-premium",
      type: "delivery",
      emoji: "🍔",
      title: "Food delivery premium",
      monthlyAmount: monthlyDelivery,
      savingsFraction: 0.35,
      rationale: `${deliveryCount} delivery orders in ${lookbackMonths * 30} days; ~${markupPct}% of grocery spend.`,
      action: "Batch-cook 2 nights/week to cut ~8 orders/mo.",
      confidence: 0.7,
    }),
  ];
}

function duplicateSubscriptionAudits(
  recurring: RecurringAuditInput[],
): CostAudit[] {
  const active = recurring.filter(
    (r) =>
      r.kind === "subscription" &&
      (r.status === "active" || r.status === "price-changed"),
  );
  const byLane = new Map<string, RecurringAuditInput[]>();

  for (const item of active) {
    const lane = subscriptionLaneForMerchant(item.merchantName);
    if (!lane) continue;
    const list = byLane.get(lane) ?? [];
    list.push(item);
    byLane.set(lane, list);
  }

  const audits: CostAudit[] = [];
  for (const [lane, items] of byLane) {
    if (items.length < 2) continue;
    const monthly = items.reduce(
      (s, i) => s + Number.parseFloat(i.amount),
      0,
    );
    const cheapest = Math.min(...items.map((i) => Number.parseFloat(i.amount)));
    audits.push(
      buildAudit({
        id: `duplicate-${lane}`,
        type: "duplicate_subscription",
        emoji: "📺",
        title: `Overlapping ${lane.replace(/-/g, " ")} subscriptions`,
        monthlyAmount: monthly,
        savingsFraction: (monthly - cheapest) / Math.max(monthly, 1),
        rationale: `${items.length} active services: ${items.map((i) => i.merchantName).join(", ")}.`,
        action: "Keep one service; cancel the rest.",
        confidence: 0.85,
      }),
    );
  }
  return audits;
}

function priceHikeAudits(recurring: RecurringAuditInput[]): CostAudit[] {
  return recurring
    .filter((r) => r.priceChanged && r.previousAmount)
    .map((r) => {
      const prev = Number.parseFloat(r.previousAmount!);
      const curr = Number.parseFloat(r.amount);
      const delta = Math.max(curr - prev, 0);
      return buildAudit({
        id: `price-hike-${r.merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "price_hike",
        emoji: "📈",
        title: `${r.merchantName} price increase`,
        monthlyAmount: delta,
        savingsFraction: 1,
        rationale: `Rose from ${formatMoneyAmount(prev)} to ${formatMoneyAmount(curr)}/mo (+${formatMoneyAmount(delta * 12)}/yr).`,
        action: "Review the plan tier or negotiate/cancel.",
        confidence: 0.9,
      });
    });
}

export function lapsedSubscriptionAudits(
  recurring: RecurringAuditInput[],
  today: string = new Date().toISOString().slice(0, 10),
): CostAudit[] {
  return recurring
    .filter((r) => r.kind === "subscription" && r.status === "lapsed")
    .map((r) => {
      const monthly = Number.parseFloat(r.amount);
      const monthsSilent = r.lastChargeDate
        ? Math.max(1, Math.round(daysBetween(r.lastChargeDate, today) / 30))
        : 1;
      return buildAudit({
        id: `lapsed-${r.merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "lapsed_subscription",
        emoji: "✅",
        title: `${r.merchantName} looks cancelled`,
        monthlyAmount: monthly,
        savingsFraction: 1,
        rationale: `No charge from ${r.merchantName} in ~${monthsSilent} months — saving ~${formatMoneyAmount(monthly * 12)}/yr if cancelled.`,
        action: "Confirm cancellation and remove from your budget.",
        confidence: 0.8,
      });
    });
}

function impulseAudits(rows: TxRow[]): CostAudit[] {
  const cutoff = monthsAgo(3);
  const recent = rows.filter((r) => r.date >= cutoff);
  const byMerchant = new Map<string, { count: number; total: number }>();

  for (const row of recent) {
    const spend = Math.abs(Number.parseFloat(row.amount));
    if (!Number.isFinite(spend) || spend <= 0 || spend >= 15) continue;
    if (!DISCRETIONARY_CATEGORIES.has(row.category)) continue;
    const merchant = (row.merchantName ?? row.name).trim().toLowerCase();
    if (!merchant) continue;
    const bucket = byMerchant.get(merchant) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += spend;
    byMerchant.set(merchant, bucket);
  }

  const audits: CostAudit[] = [];
  for (const [merchant, bucket] of byMerchant) {
    if (bucket.count < 8) continue;
    const monthly = bucket.total / 3;
    if (monthly < 20) continue;
    audits.push(
      buildAudit({
        id: `impulse-${merchant.replace(/[^a-z0-9]+/g, "-")}`,
        type: "impulse",
        emoji: "🛍️",
        title: `Small purchases at ${merchant}`,
        monthlyAmount: monthly,
        savingsFraction: 0.4,
        rationale: `${bucket.count} sub-$15 charges in 90 days (~${formatMoneyAmount(monthly)}/mo).`,
        action: "Add a 24-hour pause rule for this merchant.",
        confidence: 0.6,
      }),
    );
  }
  return audits;
}

function categoryOverspendAudits(rows: TxRow[]): CostAudit[] {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const priorMonths: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    priorMonths.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  const spendByMonthCat = new Map<string, number>();
  for (const row of rows) {
    const spend = Math.abs(Number.parseFloat(row.amount));
    if (!Number.isFinite(spend) || spend <= 0) continue;
    if (!DISCRETIONARY_CATEGORIES.has(row.category)) continue;
    const key = `${monthKey(row.date)}::${row.category}`;
    spendByMonthCat.set(key, (spendByMonthCat.get(key) ?? 0) + spend);
  }

  const audits: CostAudit[] = [];
  for (const category of DISCRETIONARY_CATEGORIES) {
    const current = spendByMonthCat.get(`${currentMonth}::${category}`) ?? 0;
    const priorTotals = priorMonths.map(
      (m) => spendByMonthCat.get(`${m}::${category}`) ?? 0,
    );
    const baseline =
      priorTotals.reduce((s, v) => s + v, 0) / Math.max(priorMonths.length, 1);
    if (baseline < 50 || current <= baseline * 1.25) continue;
    const delta = current - baseline;
    audits.push(
      buildAudit({
        id: `overspend-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "category_overspend",
        emoji: "📊",
        title: `${category} above your baseline`,
        monthlyAmount: delta,
        savingsFraction: 0.5,
        rationale: `This month ${formatMoneyAmount(current)} vs ~${formatMoneyAmount(baseline)} 3-mo avg (+${Math.round(((current - baseline) / baseline) * 100)}%).`,
        action: "Reset to your trailing average for the rest of the month.",
        confidence: 0.7,
      }),
    );
  }
  return audits;
}

export function auditsToLegacyHabits(audits: CostAudit[]): DerivedLifestyleHabit[] {
  return audits
    .filter((a) =>
      ["habit", "delivery", "merchant_frequency", "impulse"].includes(a.type),
    )
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      emoji: a.emoji,
      label: a.title,
      monthly: a.monthly,
    }));
}

/** Data-driven lifestyle cost audits from transactions + recurring detection. */
export async function generateCostAudits(
  userIds: string[],
  recurring: RecurringAuditInput[],
  lookbackMonths = 3,
): Promise<CostAudit[]> {
  const since = monthsAgo(lookbackMonths);
  const rows = await loadTransactions(userIds, since);
  const longRows = await loadTransactions(userIds, monthsAgo(6));

  const audits: CostAudit[] = [
    ...habitAudits(rows, lookbackMonths),
    ...deliveryAudits(rows, lookbackMonths),
    ...duplicateSubscriptionAudits(recurring),
    ...priceHikeAudits(recurring),
    ...lapsedSubscriptionAudits(recurring),
    ...impulseAudits(longRows),
    ...categoryOverspendAudits(longRows),
  ];

  const seen = new Set<string>();
  const deduped = audits.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return Number.parseFloat(a.savingsEstimate) >= 5;
  });

  return deduped.sort(
    (a, b) =>
      Number.parseFloat(b.savingsEstimate) - Number.parseFloat(a.savingsEstimate),
  );
}
