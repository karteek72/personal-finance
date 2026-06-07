import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  holdings,
  netWorthSnapshots,
  securities,
} from "../db/schema.js";
import { formatMoneyAmount, roundPercent } from "../lib/money.js";
import {
  paginateInMemory,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import {
  buildInvestmentBehavioralAlerts,
  buildInvestmentHistorySummary,
  buildInvestmentMonthlyActivity,
} from "./investment-analytics.js";
import {
  aggregateStockPositions,
  buildPortfolioBreakdown,
  mapHoldingRow,
  type InvestmentPosition,
  type PortfolioBreakdown,
  type StockAggregate,
} from "./holdings-mapper.js";
import { resolveHouseholdContext } from "./household-access.js";
import { getNetWorthTrendFromBalanceSnapshots } from "./balance-snapshots.js";
import { splitBalanceForNetWorth } from "../config/account-types.js";

export type {
  InvestmentPosition,
  PortfolioBreakdown,
  StockAggregate,
  StockAggregateLot,
} from "./holdings-mapper.js";

/** @deprecated Use InvestmentPosition — kept for backward compatibility */
export interface InvestmentHolding {
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
  quantity: number;
  costBasis: string;
  currentPrice: string;
  value: string;
  gainLoss: string;
  gainLossPercent: number;
  underlyingTicker?: string | null;
  optionType?: string | null;
  expirationLabel?: string | null;
}

export const HOLDING_SORTABLE = [
  "ticker",
  "name",
  "value",
  "gainLoss",
  "gainLossPercent",
  "costBasis",
] as const;

export interface InvestmentsResponse {
  portfolioValue: string;
  totalCostBasis: string;
  totalGainLoss: string;
  totalGainLossPercent: number;
  accounts: Array<{
    accountId: string;
    name: string;
    institutionName: string;
    subtype: string | null;
    value: string;
  }>;
  /** Per-account positions (stocks and options) */
  positions: Page<InvestmentPosition>;
  /** Stocks/ETFs/mutual funds rolled up by ticker across accounts */
  stockAggregates: StockAggregate[];
  /** All option positions (each contract series is its own row) */
  optionPositions: InvestmentPosition[];
  portfolioBreakdown: PortfolioBreakdown;
  /** Flat list without account context — same as positions minus account fields */
  holdings: Page<InvestmentHolding>;
  behavioralAlerts: Array<{ type: string; title: string; desc: string }>;
  investmentHistory: {
    lookbackYears: number;
    totalContributed: string;
    currentPortfolioValue: string;
    totalCostBasis: string;
    unrealizedGain: string;
    monthlyAverageInvest: string;
    transactionCount: number;
    buyTransactionCount: number;
  } | null;
  monthlyActivity: {
    cashContributions: string;
    purchaseDeployments: string;
    totalDeployed: string;
  } | null;
}

function toLegacyHolding(position: InvestmentPosition): InvestmentHolding {
  return {
    ticker: position.ticker,
    name: position.name,
    sector: position.sector,
    assetType: position.assetType,
    quantity: position.quantity,
    costBasis: position.costBasis,
    currentPrice: position.currentPrice,
    value: position.value,
    gainLoss: position.gainLoss,
    gainLossPercent: position.gainLossPercent,
    underlyingTicker: position.underlyingTicker,
    optionType: position.optionType,
    expirationLabel: position.expirationLabel,
  };
}

function holdingSortKey(
  column: string,
): (row: InvestmentPosition) => number | string {
  switch (column) {
    case "ticker":
      return (r) => r.ticker.toLowerCase();
    case "name":
      return (r) => r.name.toLowerCase();
    case "gainLoss":
      return (r) => Number.parseFloat(r.gainLoss);
    case "gainLossPercent":
      return (r) => r.gainLossPercent;
    case "costBasis":
      return (r) => Number.parseFloat(r.costBasis);
    default:
      return (r) => Number.parseFloat(r.value);
  }
}

export async function getInvestments(
  userId: string,
  q: ParsedListQuery,
  accountId?: string,
): Promise<InvestmentsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const investmentAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.type, "investment"),
        eq(accounts.isActive, true),
      ),
    );

  const accountMeta = new Map(
    investmentAccounts.map((a) => [
      a.id,
      {
        name: a.name,
        institutionName: a.institutionName,
        mask: a.mask,
      },
    ]),
  );

  const holdingRows = await db
    .select({
      holdingId: holdings.id,
      accountId: holdings.accountId,
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      institutionValue: holdings.institutionValue,
      ticker: securities.ticker,
      name: securities.name,
      sector: securities.sector,
      assetType: securities.assetType,
      currentPrice: securities.currentPrice,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.securityId, securities.id))
    .where(inArray(holdings.userId, ctx.userIds));

  const positions: InvestmentPosition[] = holdingRows.map((row) => {
    const account = accountMeta.get(row.accountId);
    return mapHoldingRow({
      holdingId: row.holdingId,
      accountId: row.accountId,
      accountName: account?.name ?? "Investment account",
      institutionName: account?.institutionName ?? "",
      accountMask: account?.mask ?? null,
      quantity: row.quantity,
      costBasis: row.costBasis,
      institutionValue: row.institutionValue,
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      assetType: row.assetType,
      currentPrice: row.currentPrice,
    });
  });

  positions.sort(
    (a, b) => Number.parseFloat(b.value) - Number.parseFloat(a.value),
  );

  const scopedPositions = accountId
    ? positions.filter((p) => p.accountId === accountId)
    : positions;

  const positionsPage = paginateInMemory(scopedPositions, q, {
    sortKey: holdingSortKey,
    textFilter: (row, needle) =>
      row.ticker.toLowerCase().includes(needle) ||
      row.name.toLowerCase().includes(needle),
  });
  const holdingsPage: Page<InvestmentHolding> = {
    ...positionsPage,
    rows: positionsPage.rows.map(toLegacyHolding),
  };

  const optionPositions = scopedPositions.filter((p) => p.assetType === "option");
  const stockAggregates = aggregateStockPositions(scopedPositions);
  const portfolioBreakdown = buildPortfolioBreakdown(scopedPositions);

  let portfolioValue = scopedPositions.reduce(
    (sum, p) => sum + Number.parseFloat(p.value),
    0,
  );
  let totalCostBasis = scopedPositions.reduce(
    (sum, p) => sum + p.quantity * Number.parseFloat(p.costBasis),
    0,
  );

  const totalGainLoss = portfolioValue - totalCostBasis;
  const behavioralAlerts = await buildInvestmentBehavioralAlerts(ctx.userIds);
  const investmentHistory = await buildInvestmentHistorySummary(ctx.userIds);
  const monthlyActivity = await buildInvestmentMonthlyActivity(ctx.userIds);

  const accountBalanceTotal = investmentAccounts.reduce(
    (sum, account) => sum + Number.parseFloat(account.balanceCurrent ?? "0"),
    0,
  );
  const displayPortfolioValue =
    portfolioValue > 0 ? portfolioValue : accountBalanceTotal;

  return {
    portfolioValue: formatMoneyAmount(displayPortfolioValue),
    totalCostBasis: formatMoneyAmount(totalCostBasis),
    totalGainLoss: formatMoneyAmount(totalGainLoss),
    totalGainLossPercent:
      totalCostBasis > 0
        ? roundPercent((totalGainLoss / totalCostBasis) * 100)
        : 0,
    accounts: investmentAccounts.map((a) => ({
      accountId: a.id,
      name: a.name,
      institutionName: a.institutionName,
      subtype: a.subtype,
      value: formatMoneyAmount(a.balanceCurrent ?? "0"),
    })),
    positions: positionsPage,
    stockAggregates,
    optionPositions,
    portfolioBreakdown,
    holdings: holdingsPage,
    behavioralAlerts,
    investmentHistory,
    monthlyActivity,
  };
}

export interface NetWorthResponse {
  current: {
    netWorth: string;
    totalAssets: string;
    totalLiabilities: string;
    accountCount: number;
  };
  breakdown: {
    depository: { total: string; accountCount: number };
    investment: { total: string; accountCount: number };
    credit: { total: string; accountCount: number };
  };
  trend: Array<{ month: string; netWorth: string }>;
}

export async function getNetWorth(userId: string): Promise<NetWorthResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const accountRows = await db
    .select()
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.isActive, true),
      ),
    );

  let assets = 0;
  let liabilities = 0;
  let depositoryTotal = 0;
  let investmentTotal = 0;
  let creditTotal = 0;
  let depositoryCount = 0;
  let investmentCount = 0;
  let creditCount = 0;

  for (const a of accountRows) {
    const bal = Number.parseFloat(a.balanceCurrent ?? "0");
    if (a.type === "credit") {
      liabilities += bal;
      creditTotal += bal;
      creditCount += 1;
    } else {
      const split = splitBalanceForNetWorth(a.type, bal);
      assets += split.assets;
      liabilities += split.liabilities;
      if (a.type === "depository") {
        depositoryTotal += bal;
        depositoryCount += 1;
      } else if (a.type === "investment") {
        investmentTotal += bal;
        investmentCount += 1;
      }
    }
  }

  const trendFromSnapshots = await getNetWorthTrendFromBalanceSnapshots(
    ctx.userIds,
  );

  let trend = trendFromSnapshots;
  if (trend.length === 0) {
    const snapshots = await db
      .select({
        month: netWorthSnapshots.month,
        netWorth: netWorthSnapshots.netWorth,
      })
      .from(netWorthSnapshots)
      .where(inArray(netWorthSnapshots.userId, ctx.userIds));
    snapshots.sort((a, b) => (a.month < b.month ? -1 : 1));
    trend = snapshots.map((s) => ({
      month: s.month,
      netWorth: formatMoneyAmount(s.netWorth),
    }));
  }

  return {
    current: {
      netWorth: formatMoneyAmount(assets - liabilities),
      totalAssets: formatMoneyAmount(assets),
      totalLiabilities: formatMoneyAmount(liabilities),
      accountCount: accountRows.length,
    },
    breakdown: {
      depository: {
        total: formatMoneyAmount(depositoryTotal),
        accountCount: depositoryCount,
      },
      investment: {
        total: formatMoneyAmount(investmentTotal),
        accountCount: investmentCount,
      },
      credit: {
        total: formatMoneyAmount(creditTotal),
        accountCount: creditCount,
      },
    },
    trend,
  };
}
