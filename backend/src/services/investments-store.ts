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
  positions: InvestmentPosition[];
  /** Stocks/ETFs/mutual funds rolled up by ticker across accounts */
  stockAggregates: StockAggregate[];
  /** All option positions (each contract series is its own row) */
  optionPositions: InvestmentPosition[];
  portfolioBreakdown: PortfolioBreakdown;
  /** Flat list without account context — same as positions minus account fields */
  holdings: InvestmentHolding[];
  behavioralAlerts: Array<{ type: string; title: string; desc: string }>;
  investmentHistory: {
    lookbackYears: number;
    totalContributed: string;
    estimatedValueToday: string;
    currentPortfolioValue: string;
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

export async function getInvestments(
  userId: string,
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

  const optionPositions = positions.filter((p) => p.assetType === "option");
  const stockAggregates = aggregateStockPositions(positions);
  const portfolioBreakdown = buildPortfolioBreakdown(positions);

  let portfolioValue = positions.reduce(
    (sum, p) => sum + Number.parseFloat(p.value),
    0,
  );
  let totalCostBasis = positions.reduce(
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
    positions,
    stockAggregates,
    optionPositions,
    portfolioBreakdown,
    holdings: positions.map(toLegacyHolding),
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
  for (const a of accountRows) {
    const bal = Number.parseFloat(a.balanceCurrent ?? "0");
    if (a.type === "credit") {
      liabilities += bal;
    } else {
      assets += bal;
    }
  }

  const snapshots = await db
    .select({
      month: netWorthSnapshots.month,
      netWorth: netWorthSnapshots.netWorth,
    })
    .from(netWorthSnapshots)
    .where(inArray(netWorthSnapshots.userId, ctx.userIds));
  snapshots.sort((a, b) => (a.month < b.month ? -1 : 1));

  return {
    current: {
      netWorth: formatMoneyAmount(assets - liabilities),
      totalAssets: formatMoneyAmount(assets),
      totalLiabilities: formatMoneyAmount(liabilities),
    },
    trend: snapshots.map((s) => ({
      month: s.month,
      netWorth: formatMoneyAmount(s.netWorth),
    })),
  };
}
