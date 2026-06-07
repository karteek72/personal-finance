import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { categoryMeta } from "./category-meta.js";

export interface DetectedRecurringItem {
  merchantName: string;
  category: string;
  kind: "subscription" | "bill";
  amount: string;
  cadence: string;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  previousAmount: string | null;
  priceChanged: boolean;
  status: string;
  brandColor: string | null;
}

const SUBSCRIPTION_CATEGORIES = new Set([
  "Subscriptions & Software",
  "Entertainment",
]);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Detect recurring merchants from transaction history (≥3 charges at ~monthly cadence).
 */
export async function detectRecurringFromTransactions(
  userIds: string[],
): Promise<DetectedRecurringItem[]> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select({
      merchant: transactions.merchantName,
      name: transactions.name,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
      ),
    );

  interface Charge {
    date: string;
    amount: number;
    category: string;
  }
  interface MerchantAgg {
    displayName: string;
    charges: Charge[];
  }
  const byMerchant = new Map<string, MerchantAgg>();

  for (const r of rows) {
    const displayName = (r.merchant ?? r.name).trim();
    if (!displayName) continue;
    const key = displayName.toLowerCase();
    const entry = byMerchant.get(key) ?? { displayName, charges: [] };
    entry.charges.push({
      date: r.date,
      amount: Math.abs(Number.parseFloat(r.amount)),
      category: r.category,
    });
    byMerchant.set(key, entry);
  }

  const detected: DetectedRecurringItem[] = [];

  for (const { displayName, charges } of byMerchant.values()) {
    if (charges.length < 3) continue;

    charges.sort((a, b) => a.date.localeCompare(b.date));
    const intervals: number[] = [];
    for (let i = 1; i < charges.length; i++) {
      intervals.push(daysBetween(charges[i - 1]!.date, charges[i]!.date));
    }
    const medInterval = median(intervals);
    const isMonthly = medInterval >= 25 && medInterval <= 35;
    const isWeekly = medInterval >= 6 && medInterval <= 8;
    if (!isMonthly && !isWeekly) continue;

    const amounts = charges.map((c) => c.amount);
    const medAmount = median(amounts);
    const last = charges[charges.length - 1]!;
    const prev = charges[charges.length - 2]!;
    const priceChanged =
      isMonthly &&
      Math.abs(last.amount - prev.amount) >= 0.5 &&
      Math.abs(last.amount - prev.amount) / prev.amount >= 0.05;

    const category = last.category;
    const meta = categoryMeta(category);
    const cadence = isMonthly ? "monthly" : "weekly";

    detected.push({
      merchantName: displayName,
      category,
      kind: SUBSCRIPTION_CATEGORIES.has(category) ? "subscription" : "bill",
      amount: formatMoneyAmount(medAmount),
      cadence,
      nextChargeDate: addDays(last.date, Math.round(medInterval)),
      lastChargeDate: last.date,
      previousAmount: priceChanged ? formatMoneyAmount(prev.amount) : null,
      priceChanged,
      status: "active",
      brandColor: meta.color,
    });
  }

  return detected.sort(
    (a, b) => Number.parseFloat(b.amount) - Number.parseFloat(a.amount),
  );
}
