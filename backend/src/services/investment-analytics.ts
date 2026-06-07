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
  isNonContributionActivityName,
  shouldReclassifyAsNonContribution,
} from "./investment-txn-classify.js";
import { splitBalanceForNetWorth } from "../config/account-types.js";
import {
  effectiveAssetType,
  holdingMarketValue,
  isOptionAssetType,
  normalizeCostBasisPerUnit,
  OPTION_SHARES_PER_CONTRACT,
  resolveOptionMeta,
} from "./holdings-mapper.js";

export interface InvestmentBehavioralAlert {
  type: "warning" | "info" | "positive";
  title: string;
  desc: string;
}

export interface InvestmentHistorySummary {
  lookbackYears: number;
  totalContributed: string;
  /** Current holdings market value (not synthesized from contributions). */
  currentPortfolioValue: string;
  totalCostBasis: string;
  unrealizedGain: string;
  monthlyAverageInvest: string;
  transactionCount: number;
  buyTransactionCount: number;
}

/** Cash deployed this month (contributions + normalized buy cost). */
export interface InvestmentMonthlyActivity {
  cashContributions: string;
  purchaseDeployments: string;
  totalDeployed: string;
}

export interface FireProfileInputs {
  currentAge: number;
  isDefaultAge: boolean;
  currentNetWorth: string;
  monthlySpend: string;
  monthlyInvest: string;
  withdrawalRate: number;
  realReturn: number;
}

const DEFAULT_FIRE_AGE = 35;

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Last N calendar months including the current month (`YYYY-MM`). */
function recentCalendarMonths(count: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i += 1) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return months;
}

function parseExpirationDate(label: string | null): Date | null {
  if (!label) return null;
  const parsed = Date.parse(label);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

interface InvestmentTxRow {
  type: string;
  date: string;
  amount: string;
  quantity: string | null;
  price: string | null;
  ticker: string | null;
  assetType: string | null;
  securityId: string | null;
  name?: string | null;
}

/** Cash deployed for a buy/contribution (fixes inflated option notional from brokers). */
export function cashImpactForInvestmentTx(row: InvestmentTxRow): number {
  if (row.name && isNonContributionActivityName(row.name)) {
    return 0;
  }

  if (row.type === "contribution") {
    const amt = Number.parseFloat(row.amount);
    if (!Number.isFinite(amt)) return 0;
    return Math.abs(amt);
  }
  if (row.type !== "buy") {
    return 0;
  }

  const qty = Math.abs(Number.parseFloat(row.quantity ?? "0"));
  const price = Number.parseFloat(row.price ?? "0");
  const reported = Math.abs(Number.parseFloat(row.amount));
  const ticker = row.ticker ?? "";
  const assetType = effectiveAssetType(row.assetType ?? "equity", ticker, null);
  const isOption = isOptionAssetType(assetType, ticker);

  if (qty > 0 && price > 0) {
    const multiplier = isOption ? OPTION_SHARES_PER_CONTRACT : 1;
    const computed = qty * price * multiplier;
    if (computed > 0) {
      if (reported <= 0 || reported > computed * 1.05) {
        return computed;
      }
      return reported;
    }
  }

  if (isOption && qty > 0 && reported > 0) {
    const impliedPerShare = reported / (qty * OPTION_SHARES_PER_CONTRACT);
    if (impliedPerShare > 0 && impliedPerShare <= 500) {
      return reported;
    }
  }

  // Legacy rows stored broker notional without quantity/price — skip them.
  if (qty <= 0 || price <= 0) {
    if (reported >= 500) return 0;
    return reported;
  }

  return reported;
}

async function fetchInvestmentTxRows(
  userIds: string[],
  sinceDate: string,
  types: Array<"buy" | "contribution" | "sell">,
): Promise<InvestmentTxRow[]> {
  const db = getDb();
  return db
    .select({
      type: investmentTransactions.type,
      date: investmentTransactions.date,
      amount: investmentTransactions.amount,
      quantity: investmentTransactions.quantity,
      price: investmentTransactions.price,
      ticker: securities.ticker,
      assetType: securities.assetType,
      securityId: investmentTransactions.securityId,
      name: investmentTransactions.name,
    })
    .from(investmentTransactions)
    .leftJoin(securities, eq(investmentTransactions.securityId, securities.id))
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        gte(investmentTransactions.date, sinceDate),
        inArray(investmentTransactions.type, types),
      ),
    );
}

export async function sumInvestmentContributions(
  userIds: string[],
  sinceDate: string,
): Promise<number> {
  const rows = await fetchInvestmentTxRows(userIds, sinceDate, [
    "buy",
    "contribution",
  ]);
  return rows.reduce((sum, row) => sum + cashImpactForInvestmentTx(row), 0);
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

function currentMonthStartIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function buildInvestmentMonthlyActivity(
  userIds: string[],
): Promise<InvestmentMonthlyActivity | null> {
  const monthStart = currentMonthStartIso();
  const rows = await fetchInvestmentTxRows(userIds, monthStart, [
    "buy",
    "contribution",
  ]);

  let cashContributions = 0;
  let purchaseDeployments = 0;
  for (const row of rows) {
    if (row.type === "contribution") {
      cashContributions += cashImpactForInvestmentTx(row);
    } else if (row.type === "buy") {
      purchaseDeployments += cashImpactForInvestmentTx(row);
    }
  }

  const totalDeployed = cashContributions + purchaseDeployments;
  if (totalDeployed <= 0) {
    return null;
  }

  return {
    cashContributions: formatMoneyAmount(cashContributions),
    purchaseDeployments: formatMoneyAmount(purchaseDeployments),
    totalDeployed: formatMoneyAmount(totalDeployed),
  };
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) ? Math.abs(ms) / (24 * 60 * 60 * 1000) : 9999;
}

async function buildTradingStyleAlerts(
  userIds: string[],
  ctx: {
    portfolioValue: number;
    stocksValue: number;
    optionsValue: number;
    expiringOptionCount: number;
    shortDatedOptionCount: number;
    swingDatedOptionCount: number;
  },
): Promise<InvestmentBehavioralAlert[]> {
  const alerts: InvestmentBehavioralAlert[] = [];
  const since30 = monthsAgo(1);
  const since90 = monthsAgo(3);

  const recentRows = await fetchInvestmentTxRows(userIds, since90, [
    "buy",
    "sell",
  ]);

  const inLast30 = (date: string) => date >= since30;
  const buys30 = recentRows.filter((r) => r.type === "buy" && inLast30(r.date));
  const sells30 = recentRows.filter((r) => r.type === "sell" && inLast30(r.date));

  let roundTrips30 = 0;
  const buysBySecurity = new Map<string, string[]>();
  for (const row of recentRows) {
    if (row.type !== "buy" || !row.securityId) continue;
    const list = buysBySecurity.get(row.securityId) ?? [];
    list.push(row.date);
    buysBySecurity.set(row.securityId, list);
  }
  for (const row of recentRows) {
    if (row.type !== "sell" || !row.securityId || !inLast30(row.date)) continue;
    const buyDates = buysBySecurity.get(row.securityId) ?? [];
    if (buyDates.some((d) => inLast30(d) && daysBetween(d, row.date) <= 7)) {
      roundTrips30 += 1;
    }
  }

  const optionsShare =
    ctx.portfolioValue > 0 ? (ctx.optionsValue / ctx.portfolioValue) * 100 : 0;
  const stocksShare =
    ctx.portfolioValue > 0 ? (ctx.stocksValue / ctx.portfolioValue) * 100 : 0;

  if (roundTrips30 >= 2 || (buys30.length >= 6 && sells30.length >= 3)) {
    alerts.push({
      type: "info",
      title: "Short-term / active trading",
      desc: `Detected ${roundTrips30 > 0 ? `${roundTrips30} quick round-trip${roundTrips30 === 1 ? "" : "s"}` : "frequent buys and sells"} in the last 30 days. This pattern fits day-trading or swing-trading — watch fees, taxes, and position sizing.`,
    });
  } else if (
    optionsShare >= 20 &&
    (ctx.shortDatedOptionCount > 0 || ctx.expiringOptionCount > 0)
  ) {
    alerts.push({
      type: "warning",
      title: "Short-dated options exposure",
      desc: `Options are ${Math.round(optionsShare)}% of portfolio value with contracts expiring within ~30 days. Theta decay is high — treat these as short-term trades, not long-term holdings.`,
    });
  } else if (ctx.swingDatedOptionCount > 0 && optionsShare >= 10) {
    alerts.push({
      type: "info",
      title: "Swing-style options book",
      desc: `You hold options with mid-range expirations alongside stocks. A swing approach can work — define exit rules before entry and cap risk per underlying.`,
    });
  } else if (stocksShare >= 55 && sells30.length <= 1 && optionsShare < 12) {
    alerts.push({
      type: "positive",
      title: "Long-term equity focus",
      desc: `Stocks & ETFs are ${Math.round(stocksShare)}% of portfolio with limited recent selling. This aligns with a buy-and-hold / long-term plan — keep periodic contributions and rebalance on a schedule.`,
    });
  } else if (buys30.length >= 2 && sells30.length === 0 && optionsShare < 15) {
    alerts.push({
      type: "positive",
      title: "Accumulating positions",
      desc: `Recent activity is mostly buys with little selling — consistent with building long-term positions. Consider automating contributions and reviewing concentration periodically.`,
    });
  }

  return alerts;
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
  let shortDatedOptionCount = 0;
  let swingDatedOptionCount = 0;
  let etfValue = 0;
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const expiringThresholdMs = 30 * dayMs;

  for (const row of holdingRows) {
    const qty = Number.parseFloat(row.quantity);
    const rawPrice = Number.parseFloat(row.currentPrice);
    const institution =
      row.institutionValue != null
        ? Number.parseFloat(row.institutionValue)
        : null;
    const assetType = effectiveAssetType(row.assetType, row.ticker, row.sector);
    const costPerShare = normalizeCostBasisPerUnit({
      assetType,
      ticker: row.ticker,
      quantity: qty,
      storedCostBasis: Number.parseFloat(row.costBasis),
      currentPricePerShare: rawPrice > 0 ? rawPrice : undefined,
    });

    const value = holdingMarketValue({
      quantity: row.quantity,
      costBasis: formatMoneyAmount(costPerShare),
      institutionValue: row.institutionValue,
      currentPrice: row.currentPrice,
      assetType,
      ticker: row.ticker,
    }).value;
    portfolioValue += value;

    if (isOptionAssetType(assetType, row.ticker)) {
      optionsValue += value;
      const meta = resolveOptionMeta(assetType, row.ticker, row.sector, row.ticker);
      const underlying =
        meta.underlyingTicker ?? row.ticker.split(/\s+/)[0] ?? row.ticker;
      optionByUnderlying.set(
        underlying,
        (optionByUnderlying.get(underlying) ?? 0) + value,
      );
      const exp = parseExpirationDate(meta.expirationLabel);
      if (exp && exp >= now) {
        const daysToExp = (exp.getTime() - now.getTime()) / dayMs;
        if (daysToExp <= 30) {
          expiringOptionCount += 1;
        }
        if (daysToExp <= 21) {
          shortDatedOptionCount += 1;
        } else if (daysToExp <= 90) {
          swingDatedOptionCount += 1;
        }
      }
    } else {
      stocksValue += value;
      if (row.assetType === "etf" || row.assetType === "mutual_fund") {
        etfValue += value;
      }
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
    const etfShare = (etfValue / stocksValue) * 100;
    if (etfShare >= 50) {
      alerts.push({
        type: "info",
        title: "ETF-heavy equity book",
        desc: `ETFs and funds are ${Math.round(etfShare)}% of stock holdings — a long-term, diversified core. Rebalance if a single fund dominates.`,
      });
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
  const dcaLookbackMonths = 6;
  const dcaWindow = recentCalendarMonths(dcaLookbackMonths);
  const sinceDca = `${dcaWindow[dcaWindow.length - 1]}-01`;
  const monthlyBuyRows = await db
    .select({
      month: sql<string>`to_char(${investmentTransactions.date}, 'YYYY-MM')`,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        gte(investmentTransactions.date, sinceDca),
        eq(investmentTransactions.type, "buy"),
      ),
    )
    .groupBy(sql`to_char(${investmentTransactions.date}, 'YYYY-MM')`);

  const monthsWithBuys = dcaWindow.filter((month) =>
    monthlyBuyRows.some((row) => row.month === month),
  ).length;

  if (monthsWithBuys >= 3) {
    alerts.push({
      type: "positive",
      title: "Dollar-cost averaging",
      desc: `You've made buys in ${monthsWithBuys} of the last ${dcaLookbackMonths} months — consistent investing builds long-term wealth.`,
    });
  } else if (monthlyInvest > 0) {
    alerts.push({
      type: "info",
      title: "Investment pace",
      desc: `You're investing about ${formatMoneyAmount(monthlyInvest)}/month on average over the last 3 months.`,
    });
  }

  const styleAlerts = await buildTradingStyleAlerts(userIds, {
    portfolioValue,
    stocksValue,
    optionsValue,
    expiringOptionCount,
    shortDatedOptionCount,
    swingDatedOptionCount,
  });

  return [...styleAlerts, ...alerts];
}

export async function repairNonContributionInvestmentTxns(
  userIds: string[],
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: investmentTransactions.id,
      type: investmentTransactions.type,
      name: investmentTransactions.name,
      securityId: investmentTransactions.securityId,
      quantity: investmentTransactions.quantity,
      price: investmentTransactions.price,
      amount: investmentTransactions.amount,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        inArray(investmentTransactions.type, ["buy", "contribution"]),
      ),
    );

  let repaired = 0;
  for (const row of rows) {
    if (
      !shouldReclassifyAsNonContribution({
        type: row.type,
        name: row.name,
        securityId: row.securityId,
        quantity: row.quantity,
        price: row.price,
        amount: row.amount,
      })
    ) {
      continue;
    }
    await db
      .update(investmentTransactions)
      .set({ type: "fee" })
      .where(eq(investmentTransactions.id, row.id));
    repaired += 1;
  }
  return repaired;
}

export async function buildInvestmentHistorySummary(
  userIds: string[],
  lookbackYears = 3,
): Promise<InvestmentHistorySummary | null> {
  await repairNonContributionInvestmentTxns(userIds);

  const since = monthsAgo(lookbackYears * 12);
  const deployRows = await fetchInvestmentTxRows(userIds, since, [
    "buy",
    "contribution",
  ]);
  let totalContributed = 0;
  let buyTransactionCount = 0;
  let contributionCount = 0;
  for (const row of deployRows) {
    const impact = cashImpactForInvestmentTx(row);
    if (impact <= 0) continue;
    totalContributed += impact;
    if (row.type === "buy") buyTransactionCount += 1;
    else contributionCount += 1;
  }
  if (totalContributed <= 0) return null;

  const db = getDb();

  const holdingRows = await db
    .select({
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      institutionValue: holdings.institutionValue,
      ticker: securities.ticker,
      assetType: securities.assetType,
      currentPrice: securities.currentPrice,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.securityId, securities.id))
    .where(inArray(holdings.userId, userIds));

  let portfolioValue = 0;
  let totalCost = 0;
  for (const row of holdingRows) {
    const mv = holdingMarketValue({
      quantity: row.quantity,
      costBasis: row.costBasis,
      institutionValue: row.institutionValue,
      currentPrice: row.currentPrice,
      assetType: row.assetType,
      ticker: row.ticker,
    });
    portfolioValue += mv.value;
    totalCost += mv.cost;
  }

  const unrealizedGain = portfolioValue - totalCost;

  return {
    lookbackYears,
    totalContributed: formatMoneyAmount(totalContributed),
    currentPortfolioValue: formatMoneyAmount(portfolioValue),
    totalCostBasis: formatMoneyAmount(totalCost),
    unrealizedGain: formatMoneyAmount(unrealizedGain),
    monthlyAverageInvest: formatMoneyAmount(
      totalContributed / (lookbackYears * 12),
    ),
    transactionCount: buyTransactionCount + contributionCount,
    buyTransactionCount,
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
    const split = splitBalanceForNetWorth(a.type, bal);
    assets += split.assets;
    liabilities += split.liabilities;
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
      ageUserSet: fireProfiles.ageUserSet,
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
    currentAge: existing?.currentAge ?? DEFAULT_FIRE_AGE,
    isDefaultAge: !existing?.ageUserSet,
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
      ageUserSet: false,
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
