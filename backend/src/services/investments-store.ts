import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  holdings,
  netWorthSnapshots,
  securities,
} from "../db/schema.js";
import { formatMoneyAmount, roundPercent } from "../lib/money.js";
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
      ),
    );

  const holdingRows = await db
    .select({
      accountId: holdings.accountId,
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
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
    const price = Number.parseFloat(row.currentPrice);
    const basis = Number.parseFloat(row.costBasis);
    const value = qty * price;
    const cost = qty * basis;
    portfolioValue += value;
    totalCostBasis += cost;
    return {
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      assetType: row.assetType,
      quantity: qty,
      costBasis: formatMoneyAmount(basis),
      currentPrice: formatMoneyAmount(price),
      value: formatMoneyAmount(value),
      gainLoss: formatMoneyAmount(value - cost),
      gainLossPercent: cost > 0 ? roundPercent(((value - cost) / cost) * 100) : 0,
    };
  });
  mapped.sort((a, b) => Number.parseFloat(b.value) - Number.parseFloat(a.value));

  const totalGainLoss = portfolioValue - totalCostBasis;
  const topHolding = mapped[0];
  const behavioralAlerts: InvestmentsResponse["behavioralAlerts"] = [];
  if (topHolding && portfolioValue > 0) {
    const share = (Number.parseFloat(topHolding.value) / portfolioValue) * 100;
    if (share > 30) {
      behavioralAlerts.push({
        type: "warning",
        title: "Concentration risk",
        desc: `${topHolding.ticker} is ${Math.round(share)}% of your portfolio — consider diversifying.`,
      });
    }
  }
  behavioralAlerts.push({
    type: "info",
    title: "Dollar-cost averaging",
    desc: "Your recurring monthly buys keep lowering your average cost basis.",
  });

  return {
    portfolioValue: formatMoneyAmount(portfolioValue),
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
    .where(inArray(accounts.userId, ctx.userIds));

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
