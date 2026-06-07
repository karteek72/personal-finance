import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { savingsGoals, transactions } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { getAccountMetricsAsOf } from "./balance-snapshots.js";
import { getCompositeDataQualityConfidence } from "./data-quality.js";
import {
  resolveEffectiveMonthlyIncome,
} from "./effective-income.js";
import { emptyWellnessResponse, type WellnessResponse } from "./insights-store.js";
import {
  averageMonthlyInvestment,
  averageMonthlyCashSpending,
} from "./investment-analytics.js";
import {
  computeBurnRate,
  computeEmergencyMonths,
  computeFreeCashFlow,
  computeSavingsRate,
  metricNumericValue,
  savingsRateMetric,
} from "./metrics/index.js";
import { discretionaryOutflowForPeriod } from "./metrics/spend-class.js";
import { monthCashflowTotals, trailingEssentialOutflow } from "./metrics/transaction-aggregates.js";
import {
  buildWellnessDimensions,
  compositeCashFlowScore,
  compositeConfidence,
  compositeScore,
  type GoalPaceInput,
} from "./wellness-scoring.js";

function monthBounds(period: string): { start: string; end: string } {
  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function utilizationPercent(
  creditBalance: number,
  creditLimit: number,
  hasCreditLimit: boolean,
): number | null {
  if (!hasCreditLimit || creditLimit <= 0) {
    return null;
  }
  return (creditBalance / creditLimit) * 100;
}

async function resolveEmergencyMonths(input: {
  userIds: string[];
  accountIds: string[];
  liquidCash: number;
  asOfDate: string;
}): Promise<number> {
  const { total, months } = await trailingEssentialOutflow(
    input.userIds,
    input.accountIds,
    input.asOfDate,
    3,
  );
  const essentialBurn = computeBurnRate({
    essentialOutflowTotal: total,
    months,
  });
  return computeEmergencyMonths({
    liquidReserves: input.liquidCash,
    essentialBurnRate: essentialBurn,
  });
}

async function spendingVolatility(
  userIds: string[],
  accountIds: string[],
  endDate: string,
): Promise<number | null> {
  if (accountIds.length === 0) return null;

  const db = getDb();
  const start = new Date(`${endDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 90);
  const startDate = start.toISOString().slice(0, 10);

  const rows = await db
    .select({
      day: transactions.date,
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.date} >= ${startDate} and ${transactions.date} <= ${endDate}`,
      ),
    )
    .groupBy(transactions.date);

  if (rows.length < 7) return null;

  const dailyTotals = rows.map((r) => Number.parseFloat(r.total));
  const mean = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
  if (mean <= 0) return null;
  const variance =
    dailyTotals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
    dailyTotals.length;
  return Math.sqrt(variance) / mean;
}

async function buildHealthInputs(input: {
  userIds: string[];
  primaryUserId: string;
  accountIds: string[];
  period: string;
  asOfDate: string;
  liquidCash: number;
  utilization: number | null;
  goals: GoalPaceInput[];
  dataQualityConfidence: number;
}): Promise<WellnessResponse["dimensions"]> {
  const totals = await monthCashflowTotals(
    input.userIds,
    input.accountIds,
    input.period,
  );
  const effectiveIncome = await resolveEffectiveMonthlyIncome(
    input.primaryUserId,
    totals.income,
  );
  const incomeForMetrics =
    effectiveIncome.source === "stated"
      ? effectiveIncome.monthlyIncome
      : totals.income;
  const savingsRate = computeSavingsRate({
    income: incomeForMetrics,
    expense: totals.expense,
  });
  const freeCashFlow = computeFreeCashFlow({
    income: incomeForMetrics,
    essentialOutflow: totals.essentialExpense,
  });
  const emergencyMonths = await resolveEmergencyMonths({
    userIds: input.userIds,
    accountIds: input.accountIds,
    liquidCash: input.liquidCash,
    asOfDate: input.asOfDate,
  });

  const monthlyInvest = await averageMonthlyInvestment(input.userIds, 3);
  const monthlySpend = await averageMonthlyCashSpending(input.userIds, 3);
  const netInvestRate =
    incomeForMetrics > 0 ? monthlyInvest / incomeForMetrics : null;

  const { discretionary, total } = await discretionaryOutflowForPeriod(
    input.userIds,
    input.accountIds,
    input.period,
  );
  const discretionaryShare = total > 0 ? discretionary / total : null;
  const volatility = await spendingVolatility(
    input.userIds,
    input.accountIds,
    input.asOfDate,
  );

  const dimensions = buildWellnessDimensions({
    savingsRate,
    freeCashFlow,
    income: incomeForMetrics,
    emergencyMonths,
    utilization: input.utilization,
    netInvestRate,
    spendingVolatility: volatility,
    discretionaryShare,
    goals: input.goals,
    dataQualityConfidence: input.dataQualityConfidence,
  });

  if (effectiveIncome.caveats.length === 0) {
    return dimensions;
  }

  const caveatNote = effectiveIncome.caveats.join(" ");
  return dimensions.map((dimension) =>
    dimension.name === "Savings"
      ? {
          ...dimension,
          description: `${dimension.description} ${caveatNote}`.trim(),
        }
      : dimension,
  );
}

/** Compute wellness score from live transactions and accounts. */
export async function computeWellnessFromTransactions(
  userIds: string[],
  primaryUserId: string,
): Promise<WellnessResponse> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return emptyWellnessResponse();
  }

  const db = getDb();
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);
  const dataQualityConfidence =
    await getCompositeDataQualityConfidence(primaryUserId);

  const months = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
    })
    .from(transactions)
    .where(and(txScope, eq(transactions.pending, false)))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

  const goalRows = await db
    .select()
    .from(savingsGoals)
    .where(inArray(savingsGoals.userId, userIds));
  const goals: GoalPaceInput[] = goalRows.map((g) => ({
    target: Number.parseFloat(g.targetAmount),
    current: Number.parseFloat(g.currentAmount),
    deadline: g.deadline,
    createdAt: g.createdAt,
  }));

  const monthKeys = months.map((m) => m.month).slice(-8);
  const history: WellnessResponse["history"] = [];

  for (const mk of monthKeys) {
    const { end: monthEnd } = monthBounds(mk);
    const snapshot = await getAccountMetricsAsOf(userIds, monthEnd);
    const utilization = utilizationPercent(
      snapshot.creditBalance,
      snapshot.creditLimit,
      snapshot.hasCreditLimit,
    );

    let score: number;
    if (snapshot.hasSnapshot) {
      const dims = await buildHealthInputs({
        userIds,
        primaryUserId,
        accountIds,
        period: mk,
        asOfDate: monthEnd,
        liquidCash: snapshot.liquidCash,
        utilization,
        goals: [],
        dataQualityConfidence,
      });
      score = compositeScore(dims);
    } else {
      const dims = await buildHealthInputs({
        userIds,
        primaryUserId,
        accountIds,
        period: mk,
        asOfDate: monthEnd,
        liquidCash: 0,
        utilization: null,
        goals: [],
        dataQualityConfidence,
      });
      score = compositeCashFlowScore(dims);
    }

    history.push({ month: mk.slice(5), score });
  }

  const latestPeriod =
    monthKeys[monthKeys.length - 1] ?? new Date().toISOString().slice(0, 7);
  const priorPeriod = monthKeys[monthKeys.length - 2];
  const today = new Date().toISOString().slice(0, 10);
  const { liquidCash, creditBalance, creditLimit, hasCreditLimit } =
    await getAccountMetricsAsOf(userIds, today);
  const utilization = utilizationPercent(
    creditBalance,
    creditLimit,
    hasCreditLimit,
  );

  const dimensions = await buildHealthInputs({
    userIds,
    primaryUserId,
    accountIds,
    period: latestPeriod,
    asOfDate: today,
    liquidCash,
    utilization,
    goals,
    dataQualityConfidence,
  });
  const score = compositeScore(dimensions);
  const confidence = compositeConfidence(dimensions);

  let priorScore = score;
  if (priorPeriod) {
    const { end: priorEnd } = monthBounds(priorPeriod);
    const priorSnapshot = await getAccountMetricsAsOf(userIds, priorEnd);
    const priorUtil = utilizationPercent(
      priorSnapshot.creditBalance,
      priorSnapshot.creditLimit,
      priorSnapshot.hasCreditLimit,
    );
    const priorDims = await buildHealthInputs({
      userIds,
      primaryUserId,
      accountIds,
      period: priorPeriod,
      asOfDate: priorEnd,
      liquidCash: priorSnapshot.liquidCash,
      utilization: priorUtil,
      goals,
      dataQualityConfidence,
    });
    priorScore = compositeScore(priorDims);
  }

  return {
    score,
    delta: score - priorScore,
    confidence,
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
  const totals = await monthCashflowTotals(userIds, accountIds, period);
  const savingsRate = computeSavingsRate({
    income: totals.income,
    expense: totals.expense,
  });
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
  const remaining = Math.max(totals.income - totals.expense, 0);
  const safeToSpend = remaining / daysRemaining;

  return {
    period,
    income: formatMoneyAmount(totals.income),
    spending: formatMoneyAmount(totals.expense),
    savingsRate,
    topCategory: top
      ? {
          name: top.category,
          amount: formatMoneyAmount(top.total ?? "0"),
        }
      : null,
    safeToSpend: formatMoneyAmount(safeToSpend),
  };
}
