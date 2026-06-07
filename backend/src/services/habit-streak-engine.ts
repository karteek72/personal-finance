import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { habitStreaks, transactions } from "../db/schema.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

const DINING_CATEGORY = "Dining & Restaurants";
const NO_SPEND_LABEL = "No-spend day streak";
const SAVINGS_LABEL = "Positive savings months";
const DINING_LABEL = "Since last dining spend";

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

function daysBetween(startKey: string, endKey: string): number {
  const start = parseDateKey(startKey).getTime();
  const end = parseDateKey(endKey).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/** Consecutive calendar days ending today with zero expense outflows. */
export function computeNoSpendDayStreak(
  expenseDates: Set<string>,
  todayKey = utcDateKey(new Date()),
): { currentDays: number; maxDays: number } {
  let currentDays = 0;
  const cursor = parseDateKey(todayKey);
  while (!expenseDates.has(utcDateKey(cursor))) {
    currentDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (currentDays > 3660) break;
  }

  const sorted = [...expenseDates].sort();
  let maxDays = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    if (prev == null) {
      run = 1;
    } else {
      const gap = daysBetween(prev, day);
      run = gap === 1 ? run + 1 : 1;
    }
    maxDays = Math.max(maxDays, run);
    prev = day;
  }

  return { currentDays, maxDays: Math.max(maxDays, currentDays) };
}

/** Trailing consecutive months (newest first) where income exceeds spending. */
export function computePositiveSavingsMonthStreak(
  monthly: Array<{ month: string; income: number; spending: number }>,
): { currentDays: number; maxDays: number } {
  if (monthly.length === 0) {
    return { currentDays: 0, maxDays: 0 };
  }

  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const row = sorted[i]!;
    if (row.income > row.spending) {
      current += 1;
    } else {
      break;
    }
  }

  let max = 0;
  let run = 0;
  for (const row of sorted) {
    if (row.income > row.spending) {
      run += 1;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }

  return { currentDays: current, maxDays: Math.max(max, current) };
}

/** Days since the most recent dining expense; max gap between dining spends. */
export function computeDaysSinceDiningStreak(
  diningDates: string[],
  todayKey = utcDateKey(new Date()),
): { currentDays: number; maxDays: number } {
  if (diningDates.length === 0) {
    return { currentDays: 0, maxDays: 0 };
  }

  const sorted = [...new Set(diningDates)].sort();
  const last = sorted[sorted.length - 1]!;
  const currentDays = daysBetween(last, todayKey);

  let maxDays = currentDays;
  for (let i = 1; i < sorted.length; i += 1) {
    maxDays = Math.max(maxDays, daysBetween(sorted[i - 1]!, sorted[i]!));
  }

  return { currentDays, maxDays };
}

export interface HabitStreakRow {
  label: string;
  currentDays: number;
  maxDays: number;
  color: string;
}

export function buildHabitStreakRows(input: {
  expenseDates: Set<string>;
  monthly: Array<{ month: string; income: number; spending: number }>;
  diningDates: string[];
  todayKey?: string;
}): HabitStreakRow[] {
  const todayKey = input.todayKey ?? utcDateKey(new Date());
  const noSpend = computeNoSpendDayStreak(input.expenseDates, todayKey);
  const savings = computePositiveSavingsMonthStreak(input.monthly);
  const dining = computeDaysSinceDiningStreak(input.diningDates, todayKey);

  return [
    {
      label: NO_SPEND_LABEL,
      currentDays: noSpend.currentDays,
      maxDays: noSpend.maxDays,
      color: "#22C55E",
    },
    {
      label: SAVINGS_LABEL,
      currentDays: savings.currentDays,
      maxDays: savings.maxDays,
      color: "#3B82F6",
    },
    {
      label: DINING_LABEL,
      currentDays: dining.currentDays,
      maxDays: dining.maxDays,
      color: "#F97316",
    },
  ];
}

/** Recompute habit streaks from transaction history (idempotent). */
export async function refreshHabitStreaks(userId: string): Promise<void> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  const db = getDb();

  await db.delete(habitStreaks).where(eq(habitStreaks.userId, userId));

  if (!hasActiveAccounts) {
    return;
  }

  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 2);
  const sinceDate = since.toISOString().slice(0, 10);
  const txScope = drizzleActiveTransactionWhere(ctx.userIds, accountIds);

  const expenseDayRows = await db
    .select({ date: transactions.date })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, sinceDate),
      ),
    );

  const expenseDates = new Set(expenseDayRows.map((r) => r.date.slice(0, 10)));

  const monthlyRows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}) else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(and(txScope, eq(transactions.pending, false), gte(transactions.date, sinceDate)))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

  const monthly = monthlyRows.map((r) => ({
    month: r.month,
    income: Number.parseFloat(r.income ?? "0"),
    spending: Number.parseFloat(r.spending ?? "0"),
  }));

  const diningRows = await db
    .select({ date: transactions.date })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.category, DINING_CATEGORY),
        gte(transactions.date, sinceDate),
      ),
    );

  const streakRows = buildHabitStreakRows({
    expenseDates,
    monthly,
    diningDates: diningRows.map((r) => r.date.slice(0, 10)),
  });

  if (streakRows.length === 0) {
    return;
  }

  await db.insert(habitStreaks).values(
    streakRows.map((row) => ({
      userId,
      label: row.label,
      currentDays: row.currentDays,
      maxDays: row.maxDays,
      color: row.color,
    })),
  );
}
