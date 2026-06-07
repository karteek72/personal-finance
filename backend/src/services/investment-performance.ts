import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  holdingsSnapshots,
  investmentTransactions,
  securities,
  securityPrices,
  taxLots,
} from "../db/schema.js";
import { countMonthsInclusive } from "../lib/date-range.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  buildMetricEnvelope,
  type MetricEnvelope,
} from "./metrics/types.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  computeUnrealizedPl,
  replayFifoTaxLots,
  summarizeRealizedPl,
  type TaxLotTxnInput,
} from "./investment/fifo-tax-lots.js";
import { computeXirr, type XirrCashflow } from "./investment/xirr.js";
import {
  computeBenchmarkDelta,
  computeBenchmarkReturn,
  computeMaxDrawdown,
  computeTwr,
  type PortfolioDailyPoint,
} from "./investment/twr.js";

export interface InvestmentPerformanceResponse {
  from: string;
  to: string;
  asOf: string;
  unrealizedGain: MetricEnvelope;
  realizedGain: MetricEnvelope;
  shortTermGain: MetricEnvelope;
  longTermGain: MetricEnvelope;
  xirr: MetricEnvelope;
  twr: MetricEnvelope;
  maxDrawdown: MetricEnvelope;
  benchmarkDelta: MetricEnvelope;
  dividendTtmYield: MetricEnvelope;
  feeDrag: MetricEnvelope;
  cashDrag: MetricEnvelope;
  washSaleCount: number;
  dividendTrend: Array<{ month: string; amount: string }>;
  portfolioValue: string;
  confidence: number;
  caveats: string[];
}

const BENCHMARK_TICKERS = ["SPY", "VT"] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFromTo(from?: string, to?: string): { from: string; to: string } {
  const end = to ?? todayIso();
  if (from) return { from, to: end };
  const d = new Date(`${end}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return { from: d.toISOString().slice(0, 10), to: end };
}

function parseQuantity(value: string | null): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function parsePrice(value: string | null): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

async function fetchLotTxns(
  userIds: string[],
  accountId?: string,
): Promise<TaxLotTxnInput[]> {
  const db = getDb();
  const conditions = [
    inArray(investmentTransactions.userId, userIds),
    inArray(investmentTransactions.type, ["buy", "sell"]),
  ];
  if (accountId) {
    conditions.push(eq(investmentTransactions.accountId, accountId));
  }

  const rows = await db
    .select({
      id: investmentTransactions.id,
      accountId: investmentTransactions.accountId,
      securityId: investmentTransactions.securityId,
      date: investmentTransactions.date,
      type: investmentTransactions.type,
      quantity: investmentTransactions.quantity,
      price: investmentTransactions.price,
      amount: investmentTransactions.amount,
    })
    .from(investmentTransactions)
    .where(and(...conditions));

  const txns: TaxLotTxnInput[] = [];
  for (const row of rows) {
    if (!row.securityId) continue;
    txns.push({
      id: row.id,
      accountId: row.accountId,
      securityId: row.securityId,
      date: row.date,
      type: row.type === "sell" ? "sell" : "buy",
      quantity: parseQuantity(row.quantity),
      price: parsePrice(row.price),
      amount: parseAmount(row.amount),
    });
  }
  return txns;
}

async function persistOpenLots(
  userId: string,
  userIds: string[],
  openLots: ReturnType<typeof replayFifoTaxLots>["openLots"],
): Promise<void> {
  const db = getDb();
  await db.delete(taxLots).where(inArray(taxLots.userId, userIds));

  for (const lot of openLots) {
    await db.insert(taxLots).values({
      userId,
      accountId: lot.accountId,
      securityId: lot.securityId,
      openTxnId: lot.openTxnId ?? null,
      openDate: lot.openDate,
      quantityOpen: String(lot.quantityOpen),
      quantityRemaining: String(lot.quantityRemaining),
      costPerUnit: String(lot.costPerUnit),
    });
  }
}

async function loadCurrentPrices(
  securityIds: string[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (securityIds.length === 0) return prices;

  const db = getDb();
  const rows = await db
    .select({ id: securities.id, currentPrice: securities.currentPrice })
    .from(securities)
    .where(inArray(securities.id, securityIds));

  for (const row of rows) {
    const price = Number.parseFloat(row.currentPrice);
    if (Number.isFinite(price) && price > 0) {
      prices.set(row.id, price);
    }
  }
  return prices;
}

async function loadPortfolioDaily(
  userIds: string[],
  from: string,
  to: string,
  accountId?: string,
): Promise<PortfolioDailyPoint[]> {
  const db = getDb();
  const conditions = [
    inArray(holdingsSnapshots.userId, userIds),
    gte(holdingsSnapshots.asOfDate, from),
    lte(holdingsSnapshots.asOfDate, to),
  ];
  if (accountId) {
    conditions.push(eq(holdingsSnapshots.accountId, accountId));
  }

  const rows = await db
    .select({
      date: holdingsSnapshots.asOfDate,
      value: sql<string>`sum(${holdingsSnapshots.marketValue}::numeric)`,
      cost: sql<string>`sum(${holdingsSnapshots.costBasisTotal}::numeric)`,
    })
    .from(holdingsSnapshots)
    .where(and(...conditions))
    .groupBy(holdingsSnapshots.asOfDate)
    .orderBy(holdingsSnapshots.asOfDate);

  return rows.map((row) => ({
    date: row.date,
    value: Number.parseFloat(row.value ?? "0"),
    cost: Number.parseFloat(row.cost ?? "0"),
  }));
}

async function loadExternalCashFlows(
  userIds: string[],
  from: string,
  to: string,
  accountId?: string,
): Promise<Array<{ date: string; amount: number }>> {
  const db = getDb();
  const conditions = [
    inArray(investmentTransactions.userId, userIds),
    gte(investmentTransactions.date, from),
    lte(investmentTransactions.date, to),
    inArray(investmentTransactions.type, ["contribution", "buy", "sell", "dividend"]),
  ];
  if (accountId) {
    conditions.push(eq(investmentTransactions.accountId, accountId));
  }

  const rows = await db
    .select({
      date: investmentTransactions.date,
      type: investmentTransactions.type,
      amount: investmentTransactions.amount,
    })
    .from(investmentTransactions)
    .where(and(...conditions));

  const byDate = new Map<string, number>();
  for (const row of rows) {
    const amt = parseAmount(row.amount);
    let signed = 0;
    if (row.type === "contribution" || row.type === "buy") {
      signed = amt;
    } else if (row.type === "sell" || row.type === "dividend") {
      signed = -amt;
    }
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + signed);
  }

  return [...byDate.entries()].map(([date, amount]) => ({ date, amount }));
}

async function loadXirrCashflows(
  userIds: string[],
  from: string,
  to: string,
  terminalValue: number,
  accountId?: string,
): Promise<XirrCashflow[]> {
  const db = getDb();
  const conditions = [
    inArray(investmentTransactions.userId, userIds),
    gte(investmentTransactions.date, from),
    lte(investmentTransactions.date, to),
  ];
  if (accountId) {
    conditions.push(eq(investmentTransactions.accountId, accountId));
  }

  const rows = await db
    .select({
      date: investmentTransactions.date,
      type: investmentTransactions.type,
      amount: investmentTransactions.amount,
    })
    .from(investmentTransactions)
    .where(and(...conditions));

  const flows: XirrCashflow[] = [];
  for (const row of rows) {
    const amt = parseAmount(row.amount);
    if (row.type === "contribution" || row.type === "buy") {
      flows.push({ date: row.date, amount: -amt });
    } else if (row.type === "sell" || row.type === "dividend") {
      flows.push({ date: row.date, amount: amt });
    } else if (row.type === "fee") {
      flows.push({ date: row.date, amount: -amt });
    }
  }

  if (terminalValue > 0) {
    flows.push({ date: to, amount: terminalValue });
  }

  return flows.sort((a, b) => a.date.localeCompare(b.date));
}

async function loadDividendTrend(
  userIds: string[],
  from: string,
  to: string,
  accountId?: string,
): Promise<Array<{ month: string; amount: string }>> {
  const db = getDb();
  const conditions = [
    inArray(investmentTransactions.userId, userIds),
    eq(investmentTransactions.type, "dividend"),
    gte(investmentTransactions.date, from),
    lte(investmentTransactions.date, to),
  ];
  if (accountId) {
    conditions.push(eq(investmentTransactions.accountId, accountId));
  }

  const rows = await db
    .select({
      month: sql<string>`to_char(${investmentTransactions.date}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${investmentTransactions.amount}::numeric), 0)`,
    })
    .from(investmentTransactions)
    .where(and(...conditions))
    .groupBy(sql`to_char(${investmentTransactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${investmentTransactions.date}, 'YYYY-MM')`);

  return rows.map((row) => ({
    month: row.month,
    amount: formatMoneyAmount(Number.parseFloat(row.total ?? "0")),
  }));
}

async function sumDividendsTtm(
  userIds: string[],
  asOf: string,
  accountId?: string,
): Promise<number> {
  const d = new Date(`${asOf}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  const from = d.toISOString().slice(0, 10);

  const db = getDb();
  const conditions = [
    inArray(investmentTransactions.userId, userIds),
    eq(investmentTransactions.type, "dividend"),
    gte(investmentTransactions.date, from),
    lte(investmentTransactions.date, asOf),
  ];
  if (accountId) {
    conditions.push(eq(investmentTransactions.accountId, accountId));
  }

  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${investmentTransactions.amount}::numeric), 0)`,
    })
    .from(investmentTransactions)
    .where(and(...conditions));

  return Number.parseFloat(row?.total ?? "0");
}

async function sumFees(
  userIds: string[],
  from: string,
  to: string,
  accountId?: string,
): Promise<number> {
  const db = getDb();
  const conditions = [
    inArray(investmentTransactions.userId, userIds),
    gte(investmentTransactions.date, from),
    lte(investmentTransactions.date, to),
  ];
  if (accountId) {
    conditions.push(eq(investmentTransactions.accountId, accountId));
  }

  const rows = await db
    .select({
      fees: investmentTransactions.fees,
      amount: investmentTransactions.amount,
      type: investmentTransactions.type,
    })
    .from(investmentTransactions)
    .where(and(...conditions));

  let total = 0;
  for (const row of rows) {
    const feeCol = Number.parseFloat(row.fees ?? "0");
    if (Number.isFinite(feeCol) && feeCol > 0) {
      total += feeCol;
    } else if (row.type === "fee") {
      total += parseAmount(row.amount);
    }
  }
  return total;
}

async function loadBenchmarkPrices(
  from: string,
  to: string,
): Promise<{ ticker: string; prices: Array<{ date: string; close: number }> } | null> {
  const db = getDb();

  for (const ticker of BENCHMARK_TICKERS) {
    const [sec] = await db
      .select({ id: securities.id })
      .from(securities)
      .where(eq(securities.ticker, ticker))
      .limit(1);
    if (!sec) continue;

    const rows = await db
      .select({
        date: securityPrices.asOfDate,
        close: securityPrices.closePrice,
      })
      .from(securityPrices)
      .where(
        and(
          eq(securityPrices.securityId, sec.id),
          gte(securityPrices.asOfDate, from),
          lte(securityPrices.asOfDate, to),
        ),
      )
      .orderBy(securityPrices.asOfDate);

    if (rows.length >= 2) {
      return {
        ticker,
        prices: rows.map((r) => ({
          date: r.date,
          close: Number.parseFloat(r.close),
        })),
      };
    }
  }
  return null;
}

async function estimateCashDrag(
  userIds: string[],
  portfolioValue: number,
  benchmarkReturn: number | null,
): Promise<{ drag: number; idleCash: number }> {
  const db = getDb();
  const rows = await db
    .select({
      balanceCurrent: accounts.balanceCurrent,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(inArray(accounts.userId, userIds), eq(accounts.type, "investment"), eq(accounts.isActive, true)),
    );

  let accountBalance = 0;
  for (const row of rows) {
    accountBalance += Number.parseFloat(row.balanceCurrent ?? "0");
  }

  const idleCash = Math.max(0, accountBalance - portfolioValue);
  const bench = benchmarkReturn ?? 0.08;
  const drag =
    portfolioValue + idleCash > 0
      ? (idleCash / (portfolioValue + idleCash)) * bench
      : 0;

  return { drag, idleCash };
}

function usdMetric(
  value: number,
  asOf: string,
  classType: MetricEnvelope["class"],
  confidence: number,
  caveats?: string[],
): MetricEnvelope {
  return buildMetricEnvelope({
    value,
    unit: "USD",
    grain: "period",
    asOf,
    class: classType,
    basis: "factual",
    confidence,
    caveats,
  });
}

function percentMetric(
  value: number,
  asOf: string,
  classType: MetricEnvelope["class"],
  basis: MetricEnvelope["basis"],
  confidence: number,
  caveats?: string[],
): MetricEnvelope {
  return buildMetricEnvelope({
    value,
    unit: "percent",
    grain: "period",
    asOf,
    class: classType,
    basis,
    confidence,
    caveats,
  });
}

export async function getInvestmentPerformance(
  userId: string,
  from?: string,
  to?: string,
  accountId?: string,
): Promise<InvestmentPerformanceResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const period = defaultFromTo(from, to);
  const caveats: string[] = [];
  let confidence = 1;

  const txns = await fetchLotTxns(ctx.userIds, accountId);
  if (txns.length === 0 && !accountId) {
    return null;
  }

  const { openLots, realizedSales } = replayFifoTaxLots(txns);
  await persistOpenLots(userId, ctx.userIds, openLots);

  const securityIds = [...new Set(openLots.map((l) => l.securityId))];
  const prices = await loadCurrentPrices(securityIds);
  const unrealized = computeUnrealizedPl(openLots, prices);
  const realized = summarizeRealizedPl(
    realizedSales,
    period.from,
    period.to,
  );

  const portfolioDaily = await loadPortfolioDaily(
    ctx.userIds,
    period.from,
    period.to,
    accountId,
  );
  const latestValue =
    portfolioDaily.at(-1)?.value ?? unrealized.totalMarketValue;
  const months = countMonthsInclusive(period.from, period.to);

  if (portfolioDaily.length < 2) {
    caveats.push("Insufficient daily snapshots for TWR and drawdown");
    confidence = Math.min(confidence, 0.5);
  }

  const cashFlows = await loadExternalCashFlows(
    ctx.userIds,
    period.from,
    period.to,
    accountId,
  );
  const twrResult = computeTwr(portfolioDaily, cashFlows);
  const drawdown = computeMaxDrawdown(portfolioDaily);

  const xirrFlows = await loadXirrCashflows(
    ctx.userIds,
    period.from,
    period.to,
    latestValue,
    accountId,
  );
  const xirrValue = computeXirr(xirrFlows);
  if (xirrValue == null) {
    caveats.push("XIRR could not be computed from available cashflows");
    confidence = Math.min(confidence, 0.6);
  }

  const totalFees = await sumFees(
    ctx.userIds,
    period.from,
    period.to,
    accountId,
  );
  const avgPortfolio =
    portfolioDaily.length > 0
      ? portfolioDaily.reduce((s, p) => s + p.value, 0) / portfolioDaily.length
      : latestValue;
  const feeDrag =
    avgPortfolio > 0 ? (totalFees / avgPortfolio) * (12 / Math.max(months, 1)) : 0;

  const dividendTtm = await sumDividendsTtm(
    ctx.userIds,
    period.to,
    accountId,
  );
  const dividendTtmYield =
    latestValue > 0 ? dividendTtm / latestValue : 0;
  const dividendTrend = await loadDividendTrend(
    ctx.userIds,
    period.from,
    period.to,
    accountId,
  );

  const benchmark = await loadBenchmarkPrices(period.from, period.to);
  let benchmarkReturn: number | null = null;
  let benchmarkTicker: string | null = null;
  if (benchmark) {
    benchmarkReturn = computeBenchmarkReturn(
      benchmark.prices,
      period.from,
      period.to,
    );
    benchmarkTicker = benchmark.ticker;
  } else {
    caveats.push("Benchmark index prices unavailable; benchmark delta omitted");
    confidence = Math.min(confidence, 0.7);
  }

  const { drag: cashDrag, idleCash } = await estimateCashDrag(
    ctx.userIds,
    latestValue,
    benchmarkReturn,
  );
  if (idleCash > 0) {
    caveats.push(
      `Idle cash ${formatMoneyAmount(idleCash)} not fully invested; cash drag is estimated`,
    );
  }

  const twrValue = twrResult?.twr ?? 0;
  const benchmarkDelta =
    benchmarkReturn != null
      ? computeBenchmarkDelta(twrValue, benchmarkReturn)
      : 0;

  return {
    from: period.from,
    to: period.to,
    asOf: period.to,
    portfolioValue: formatMoneyAmount(latestValue),
    unrealizedGain: usdMetric(
      unrealized.totalUnrealizedGain,
      period.to,
      "descriptive",
      confidence,
    ),
    realizedGain: usdMetric(
      realized.totalGainLoss,
      period.to,
      "descriptive",
      confidence,
    ),
    shortTermGain: usdMetric(
      realized.shortTermGain,
      period.to,
      "descriptive",
      confidence,
    ),
    longTermGain: usdMetric(
      realized.longTermGain,
      period.to,
      "descriptive",
      confidence,
    ),
    xirr: percentMetric(
      xirrValue ?? 0,
      period.to,
      "diagnostic",
      "factual",
      xirrValue != null ? confidence : 0.4,
      xirrValue == null ? ["XIRR unavailable"] : undefined,
    ),
    twr: percentMetric(
      twrValue,
      period.to,
      "diagnostic",
      "factual",
      twrResult != null ? confidence : 0.4,
      twrResult == null ? ["TWR requires daily snapshots"] : undefined,
    ),
    maxDrawdown: percentMetric(
      drawdown?.maxDrawdown ?? 0,
      period.to,
      "diagnostic",
      "factual",
      drawdown != null ? confidence : 0.4,
      drawdown == null ? ["Drawdown requires daily snapshots"] : undefined,
    ),
    benchmarkDelta: percentMetric(
      benchmarkDelta,
      period.to,
      "diagnostic",
      "external",
      benchmarkReturn != null ? 0.85 : 0.3,
      benchmarkTicker
        ? [`Benchmark: ${benchmarkTicker} buy-and-hold return`]
        : ["No benchmark price series loaded"],
    ),
    dividendTtmYield: percentMetric(
      dividendTtmYield,
      period.to,
      "descriptive",
      "factual",
      confidence,
    ),
    feeDrag: percentMetric(
      feeDrag,
      period.to,
      "diagnostic",
      "factual",
      confidence,
    ),
    cashDrag: percentMetric(
      cashDrag,
      period.to,
      "diagnostic",
      "heuristic",
      idleCash > 0 ? 0.65 : 0.9,
      ["Cash drag assumes idle brokerage cash earns 0% vs benchmark"],
    ),
    washSaleCount: realized.washSaleCount,
    dividendTrend,
    confidence: roundDecimal(confidence, 2),
    caveats,
  };
}
