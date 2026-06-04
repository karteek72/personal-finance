import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

export interface DerivedLifestyleHabit {
  id: string;
  emoji: string | null;
  label: string;
  monthly: string;
}

const HABIT_DEFS: Array<{
  id: string;
  emoji: string;
  label: string;
  subCategories?: string[];
  categories?: string[];
  merchantPattern?: RegExp;
  minMonthly: number;
}> = [
  {
    id: "coffee-runs",
    emoji: "☕",
    label: "Coffee runs",
    subCategories: ["Cafes & Coffee", "Coffee Shops"],
    merchantPattern: /starbucks|coffee|blue bottle|philz|dunkin|peet/i,
    minMonthly: 15,
  },
  {
    id: "dining-out",
    emoji: "🍔",
    label: "Dining out & delivery",
    categories: ["Dining & Restaurants"],
    subCategories: [
      "Sit-down Restaurants",
      "Fast Food & Takeout",
      "Food Delivery",
      "Bars & Nightlife",
    ],
    minMonthly: 40,
  },
  {
    id: "rideshare",
    emoji: "🚗",
    label: "Rideshare",
    categories: ["Transportation"],
    merchantPattern: /uber(?!\s*eats)|lyft|taxi|cab\b/i,
    minMonthly: 20,
  },
  {
    id: "subscriptions",
    emoji: "📺",
    label: "Subscriptions",
    categories: ["Subscriptions & Digital"],
    minMonthly: 10,
  },
];

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Spending habits for Time Machine when lifestyle_habits rows are not seeded. */
export async function deriveLifestyleHabitsFromTransactions(
  userIds: string[],
  lookbackMonths = 3,
): Promise<DerivedLifestyleHabit[]> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return [];

  const since = monthsAgo(lookbackMonths);
  const db = getDb();
  const rows = await db
    .select({
      category: transactions.category,
      subCategory: transactions.subCategory,
      merchantName: transactions.merchantName,
      name: transactions.name,
      amount: transactions.amount,
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

  const totals = new Map<string, number>();
  for (const def of HABIT_DEFS) {
    totals.set(def.id, 0);
  }

  for (const row of rows) {
    const spend = Math.abs(Number.parseFloat(row.amount));
    if (!Number.isFinite(spend) || spend <= 0) continue;
    const merchantText = `${row.merchantName ?? ""} ${row.name ?? ""}`;

    for (const def of HABIT_DEFS) {
      let match = false;
      if (def.merchantPattern?.test(merchantText)) {
        match = true;
      } else if (def.subCategories?.includes(row.subCategory ?? "")) {
        match = true;
      } else if (
        def.categories?.includes(row.category) &&
        !def.subCategories
      ) {
        match = true;
      } else if (
        def.categories?.includes(row.category) &&
        def.subCategories &&
        row.subCategory &&
        !HABIT_DEFS.some(
          (other) =>
            other.id !== def.id &&
            other.subCategories?.includes(row.subCategory ?? ""),
        )
      ) {
        match = true;
      }
      if (match) {
        totals.set(def.id, (totals.get(def.id) ?? 0) + spend);
      }
    }
  }

  const habits: DerivedLifestyleHabit[] = [];
  for (const def of HABIT_DEFS) {
    const total = totals.get(def.id) ?? 0;
    const monthly = total / Math.max(lookbackMonths, 1);
    if (monthly < def.minMonthly) continue;
    habits.push({
      id: def.id,
      emoji: def.emoji,
      label: def.label,
      monthly: formatMoneyAmount(monthly),
    });
  }

  return habits.sort(
    (a, b) => Number.parseFloat(b.monthly) - Number.parseFloat(a.monthly),
  );
}
