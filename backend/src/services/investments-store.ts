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
} from "./investment-analytics.js";
import { resolveHouseholdContext } from "./household-access.js";

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
  holdings: InvestmentHolding[];
  behavioralAlerts: Array<{ type: string; title: string; desc: string }>;
  investmentHistory: {
    lookbackYears: number;
    totalContributed: string;
    estimatedValueToday: string;
    monthlyAverageInvest: string;
    transactionCount: number;
  } | null;
}

function holdingMarketValue(input: {
  quantity: string;
  costBasis: string;
  institutionValue: string | null;
  currentPrice: string;
}): { value: number; unitPrice: number; cost: number } {
  const qty = Number.parseFloat(input.quantity);
  const basis = Number.parseFloat(input.costBasis);
  const cost = qty * basis;

  const institution = Number.parseFloat(input.institutionValue ?? "0");
  if (institution > 0) {
    const unitPrice = qty > 0 ? institution / qty : basis;
    return { value: institution, unitPrice, cost };
  }

  const price = Number.parseFloat(input.currentPrice);
  if (price > 0) {
    return { value: qty * price, unitPrice: price, cost };
  }

  return { value: cost, unitPrice: basis, cost };
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

  const holdingRows = await db
    .select({
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

  let portfolioValue = 0;
  let totalCostBasis = 0;
  const mapped: InvestmentHolding[] = holdingRows.map((row) => {
    const qty = Number.parseFloat(row.quantity);
    const { value, unitPrice, cost } = holdingMarketValue({
      quantity: row.quantity,
      costBasis: row.costBasis,
      institutionValue: row.institutionValue,
      currentPrice: row.currentPrice,
    });
    portfolioValue += value;
    totalCostBasis += cost;
    return {
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      assetType: row.assetType,
      quantity: qty,
      costBasis: formatMoneyAmount(Number.parseFloat(row.costBasis)),
      currentPrice: formatMoneyAmount(unitPrice),
      value: formatMoneyAmount(value),
      gainLoss: formatMoneyAmount(value - cost),
      gainLossPercent: cost > 0 ? roundPercent(((value - cost) / cost) * 100) : 0,
    };
  });
  mapped.sort((a, b) => Number.parseFloat(b.value) - Number.parseFloat(a.value));

  const totalGainLoss = portfolioValue - totalCostBasis;
  const behavioralAlerts = await buildInvestmentBehavioralAlerts(ctx.userIds);
  const investmentHistory = await buildInvestmentHistorySummary(ctx.userIds);

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
    holdings: mapped,
    behavioralAlerts,
    investmentHistory,
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
