import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, savingsGoals, transactions } from "../db/schema.js";
import { formatMoneyAmount, roundPercent } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { emptyWellnessResponse, type WellnessResponse } from "./insights-store.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreFromRatio(value: number, target: number, higherIsBetter: boolean): number {
  if (target <= 0) return 50;
  const ratio = value / target;
  const raw = higherIsBetter ? ratio * 100 : (1 / Math.max(ratio, 0.01)) * 100;
  return clampScore(raw);
}

function monthBounds(period: string): { start: string; end: string } {
  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function monthTotals(
  userIds: string[],
  accountIds: string[],
  period: string,
): Promise<{ income: number; spending: number; savingsRate: number }> {
  const db = getDb();
  const { start, end } = monthBounds(period);
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}::numeric) else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false and ${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY} then ${transactions.amount}::numeric else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        sql`${transactions.date} >= ${start} and ${transactions.date} <= ${end}`,
      ),
    );
  const income = Number.parseFloat(row?.income ?? "0");
  const spending = Number.parseFloat(row?.spending ?? "0");
  const savingsRate =
    income > 0 ? roundPercent(((income - spending) / income) * 100) : 0;
  return { income, spending, savingsRate };
}

async function accountMetrics(userIds: string[]): Promise<{
  liquidCash: number;
  creditBalance: number;
  creditLimit: number;
}> {
  const db = getDb();
  const rows = await db
    .select({
      type: accounts.type,
      balanceAvailable: accounts.balanceAvailable,
      balanceCurrent: accounts.balanceCurrent,
    })
    .from(accounts)
    .where(and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)));

  let liquidCash = 0;
  let creditBalance = 0;
  let creditLimit = 0;
  for (const a of rows) {
    if (a.type === "depository") {
      liquidCash += Number.parseFloat(a.balanceAvailable ?? a.balanceCurrent ?? "0");
    } else if (a.type === "credit") {
      const bal = Math.abs(Number.parseFloat(a.balanceCurrent ?? "0"));
      creditBalance += bal;
      creditLimit += bal * 2.5; // estimate when limit unknown
    }
  }
  return { liquidCash, creditBalance, creditLimit };
}

function buildDimensions(input: {
  savingsRate: number;
  utilization: number;
  emergencyMonths: number;
  expenseRatio: number;
  goalsOnTrack: number;
  goalCount: number;
}): WellnessResponse["dimensions"] {
  const savingsScore = scoreFromRatio(input.savingsRate, 20, true);
  const debtScore = scoreFromRatio(30, Math.max(input.utilization, 0.01), false);
  const emergencyScore = scoreFromRatio(input.emergencyMonths, 6, true);
  const incomeExpenseScore = scoreFromRatio(72, input.expenseRatio, false);
  const goalScore =
    input.goalCount > 0
      ? clampScore((input.goalsOnTrack / input.goalCount) * 100)
      : 50;

  return [
    {
      name: "Savings Rate",
      score: savingsScore,
      weight: 20,
      description: `You save ${input.savingsRate.toFixed(1)}% of income. Target: 20%+`,
      trend: savingsScore >= 70 ? "up" : savingsScore >= 50 ? "neutral" : "down",
    },
    {
      name: "Debt Health",
      score: debtScore,
      weight: 20,
      description: `Credit utilization est. ${input.utilization.toFixed(0)}%. Target: <30%`,
      trend: debtScore >= 70 ? "up" : "down",
    },
    {
      name: "Emergency Fund",
      score: emergencyScore,
      weight: 15,
      description: `${input.emergencyMonths.toFixed(1)} months runway. Target: 6+ months`,
      trend: emergencyScore >= 70 ? "up" : "neutral",
    },
    {
      name: "Income-to-Expense",
      score: incomeExpenseScore,
      weight: 20,
      description: `Expenses are ${input.expenseRatio.toFixed(0)}% of income`,
      trend: incomeExpenseScore >= 70 ? "up" : "down",
    },
    {
      name: "Inflation Beat",
      score: clampScore(savingsScore * 0.85),
      weight: 10,
      description: `Real savings pace based on ${input.savingsRate.toFixed(1)}% savings rate`,
      trend: "neutral",
    },
    {
      name: "Investment Growth",
      score: 50,
      weight: 10,
      description: "Connect investment accounts for growth tracking",
      trend: "neutral",
    },
    {
      name: "Goal Pace",
      score: goalScore,
      weight: 5,
      description:
        input.goalCount > 0
          ? `${input.goalsOnTrack}/${input.goalCount} goals on track`
          : "Add savings goals to track progress",
      trend: goalScore >= 70 ? "up" : "neutral",
    },
  ];
}

function compositeScore(dimensions: WellnessResponse["dimensions"]): number {
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const weighted = dimensions.reduce((s, d) => s + d.score * d.weight, 0);
  return totalWeight > 0 ? clampScore(weighted / totalWeight) : 0;
}

/** Compute wellness score from live transactions and accounts. */
export async function computeWellnessFromTransactions(
  userIds: string[],
): Promise<WellnessResponse> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return emptyWellnessResponse();
  }

  const db = getDb();
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);
  const months = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
    })
    .from(transactions)
    .where(and(txScope, eq(transactions.pending, false)))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

  const monthKeys = months.map((m) => m.month).slice(-8);
  const history: WellnessResponse["history"] = [];

  for (const mk of monthKeys) {
    const totals = await monthTotals(userIds, accountIds, mk);
    const { liquidCash, creditBalance, creditLimit } = await accountMetrics(userIds);
    const utilization =
      creditLimit > 0 ? (creditBalance / creditLimit) * 100 : 0;
    const monthlySpend = totals.spending || 1;
    const emergencyMonths = liquidCash / monthlySpend;
    const expenseRatio =
      totals.income > 0 ? (totals.spending / totals.income) * 100 : 100;
    const dims = buildDimensions({
      savingsRate: totals.savingsRate,
      utilization,
      emergencyMonths,
      expenseRatio,
      goalsOnTrack: 0,
      goalCount: 0,
    });
    history.push({ month: mk.slice(5), score: compositeScore(dims) });
  }

  const latestPeriod = monthKeys[monthKeys.length - 1] ?? new Date().toISOString().slice(0, 7);
  const latestTotals = await monthTotals(userIds, accountIds, latestPeriod);
  const priorPeriod = monthKeys[monthKeys.length - 2];
  const priorTotals = priorPeriod
    ? await monthTotals(userIds, accountIds, priorPeriod)
    : null;

  const { liquidCash, creditBalance, creditLimit } = await accountMetrics(userIds);
  const utilization = creditLimit > 0 ? (creditBalance / creditLimit) * 100 : 0;
  const monthlySpend = latestTotals.spending || 1;
  const emergencyMonths = liquidCash / monthlySpend;
  const expenseRatio =
    latestTotals.income > 0
      ? (latestTotals.spending / latestTotals.income) * 100
      : 100;

  const goalRows = await db
    .select()
    .from(savingsGoals)
    .where(inArray(savingsGoals.userId, userIds));
  const goalsOnTrack = goalRows.filter((g) => {
    const target = Number.parseFloat(g.targetAmount);
    const current = Number.parseFloat(g.currentAmount);
    return target > 0 && current / target >= 0.5;
  }).length;

  const dimensions = buildDimensions({
    savingsRate: latestTotals.savingsRate,
    utilization,
    emergencyMonths,
    expenseRatio,
    goalsOnTrack,
    goalCount: goalRows.length,
  });
  const score = compositeScore(dimensions);
  const priorDims = priorTotals
    ? buildDimensions({
        savingsRate: priorTotals.savingsRate,
        utilization,
        emergencyMonths,
        expenseRatio:
          priorTotals.income > 0
            ? (priorTotals.spending / priorTotals.income) * 100
            : 100,
        goalsOnTrack,
        goalCount: goalRows.length,
      })
    : null;
  const priorScore = priorDims ? compositeScore(priorDims) : score;

  return {
    score,
    delta: score - priorScore,
    history,
    dimensions,
    isLive: history.length > 0,
  };
}

export interface MonthlySummary {
  period: string;
  income: string;
  spending: string;
  savingsRate: number;
  topCategory: { name: string; amount: string } | null;
  safeToSpend: string;
}

export async function buildMonthlySummary(
  userIds: string[],
): Promise<MonthlySummary> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  const period = new Date().toISOString().slice(0, 7);
  if (!hasActiveAccounts) {
    return {
      period,
      income: "0.00",
      spending: "0.00",
      savingsRate: 0,
      topCategory: null,
      safeToSpend: "0.00",
    };
  }
  const totals = await monthTotals(userIds, accountIds, period);
  const { start, end } = monthBounds(period);
  const db = getDb();
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);

  const [top] = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
        sql`${transactions.date} >= ${start} and ${transactions.date} <= ${end}`,
      ),
    )
    .groupBy(transactions.category)
    .orderBy(sql`sum(${transactions.amount}) desc`)
    .limit(1);

  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(lastDay - now.getDate(), 1);
  const remaining = Math.max(totals.income - totals.spending, 0);
  const safeToSpend = remaining / daysRemaining;

  return {
    period,
    income: formatMoneyAmount(totals.income),
    spending: formatMoneyAmount(totals.spending),
    savingsRate: totals.savingsRate,
    topCategory: top
      ? {
          name: top.category,
          amount: formatMoneyAmount(top.total ?? "0"),
        }
      : null,
    safeToSpend: formatMoneyAmount(safeToSpend),
  };
}
