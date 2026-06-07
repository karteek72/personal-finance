import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { challenges, transactions } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";
import { AppError } from "../lib/errors.js";

const DINING_CATEGORY = "Dining & Restaurants";

const CHALLENGE_TITLES = {
  dining: "Dining budget cut",
  savings: "Monthly savings goal",
  noSpendWeekend: "No-spend weekend",
} as const;

function currentMonthBounds(): { start: string; end: string; daysRemaining: number } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const daysRemaining = Math.max(0, lastDay - now.getUTCDate());
  return { start, end, daysRemaining };
}

function weekendBounds(): { start: string; end: string; daysRemaining: number } {
  const now = new Date();
  const day = now.getUTCDay();
  const saturdayOffset = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  const saturday = new Date(now);
  saturday.setUTCDate(now.getUTCDate() + saturdayOffset);
  const sunday = new Date(saturday);
  sunday.setUTCDate(saturday.getUTCDate() + 1);

  const start = saturday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);
  const daysRemaining = day === 0 ? 0 : day === 6 ? 1 : 6 - day;
  return { start, end, daysRemaining };
}

export interface GeneratedChallenge {
  title: string;
  goal: string;
  progressPercent: number;
  daysRemaining: number;
  complete: boolean;
  color: string;
}

export function computeDiningChallenge(input: {
  baselineMonthly: number;
  monthSpend: number;
  daysRemaining: number;
}): GeneratedChallenge | null {
  if (input.baselineMonthly <= 0) return null;
  const target = input.baselineMonthly * 0.8;
  const progress =
    input.monthSpend <= 0
      ? 100
      : Math.min(100, Math.round((1 - input.monthSpend / input.baselineMonthly) * 100));
  const complete = input.monthSpend <= target;
  return {
    title: CHALLENGE_TITLES.dining,
    goal: `Keep dining under ${formatMoneyAmount(target)} this month (20% below your baseline)`,
    progressPercent: complete ? 100 : Math.max(0, progress),
    daysRemaining: input.daysRemaining,
    complete,
    color: "#F97316",
  };
}

export function computeSavingsChallenge(input: {
  monthIncome: number;
  monthSpending: number;
  daysRemaining: number;
}): GeneratedChallenge | null {
  const surplus = input.monthIncome - input.monthSpending;
  const target = Math.max(input.monthIncome * 0.1, 100);
  if (input.monthIncome <= 0) return null;
  const progress = Math.min(100, Math.round((Math.max(0, surplus) / target) * 100));
  const complete = surplus >= target;
  return {
    title: CHALLENGE_TITLES.savings,
    goal: `Save at least ${formatMoneyAmount(target)} this month`,
    progressPercent: complete ? 100 : progress,
    daysRemaining: input.daysRemaining,
    complete,
    color: "#22C55E",
  };
}

export function computeNoSpendWeekendChallenge(input: {
  weekendSpend: number;
  daysRemaining: number;
}): GeneratedChallenge {
  const complete = input.weekendSpend <= 0;
  return {
    title: CHALLENGE_TITLES.noSpendWeekend,
    goal: "No discretionary spending this Saturday and Sunday",
    progressPercent: complete ? 100 : Math.max(0, 100 - Math.min(100, Math.round(input.weekendSpend))),
    daysRemaining: input.daysRemaining,
    complete,
    color: "#3B82F6",
  };
}

export function buildChallenges(input: {
  baselineDining: number;
  monthDining: number;
  monthIncome: number;
  monthSpending: number;
  weekendSpend: number;
  monthDaysRemaining: number;
  weekendDaysRemaining: number;
}): GeneratedChallenge[] {
  const generated: GeneratedChallenge[] = [];

  const dining = computeDiningChallenge({
    baselineMonthly: input.baselineDining,
    monthSpend: input.monthDining,
    daysRemaining: input.monthDaysRemaining,
  });
  if (dining) generated.push(dining);

  const savings = computeSavingsChallenge({
    monthIncome: input.monthIncome,
    monthSpending: input.monthSpending,
    daysRemaining: input.monthDaysRemaining,
  });
  if (savings) generated.push(savings);

  generated.push(
    computeNoSpendWeekendChallenge({
      weekendSpend: input.weekendSpend,
      daysRemaining: input.weekendDaysRemaining,
    }),
  );

  return generated.slice(0, 3);
}

/** Regenerate data-driven challenges (preserves user-dismissed rows by title). */
export async function refreshChallenges(userId: string): Promise<void> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  const db = getDb();

  const dismissedRows = await db
    .select({ title: challenges.title })
    .from(challenges)
    .where(and(eq(challenges.userId, userId), eq(challenges.dismissed, true)));
  const dismissedTitles = new Set(dismissedRows.map((r) => r.title));

  await db.delete(challenges).where(eq(challenges.userId, userId));

  if (!hasActiveAccounts) {
    return;
  }

  const month = currentMonthBounds();
  const weekend = weekendBounds();
  const txScope = drizzleActiveTransactionWhere(ctx.userIds, accountIds);

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 3);
  const baselineSince = since.toISOString().slice(0, 10);

  const [baselineRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.category, DINING_CATEGORY),
        gte(transactions.date, baselineSince),
        sql`${transactions.date} < ${month.start}`,
      ),
    );
  const baselineDining =
    Number.parseFloat(baselineRow?.total ?? "0") / 3;

  const [monthDiningRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.category, DINING_CATEGORY),
        gte(transactions.date, month.start),
        sql`${transactions.date} <= ${month.end}`,
      ),
    );

  const [monthTotalsRow] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}) else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        gte(transactions.date, month.start),
        sql`${transactions.date} <= ${month.end}`,
      ),
    );

  const [weekendRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, weekend.start),
        sql`${transactions.date} <= ${weekend.end}`,
      ),
    );

  const generated = buildChallenges({
    baselineDining,
    monthDining: Number.parseFloat(monthDiningRow?.total ?? "0"),
    monthIncome: Number.parseFloat(monthTotalsRow?.income ?? "0"),
    monthSpending: Number.parseFloat(monthTotalsRow?.spending ?? "0"),
    weekendSpend: Number.parseFloat(weekendRow?.total ?? "0"),
    monthDaysRemaining: month.daysRemaining,
    weekendDaysRemaining: weekend.daysRemaining,
  }).filter((c) => !dismissedTitles.has(c.title));

  if (generated.length === 0) {
    return;
  }

  await db.insert(challenges).values(
    generated.map((c) => ({
      userId,
      title: c.title,
      goal: c.goal,
      progressPercent: c.progressPercent,
      daysRemaining: c.daysRemaining,
      complete: c.complete,
      color: c.color,
      dismissed: false,
    })),
  );
}

export async function dismissChallenge(
  userId: string,
  challengeId: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.userId, userId)))
    .limit(1);

  if (!row) {
    throw AppError.notFound("Challenge not found");
  }

  await db
    .update(challenges)
    .set({ dismissed: true })
    .where(eq(challenges.id, challengeId));
}
