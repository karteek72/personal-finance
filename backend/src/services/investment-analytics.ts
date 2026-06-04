import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  fireProfiles,
  holdings,
  investmentTransactions,
  securities,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount, roundPercent } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";
import {
  holdingMarketValue,
  isOptionAssetType,
  parseOptionSector,
} from "./holdings-mapper.js";

const DINING_CATEGORIES = new Set([
  "Food & Drink",
  "Restaurants",
  "Dining",
  "Dining & Restaurants",
  "Coffee Shops",
]);

export interface InvestmentBehavioralAlert {
  type: "warning" | "info" | "positive";
  title: string;
  desc: string;
}

export interface InvestmentHistorySummary {
  lookbackYears: number;
  totalContributed: string;
  estimatedValueToday: string;
  monthlyAverageInvest: string;
  transactionCount: number;
}

export interface InvestmentMonthlyComparison {
  monthlyInvest: string;
  diningSpend: string;
  ratio: number | null;
  summary: string | null;
}

export interface FireProfileInputs {
  currentAge: number;
  currentNetWorth: string;
  monthlySpend: string;
  monthlyInvest: string;
  withdrawalRate: number;
  realReturn: number;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function parseExpirationDate(label: string | null): Date | null {
  if (!label) return null;
  const parsed = Date.parse(label);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

export async function sumInvestmentContributions(
  userIds: string[],
  sinceDate: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(abs(${investmentTransactions.amount}::numeric)), 0)`,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        gte(investmentTransactions.date, sinceDate),
        inArray(investmentTransactions.type, ["buy", "contribution"]),
      ),
    );
  return Number.parseFloat(row?.total ?? "0");
}

export async function averageMonthlyInvestment(
  userIds: string[],
  lookbackMonths = 3,
): Promise<number> {
  const since = monthsAgo(lookbackMonths);
  const total = await sumInvestmentContributions(userIds, since);
  return total / Math.max(lookbackMonths, 1);
}

export async function averageMonthlyCashSpending(
  userIds: string[],
  lookbackMonths = 3,
): Promise<number> {
  const db = getDb();
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) return 0;

  const since = monthsAgo(lookbackMonths);
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);
  const [row] = await db
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
        gte(transactions.date, since),
      ),
    );
  const total = Number.parseFloat(row?.total ?? "0");
  return total / Math.max(lookbackMonths, 1);
}

export async function sumDiningSpendLastMonth(userIds: string[]): Promise<number> {
  const db = getDb();
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) return 0;

  const now = new Date();
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount}::numeric)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        gte(transactions.date, start),
      ),
    )
    .groupBy(transactions.category);

  let dining = 0;
  for (const row of rows) {
    if (DINING_CATEGORIES.has(row.category)) {
      dining += Number.parseFloat(row.total ?? "0");
    }
  }
  return dining;
}

function currentMonthStartIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function buildInvestmentMonthlyComparison(
  userIds: string[],
): Promise<InvestmentMonthlyComparison | null> {
  const monthStart = currentMonthStartIso();
  const monthlyInvest = await sumInvestmentContributions(userIds, monthStart);
  const diningSpend = await sumDiningSpendLastMonth(userIds);

  if (monthlyInvest <= 0 && diningSpend <= 0) {
    return null;
  }

  const ratio =
    diningSpend > 0 && monthlyInvest > 0 ? monthlyInvest / diningSpend : null;

  let summary: string | null = null;
  if (ratio != null) {
    summary =
      ratio >= 1
        ? `Invest-to-dine ratio: ${ratio.toFixed(2)} — you're investing more than dining this month.`
        : `Invest-to-dine ratio: ${ratio.toFixed(2)} — dining outpaces investing this month.`;
  }

  return {
    monthlyInvest: formatMoneyAmount(monthlyInvest),
    diningSpend: formatMoneyAmount(diningSpend),
    ratio,
    summary,
  };
}

export async function buildInvestmentBehavioralAlerts(
  userIds: string[],
): Promise<InvestmentBehavioralAlert[]> {
  const db = getDb();
  const alerts: InvestmentBehavioralAlert[] = [];

  const holdingRows = await db
    .select({
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      institutionValue: holdings.institutionValue,
      ticker: securities.ticker,
      sector: securities.sector,
      assetType: securities.assetType,
      currentPrice: securities.currentPrice,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.securityId, securities.id))
    .where(inArray(holdings.userId, userIds));

  let portfolioValue = 0;
  let stocksValue = 0;
  let optionsValue = 0;
  const stockByTicker = new Map<string, number>();
  const optionByUnderlying = new Map<string, number>();
  let expiringOptionCount = 0;
  const now = new Date();
  const expiringThresholdMs = 30 * 24 * 60 * 60 * 1000;

  for (const row of holdingRows) {
    const value = holdingMarketValue({
      quantity: row.quantity,
      costBasis: row.costBasis,
      institutionValue: row.institutionValue,
      currentPrice: row.currentPrice,
    }).value;
    portfolioValue += value;

    if (isOptionAssetType(row.assetType)) {
      optionsValue += value;
      const meta = parseOptionSector(row.sector);
      const underlying = meta.underlyingTicker ?? row.ticker.split(/\s+/)[0] ?? row.ticker;
      optionByUnderlying.set(
        underlying,
        (optionByUnderlying.get(underlying) ?? 0) + value,
      );
      const exp = parseExpirationDate(meta.expirationLabel);
      if (exp && exp.getTime() - now.getTime() <= expiringThresholdMs && exp >= now) {
        expiringOptionCount += 1;
      }
    } else {
      stocksValue += value;
      stockByTicker.set(row.ticker, (stockByTicker.get(row.ticker) ?? 0) + value);
    }
  }

  if (stocksValue > 0) {
    const ranked = [...stockByTicker.entries()].sort((a, b) => b[1] - a[1]);
    const [topTicker, topValue] = ranked[0] ?? [];
    if (topTicker && topValue) {
      const share = (topValue / stocksValue) * 100;
      if (share > 30) {
        alerts.push({
          type: "warning",
          title: "Stock concentration",
          desc: `${topTicker} is ${Math.round(share)}% of your stock & ETF holdings — consider diversifying equity exposure.`,
        });
      }
    }
  }

  if (portfolioValue > 0 && optionsValue > 0) {
    const optionsShare = (optionsValue / portfolioValue) * 100;
    if (optionsShare > 35) {
      alerts.push({
        type: "warning",
        title: "High options exposure",
        desc: `Options are ${Math.round(optionsShare)}% of portfolio value (${formatMoneyAmount(optionsValue)}). Options carry leverage and time-decay risk distinct from stocks.`,
      });
    } else if (optionsShare > 15) {
      alerts.push({
        type: "info",
        title: "Options allocation",
        desc: `Options represent ${Math.round(optionsShare)}% of portfolio value. Monitor expirations and underlying concentration separately from stocks.`,
      });
    }
  }

  if (optionByUnderlying.size > 0 && optionsValue > 0) {
    const ranked = [...optionByUnderlying.entries()].sort((a, b) => b[1] - a[1]);
    const [topUnderlying, topValue] = ranked[0] ?? [];
    if (topUnderlying && topValue) {
      const share = (topValue / optionsValue) * 100;
      if (share > 40) {
        alerts.push({
          type: "warning",
          title: "Options tied to one name",
          desc: `${topUnderlying} underlies ${Math.round(share)}% of your options value — single-name derivative risk.`,
        });
      }
    }
  }

  if (expiringOptionCount > 0) {
    alerts.push({
      type: "info",
      title: "Options expiring soon",
      desc: `${expiringOptionCount} option position${expiringOptionCount === 1 ? "" : "s"} expire within 30 days — review roll or close decisions.`,
    });
  }

  const monthlyInvest = await averageMonthlyInvestment(userIds, 3);
  const monthlyBuys = await db
    .select({
      month: sql<string>`to_char(${investmentTransactions.date}, 'YYYY-MM')`,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        gte(investmentTransactions.date, monthsAgo(6)),
        eq(investmentTransactions.type, "buy"),
      ),
    )
    .groupBy(sql`to_char(${investmentTransactions.date}, 'YYYY-MM')`);

  if (monthlyBuys.length >= 3) {
    alerts.push({
      type: "positive",
      title: "Dollar-cost averaging",
      desc: `You've made buys in ${monthlyBuys.length} of the last 6 months — consistent investing builds long-term wealth.`,
    });
  } else if (monthlyInvest > 0) {
    alerts.push({
      type: "info",
      title: "Investment pace",
      desc: `You're investing about ${formatMoneyAmount(monthlyInvest)}/month on average over the last 3 months.`,
    });
  }

  const dining = await sumDiningSpendLastMonth(userIds);
  if (monthlyInvest > 0 && dining > 0 && monthlyInvest > dining) {
    alerts.push({
      type: "positive",
      title: "Investing more than dining out",
      desc: `You invested ${formatMoneyAmount(monthlyInvest)} on average recently vs ${formatMoneyAmount(dining)} on dining this month.`,
    });
  }

  return alerts;
}

export async function buildInvestmentHistorySummary(
  userIds: string[],
  lookbackYears = 3,
): Promise<InvestmentHistorySummary | null> {
  const since = monthsAgo(lookbackYears * 12);
  const totalContributed = await sumInvestmentContributions(userIds, since);
  if (totalContributed <= 0) return null;

  const db = getDb();
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        gte(investmentTransactions.date, since),
        inArray(investmentTransactions.type, ["buy", "contribution"]),
      ),
    );

  const holdingRows = await db
    .select({
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      institutionValue: holdings.institutionValue,
      currentPrice: securities.currentPrice,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.securityId, securities.id))
    .where(inArray(holdings.userId, userIds));

  let portfolioValue = 0;
  let totalCost = 0;
  for (const row of holdingRows) {
    portfolioValue += holdingMarketValue({
      quantity: row.quantity,
      costBasis: row.costBasis,
      institutionValue: row.institutionValue,
      currentPrice: row.currentPrice,
    }).value;
    totalCost +=
      Number.parseFloat(row.quantity) * Number.parseFloat(row.costBasis);
  }

  const growthMultiple =
    totalCost > 0 ? Math.max(portfolioValue / totalCost, 1) : 1.15;
  const estimatedValueToday = totalContributed * growthMultiple;

  return {
    lookbackYears,
    totalContributed: formatMoneyAmount(totalContributed),
    estimatedValueToday: formatMoneyAmount(estimatedValueToday),
    monthlyAverageInvest: formatMoneyAmount(
      totalContributed / (lookbackYears * 12),
    ),
    transactionCount: countRow?.count ?? 0,
  };
}

export async function computeLiveNetWorth(userIds: string[]): Promise<number> {
  const db = getDb();
  const accountRows = await db
    .select({
      type: accounts.type,
      balanceCurrent: accounts.balanceCurrent,
    })
    .from(accounts)
    .where(
      and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)),
    );

  let assets = 0;
  let liabilities = 0;
  for (const a of accountRows) {
    const bal = Number.parseFloat(a.balanceCurrent ?? "0");
    if (a.type === "credit") liabilities += bal;
    else assets += bal;
  }
  return assets - liabilities;
}

export async function computeFireProfileInputs(
  userId: string,
  userIds: string[],
): Promise<FireProfileInputs | null> {
  const { hasActiveAccounts } = await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return null;

  const db = getDb();
  const [existing] = await db
    .select({
      currentAge: fireProfiles.currentAge,
      withdrawalRate: fireProfiles.withdrawalRate,
      realReturn: fireProfiles.realReturn,
    })
    .from(fireProfiles)
    .where(eq(fireProfiles.userId, userId))
    .limit(1);

  const netWorth = await computeLiveNetWorth(userIds);
  const monthlySpend = await averageMonthlyCashSpending(userIds, 3);
  const monthlyInvest = await averageMonthlyInvestment(userIds, 3);

  if (netWorth <= 0 && monthlySpend <= 0 && monthlyInvest <= 0) {
    return null;
  }

  return {
    currentAge: existing?.currentAge ?? 35,
    currentNetWorth: formatMoneyAmount(netWorth),
    monthlySpend: formatMoneyAmount(Math.max(monthlySpend, 0)),
    monthlyInvest: formatMoneyAmount(Math.max(monthlyInvest, 0)),
    withdrawalRate: existing
      ? roundPercent(Number.parseFloat(existing.withdrawalRate))
      : 4,
    realReturn: existing
      ? roundPercent(Number.parseFloat(existing.realReturn))
      : 6,
  };
}

export async function refreshFireProfile(userId: string): Promise<void> {
  const db = getDb();
  const inputs = await computeFireProfileInputs(userId, [userId]);
  if (!inputs) return;

  await db
    .insert(fireProfiles)
    .values({
      userId,
      currentAge: inputs.currentAge,
      currentNetWorth: inputs.currentNetWorth,
      monthlySpend: inputs.monthlySpend,
      monthlyInvest: inputs.monthlyInvest,
      withdrawalRate: String(inputs.withdrawalRate),
      realReturn: String(inputs.realReturn),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fireProfiles.userId,
      set: {
        currentNetWorth: inputs.currentNetWorth,
        monthlySpend: inputs.monthlySpend,
        monthlyInvest: inputs.monthlyInvest,
        updatedAt: new Date(),
      },
    });
}

export async function computeInvestmentGrowthScore(
  userIds: string[],
): Promise<{ score: number; description: string; trend: string }> {
  const monthlyInvest = await averageMonthlyInvestment(userIds, 3);
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) {
    return {
      score: 50,
      description: "Connect investment accounts for growth tracking",
      trend: "neutral",
    };
  }

  const db = getDb();
  const investmentAccounts = await db
    .select({ balanceCurrent: accounts.balanceCurrent })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, userIds),
        eq(accounts.type, "investment"),
        eq(accounts.isActive, true),
      ),
    );

  const investBalance = investmentAccounts.reduce(
    (sum, a) => sum + Number.parseFloat(a.balanceCurrent ?? "0"),
    0,
  );

  if (investBalance <= 0 && monthlyInvest <= 0) {
    return {
      score: 45,
      description: "Connect a brokerage to track investment growth",
      trend: "neutral",
    };
  }

  const monthlySpend = await averageMonthlyCashSpending(userIds, 3);
  const investRate =
    monthlySpend + monthlyInvest > 0
      ? (monthlyInvest / (monthlySpend + monthlyInvest)) * 100
      : 0;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (investBalance > 0 ? 40 : 0) +
          Math.min(investRate * 2, 40) +
          (monthlyInvest >= 500 ? 20 : monthlyInvest >= 100 ? 10 : 0),
      ),
    ),
  );

  return {
    score,
    description:
      monthlyInvest > 0
        ? `Investing ${formatMoneyAmount(monthlyInvest)}/mo (${roundPercent(investRate)}% of cash flow)`
        : `Investment balance ${formatMoneyAmount(investBalance)}`,
    trend: score >= 70 ? "up" : score >= 50 ? "neutral" : "down",
  };
}
