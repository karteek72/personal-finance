import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  holdingsSnapshots,
  investmentTransactions,
  securities,
  securityPrices,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  buildMetricEnvelope,
  type MetricEnvelope,
} from "./metrics/types.js";
import { replayFifoTaxLots, type TaxLotTxnInput } from "./investment/fifo-tax-lots.js";
import { computeMaxDrawdown } from "./investment/twr.js";

export interface BehaviorEvidence {
  tradeIds: string[];
  summary: string;
}

export interface BehaviorSignal {
  id: string;
  label: string;
  detected: boolean;
  basis: "heuristic";
  confidence: number;
  severity: "warning" | "info" | "positive";
  evidence: BehaviorEvidence;
  caveats: string[];
  metric?: MetricEnvelope;
}

export interface InvestmentBehaviorResponse {
  asOf: string;
  signals: BehaviorSignal[];
  isLive: boolean;
  disclaimer: string;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function fetchTradeTxns(userIds: string[], since: string): Promise<TaxLotTxnInput[]> {
  const db = getDb();
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
      ticker: securities.ticker,
    })
    .from(investmentTransactions)
    .leftJoin(securities, eq(investmentTransactions.securityId, securities.id))
    .where(
      and(
        inArray(investmentTransactions.userId, userIds),
        gte(investmentTransactions.date, since),
        inArray(investmentTransactions.type, ["buy", "sell"]),
      ),
    )
    .orderBy(investmentTransactions.date);

  return rows
    .filter((r) => r.securityId)
    .map((r) => ({
      id: r.id,
      accountId: r.accountId,
      securityId: r.securityId!,
      date: r.date,
      type: r.type as "buy" | "sell",
      quantity: Number.parseFloat(r.quantity ?? "0"),
      price: Number.parseFloat(r.price ?? "0"),
      amount: Number.parseFloat(r.amount),
    }));
}

function detectOvertrading(
  txns: TaxLotTxnInput[],
  portfolioValue: number,
): BehaviorSignal {
  const tradeCount = txns.length;
  const turnover =
    portfolioValue > 0
      ? txns.reduce((s, t) => s + Math.abs(t.amount), 0) / (2 * portfolioValue)
      : 0;
  const detected = tradeCount >= 12 && turnover >= 0.5;
  const tradeIds = txns.slice(-10).map((t) => t.id);

  return {
    id: "overtrading",
    label: "Overtrading (high turnover)",
    detected,
    basis: "heuristic",
    confidence: detected ? Math.min(0.85, 0.5 + turnover) : 0.4,
    severity: detected ? "warning" : "info",
    evidence: {
      tradeIds,
      summary: `${tradeCount} trades in 90d; estimated turnover ${roundDecimal(turnover * 100)}%`,
    },
    caveats: [
      "Turnover heuristic uses trade notional vs portfolio value; options/leverage not fully modeled",
    ],
    metric: buildMetricEnvelope({
      value: turnover,
      unit: "ratio",
      asOf: new Date().toISOString().slice(0, 10),
      class: "diagnostic",
      basis: "heuristic",
      confidence: 0.6,
    }),
  };
}

async function detectPerformanceChasing(
  userIds: string[],
  txns: TaxLotTxnInput[],
): Promise<BehaviorSignal> {
  const db = getDb();
  const buys = txns.filter((t) => t.type === "buy");
  const chasingIds: string[] = [];

  for (const buy of buys) {
    const priorRows = await db
      .select({ close: securityPrices.closePrice })
      .from(securityPrices)
      .where(
        and(
          eq(securityPrices.securityId, buy.securityId),
          lte(securityPrices.asOfDate, buy.date),
        ),
      )
      .orderBy(sql`${securityPrices.asOfDate} desc`)
      .limit(30);

    if (priorRows.length < 5) continue;
    const prices = priorRows
      .map((r) => Number.parseFloat(r.close ?? "0"))
      .reverse();
    const early = prices.slice(0, Math.floor(prices.length / 2));
    const late = prices.slice(Math.floor(prices.length / 2));
    const earlyAvg = early.reduce((s, p) => s + p, 0) / early.length;
    const lateAvg = late.reduce((s, p) => s + p, 0) / late.length;
    if (earlyAvg > 0 && lateAvg / earlyAvg >= 1.08) {
      chasingIds.push(buy.id);
    }
  }

  const detected = chasingIds.length >= 2;
  return {
    id: "performance_chasing",
    label: "Performance chasing",
    detected,
    basis: "heuristic",
    confidence: detected ? 0.65 : 0.35,
    severity: detected ? "warning" : "info",
    evidence: {
      tradeIds: chasingIds,
      summary: detected
        ? `${chasingIds.length} buys followed ~8%+ price run-ups`
        : "No clear chase pattern in recent buys",
    },
    caveats: ["Requires price history; pattern inference only"],
  };
}

async function detectPanicSelling(
  userIds: string[],
  txns: TaxLotTxnInput[],
): Promise<BehaviorSignal> {
  const db = getDb();
  const sells = txns.filter((t) => t.type === "sell");
  const panicIds: string[] = [];

  const snapshotRows = await db
    .select({
      date: holdingsSnapshots.asOfDate,
      value: sql<string>`sum(market_value::numeric)::text`,
    })
    .from(holdingsSnapshots)
    .where(inArray(holdingsSnapshots.userId, userIds))
    .groupBy(holdingsSnapshots.asOfDate)
    .orderBy(holdingsSnapshots.asOfDate);

  const points = snapshotRows.map((r) => ({
    date: r.date,
    value: Number.parseFloat(r.value ?? "0"),
  }));

  if (points.length >= 5) {
    const drawdownResult = computeMaxDrawdown(points);
    const inDrawdown = drawdownResult != null && drawdownResult.maxDrawdown < -0.08;
    if (inDrawdown) {
      for (const sell of sells) {
        const sellDate = sell.date;
        const nearby = points.filter(
          (p) => Math.abs(Date.parse(p.date) - Date.parse(sellDate)) < 14 * 86_400_000,
        );
        if (nearby.length > 0) panicIds.push(sell.id);
      }
    }
  }

  const detected = panicIds.length >= 1;
  return {
    id: "panic_selling",
    label: "Panic selling during drawdown",
    detected,
    basis: "heuristic",
    confidence: detected ? 0.6 : 0.3,
    severity: detected ? "warning" : "info",
    evidence: {
      tradeIds: panicIds,
      summary: detected
        ? `${panicIds.length} sell(s) during portfolio drawdown window`
        : "No sells flagged during recent drawdowns",
    },
    caveats: ["Drawdown detection requires daily holdings snapshots"],
  };
}

function detectBuyHighSellLow(txns: TaxLotTxnInput[]): BehaviorSignal {
  const buys = txns.filter((t) => t.type === "buy");
  const sells = txns.filter((t) => t.type === "sell");
  const buyAvg =
    buys.length > 0
      ? buys.reduce((s, t) => s + (t.price > 0 ? t.price : Math.abs(t.amount) / Math.abs(t.quantity)), 0) /
        buys.length
      : 0;
  const sellAvg =
    sells.length > 0
      ? sells.reduce((s, t) => s + (t.price > 0 ? t.price : Math.abs(t.amount) / Math.abs(t.quantity)), 0) /
        sells.length
      : 0;

  const detected = buyAvg > 0 && sellAvg > 0 && buyAvg > sellAvg * 1.05;
  const tradeIds = [...buys, ...sells].slice(-8).map((t) => t.id);

  return {
    id: "buy_high_sell_low",
    label: "Buy-high / sell-low pattern",
    detected,
    basis: "heuristic",
    confidence: detected ? 0.55 : 0.3,
    severity: detected ? "warning" : "info",
    evidence: {
      tradeIds,
      summary: detected
        ? `Avg buy ${formatMoneyAmount(buyAvg)} vs avg sell ${formatMoneyAmount(sellAvg)}`
        : "No aggregate buy-high/sell-low gap detected",
    },
    caveats: ["Aggregates across securities; not security-level pairing"],
  };
}

function detectTaxInefficiency(txns: TaxLotTxnInput[]): BehaviorSignal {
  const { realizedSales } = replayFifoTaxLots(txns);
  const shortTerm = realizedSales.filter((s) => s.shortTermGain > 0);
  const wash = realizedSales.filter((s) => s.washSale);
  const detected = shortTerm.length >= 2 || wash.length >= 1;
  const tradeIds = [
    ...shortTerm.map((s) => s.txnId),
    ...wash.map((s) => s.txnId),
  ];

  return {
    id: "tax_inefficiency",
    label: "Tax inefficiency (short-term gains / wash sales)",
    detected,
    basis: "heuristic",
    confidence: detected ? 0.7 : 0.35,
    severity: detected ? "info" : "info",
    evidence: {
      tradeIds,
      summary: detected
        ? `${shortTerm.length} short-term gain event(s); ${wash.length} wash-sale flag(s)`
        : "No material short-term gain or wash-sale flags",
    },
    caveats: ["Tax lot matching is FIFO heuristic; consult a tax professional"],
  };
}

export async function getInvestmentBehavior(
  userId: string,
): Promise<InvestmentBehaviorResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const since90 = monthsAgo(3);
  const txns = await fetchTradeTxns(ctx.userIds, since90);

  const db = getDb();
  const [portfolioRow] = await db.execute<{ value: string }>(sql`
    SELECT coalesce(sum(market_value::numeric), 0)::text AS value
    FROM holdings_snapshots
    WHERE user_id IN (${sql.join(ctx.userIds.map((id) => sql`${id}`), sql`, `)})
      AND as_of_date = (
        SELECT max(h2.as_of_date) FROM holdings_snapshots h2
        WHERE h2.user_id = holdings_snapshots.user_id
      )
  `);
  const portfolioValue = Number.parseFloat(portfolioRow?.value ?? "0");

  const signals: BehaviorSignal[] = [
    detectOvertrading(txns, portfolioValue),
    await detectPerformanceChasing(ctx.userIds, txns),
    await detectPanicSelling(ctx.userIds, txns),
    detectBuyHighSellLow(txns),
    detectTaxInefficiency(txns),
  ];

  return {
    asOf: new Date().toISOString().slice(0, 10),
    signals,
    isLive: true,
    disclaimer:
      "All behavioral signals are heuristic inferences with confidence scores — not facts about intent.",
  };
}
