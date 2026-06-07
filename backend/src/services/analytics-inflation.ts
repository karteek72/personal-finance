import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { computeSavingsRate, savingsRateMetric } from "./metrics/savings-rate.js";
import {
  buildMetricEnvelope,
  type MetricEnvelope,
} from "./metrics/types.js";
import {
  computePersonalCpi,
  NATIONAL_CPI_EXTERNAL,
  nominalToReal,
} from "./personal-cpi.js";
import { averageMonthlyIncome } from "./protect-analytics.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

export interface InflationAnalyticsResponse {
  asOf: string;
  personalCpi: MetricEnvelope;
  nationalCpi: MetricEnvelope;
  nominalSavingsRate: MetricEnvelope;
  realSavingsRate: MetricEnvelope;
  spendSeries: Array<{
    month: string;
    nominal: string;
    real: string;
  }>;
  basket: Array<{
    id: string;
    label: string;
    category: string;
    priceBase: string;
    priceNow: string;
    changePct: number;
    source: string;
  }>;
  isLive: boolean;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export async function getInflationAnalytics(
  userId: string,
): Promise<InflationAnalyticsResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  if (!hasActiveAccounts) return null;

  const asOf = new Date().toISOString().slice(0, 10);
  const cpi = await computePersonalCpi(ctx.userIds);
  const db = getDb();

  const since = monthsAgo(12);
  const monthlyRows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      expense: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false and ${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY} then ${transactions.amount}::numeric else 0 end), 0)`,
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}::numeric) else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(ctx.userIds, accountIds),
        eq(transactions.pending, false),
        gte(transactions.date, since),
      ),
    )
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

  const spendSeries = monthlyRows.map((row) => {
    const nominal = Number.parseFloat(row.expense ?? "0");
    const real = nominalToReal(nominal, cpi.personalRate);
    return {
      month: row.month,
      nominal: formatMoneyAmount(nominal),
      real: formatMoneyAmount(real),
    };
  });

  const latestMonth = monthlyRows.at(-1);
  const monthlyIncome = latestMonth
    ? Number.parseFloat(latestMonth.income ?? "0")
    : await averageMonthlyIncome(ctx.userIds, 1);
  const monthlyExpense = latestMonth
    ? Number.parseFloat(latestMonth.expense ?? "0")
    : 0;

  const nominalRate = computeSavingsRate({
    income: monthlyIncome,
    expense: monthlyExpense,
  });
  const realRate = nominalToReal(nominalRate, cpi.personalRate);

  return {
    asOf,
    personalCpi: buildMetricEnvelope({
      value: cpi.personalRate / 100,
      unit: "percent",
      asOf,
      class: "diagnostic",
      basis: "factual",
      confidence: cpi.confidence,
      caveats: cpi.caveats,
    }),
    nationalCpi: buildMetricEnvelope({
      value: NATIONAL_CPI_EXTERNAL.rate / 100,
      unit: "percent",
      asOf: NATIONAL_CPI_EXTERNAL.asOf,
      class: "descriptive",
      basis: "external",
      confidence: 0.5,
      caveats: [`Sourced from ${NATIONAL_CPI_EXTERNAL.source}; not personalized`],
    }),
    nominalSavingsRate: savingsRateMetric({
      income: monthlyIncome,
      expense: monthlyExpense,
      asOf,
      confidence: cpi.confidence,
    }),
    realSavingsRate: buildMetricEnvelope({
      value: realRate,
      unit: "percent",
      asOf,
      class: "diagnostic",
      basis: "factual",
      confidence: cpi.confidence * 0.9,
      caveats: ["Adjusted for measured personal CPI"],
    }),
    spendSeries,
    basket: cpi.basket.map((item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      priceBase: formatMoneyAmount(item.priceBase),
      priceNow: formatMoneyAmount(item.priceNow),
      changePct: roundDecimal(
        item.priceBase > 0 ? ((item.priceNow / item.priceBase - 1) * 100) : 0,
      ),
      source: item.source,
    })),
    isLive: true,
  };
}
