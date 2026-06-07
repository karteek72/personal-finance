import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  coachInsights,
  savingsGoals,
  transactions,
  wrappedSummaries,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal, roundPercent } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { computeIncomeSummary } from "./computed-fields.js";
import { computeWrappedFromTransactions } from "./compute-wrapped.js";

export interface CoachResponse {
  narrative: string;
  forecast: string;
  qa: Array<{ q: string; a: string }>;
}

export async function getCoach(userId: string): Promise<CoachResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return { narrative: "", forecast: "", qa: [] };
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(coachInsights)
    .where(inArray(coachInsights.userId, ctx.userIds))
    .orderBy(asc(coachInsights.sortOrder));

  return {
    narrative: rows.find((r) => r.kind === "narrative")?.answer ?? "",
    forecast: rows.find((r) => r.kind === "forecast")?.answer ?? "",
    qa: rows
      .filter((r) => r.kind === "qa" && r.question)
      .map((r) => ({ q: r.question ?? "", a: r.answer })),
  };
}

export interface WrappedResponse {
  year: number;
  totalSpent: string;
  transactionCount: number;
  totalSaved: string;
  savingsRate: number;
  peerPercentile: string | null;
  archetype: string | null;
  topCategory: unknown;
  personality: unknown;
  moments: unknown;
  goals: Array<{ label: string; target: string; pct: number }>;
}

export async function getWrapped(
  userId: string,
): Promise<WrappedResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return null;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(wrappedSummaries)
    .where(inArray(wrappedSummaries.userId, ctx.userIds))
    .orderBy(asc(wrappedSummaries.year));
  const latest = rows[rows.length - 1];
  if (!latest) {
    return computeWrappedFromTransactions(ctx.userIds);
  }
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(inArray(savingsGoals.userId, ctx.userIds));

  return {
    year: latest.year,
    totalSpent: formatMoneyAmount(latest.totalSpent),
    transactionCount: latest.transactionCount,
    totalSaved: formatMoneyAmount(latest.totalSaved),
    savingsRate: roundDecimal(Number.parseFloat(latest.savingsRate)),
    peerPercentile: latest.peerPercentile,
    archetype: latest.archetype,
    topCategory: latest.topCategory,
    personality: latest.personality,
    moments: latest.moments,
    goals: goals.map((g) => {
      const target = Number.parseFloat(g.targetAmount);
      const current = Number.parseFloat(g.currentAmount);
      return {
        label: g.name,
        target: formatMoneyAmount(target),
        pct: target > 0 ? roundPercent((current / target) * 100) : 0,
      };
    }),
  };
}

const MERCHANT_EMOJI: Record<string, string> = {
  Amazon: "📦",
  "Whole Foods Market": "🥑",
  DoorDash: "🍽️",
  Shell: "⛽",
  Starbucks: "☕",
  Uber: "🚗",
};

export interface MerchantsResponse {
  merchants: Array<{
    name: string;
    emoji: string;
    visits: number;
    total: string;
    trend: number;
    trail: number[];
  }>;
  income: { months: string[]; primary: number[]; side: number[] };
  incomeSummary: {
    avgMonthlyIncome: string;
    incomeStability: number;
    sideIncomeTotal: string;
    chartYTicks: number[];
    maxBarTotal: number;
  };
  merchantCount: number;
  incomeSources: number;
  isLive: boolean;
}

export async function getMerchants(
  userId: string,
): Promise<MerchantsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return {
      merchants: [],
      income: { months: [], primary: [], side: [] },
      incomeSummary: {
        avgMonthlyIncome: "0.00",
        incomeStability: 0,
        sideIncomeTotal: "0.00",
        chartYTicks: [0, 0, 0],
        maxBarTotal: 0,
      },
      merchantCount: 0,
      incomeSources: 0,
      isLive: false,
    };
  }

  const db = getDb();

  const rows = await db
    .select({
      merchant: transactions.merchantName,
      amount: transactions.amount,
      date: transactions.date,
      type: transactions.transactionType,
      isTransfer: transactions.isTransfer,
      subCategory: transactions.subCategory,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(ctx.userIds, accountIds),
        eq(transactions.pending, false),
      ),
    );

  const allMonths = [
    ...new Set(rows.map((r) => r.date.slice(0, 7))),
  ].sort();
  const last6 = allMonths.slice(-6);

  interface MerchAgg {
    total: number;
    visits: number;
    months: Map<string, number>;
  }
  const agg = new Map<string, MerchAgg>();
  for (const r of rows) {
    if (r.type !== "expense" || r.isTransfer || !r.merchant) continue;
    const e = agg.get(r.merchant) ?? { total: 0, visits: 0, months: new Map() };
    const amt = Number.parseFloat(r.amount);
    e.total += amt;
    e.visits += 1;
    const mk = r.date.slice(0, 7);
    e.months.set(mk, (e.months.get(mk) ?? 0) + amt);
    agg.set(r.merchant, e);
  }

  const merchants = [...agg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([name, e]) => {
      const trail = last6.map((mk) => roundDecimal(e.months.get(mk) ?? 0));
      const prev = trail[trail.length - 2] || 1;
      const curr = trail[trail.length - 1] ?? 0;
      return {
        name,
        emoji: MERCHANT_EMOJI[name] ?? "🏬",
        visits: e.visits,
        total: formatMoneyAmount(e.total),
        trend: roundPercent(((curr - prev) / prev) * 100),
        trail,
      };
    });

  const incomeByMonth = new Map<string, number>();
  const sideByMonth = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== "income" || r.isTransfer) continue;
    const mk = r.date.slice(0, 7);
    const amt = Math.abs(Number.parseFloat(r.amount));
    incomeByMonth.set(mk, (incomeByMonth.get(mk) ?? 0) + amt);
    if (r.subCategory === "Side Income") {
      sideByMonth.set(mk, (sideByMonth.get(mk) ?? 0) + amt);
    }
  }

  const income = {
    months: last6.map((mk) => mk.slice(5)),
    primary: last6.map((mk) =>
      Math.round((incomeByMonth.get(mk) ?? 0) - (sideByMonth.get(mk) ?? 0)),
    ),
    side: last6.map((mk) => Math.round(sideByMonth.get(mk) ?? 0)),
  };

  return {
    merchants,
    income,
    incomeSummary: computeIncomeSummary(income),
    merchantCount: agg.size,
    incomeSources: incomeByMonth.size > 0 ? (sideByMonth.size > 0 ? 2 : 1) : 0,
    isLive: agg.size > 0 || incomeByMonth.size > 0,
  };
}
