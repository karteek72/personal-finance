import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  holdings,
  securities,
  securityPrices,
} from "../db/schema.js";
import { formatMoneyAmount, roundPercent } from "../lib/money.js";
import {
  mapHoldingRow,
  type InvestmentPosition,
} from "./holdings-mapper.js";
import { resolveHouseholdContext } from "./household-access.js";

export interface MomentumHolding {
  holdingId: string;
  ticker: string;
  name: string;
  value: string;
  gainLoss: string;
  gainLossPercent: number;
  momentumScore: number;
  momentumSignal: "improving" | "deteriorating" | "neutral";
  classification: "cut-candidate" | "hold-recover" | "winner" | "unscored";
}

export interface PruneLosersWhatIf {
  capitalFreed: string;
  realizedLoss: string;
  harvestableLoss: string;
  projectedUpliftLow: string;
  projectedUpliftHigh: string;
}

export interface PruneLosersResponse {
  available: boolean;
  confidence: number;
  caveats: string[];
  cutCandidates: MomentumHolding[];
  holdRecover: MomentumHolding[];
  whatIf: PruneLosersWhatIf | null;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function trailingReturn(
  prices: Array<{ asOfDate: string; closePrice: string }>,
  days: number,
): number | null {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) =>
    a.asOfDate < b.asOfDate ? -1 : 1,
  );
  const latest = sorted.at(-1)!;
  const targetDate = addDays(latest.asOfDate, -days);
  const anchor =
    [...sorted].reverse().find((p) => p.asOfDate <= targetDate) ??
    sorted[0];
  if (!anchor) return null;
  const end = Number.parseFloat(latest.closePrice);
  const start = Number.parseFloat(anchor.closePrice);
  if (!Number.isFinite(end) || !Number.isFinite(start) || start <= 0) {
    return null;
  }
  return ((end - start) / start) * 100;
}

function computeMomentumScore(
  prices: Array<{ asOfDate: string; closePrice: string }>,
): { score: number; signal: MomentumHolding["momentumSignal"] } | null {
  const r1 = trailingReturn(prices, 30);
  const r3 = trailingReturn(prices, 90);
  const r6 = trailingReturn(prices, 180);
  if (r1 == null && r3 == null && r6 == null) return null;

  const parts = [r1, r3, r6].filter((v): v is number => v != null);
  const score = parts.reduce((sum, v) => sum + v, 0) / parts.length;

  const sorted = [...prices].sort((a, b) =>
    a.asOfDate < b.asOfDate ? -1 : 1,
  );
  const closes = sorted
    .slice(-50)
    .map((p) => Number.parseFloat(p.closePrice))
    .filter((v) => Number.isFinite(v));
  const shortMa =
    closes.length >= 5
      ? closes.slice(-10).reduce((s, v) => s + v, 0) /
        Math.min(10, closes.slice(-10).length)
      : null;
  const longMa =
    closes.length >= 20
      ? closes.reduce((s, v) => s + v, 0) / closes.length
      : null;

  let signal: MomentumHolding["momentumSignal"] = "neutral";
  if (score > 2 || (shortMa != null && longMa != null && shortMa > longMa)) {
    signal = "improving";
  } else if (score < -2 || (shortMa != null && longMa != null && shortMa < longMa)) {
    signal = "deteriorating";
  }

  return { score: roundPercent(score), signal };
}

export async function getPruneLosersAnalysis(
  userId: string,
  accountId?: string,
): Promise<PruneLosersResponse> {
  const caveats = [
    "Educational what-if only — not investment advice.",
    "Momentum scores are backward-looking and not predictive.",
    "Tax-loss harvest estimate ignores wash-sale rules and full tax context.",
  ];
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const holdingRows = await db
    .select({
      holdingId: holdings.id,
      accountId: holdings.accountId,
      securityId: holdings.securityId,
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      institutionValue: holdings.institutionValue,
      ticker: securities.ticker,
      name: securities.name,
      sector: securities.sector,
      assetType: securities.assetType,
      currentPrice: securities.currentPrice,
      accountName: holdings.accountId,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.securityId, securities.id))
    .where(inArray(holdings.userId, ctx.userIds));

  let positions: InvestmentPosition[] = holdingRows.map((row) =>
    mapHoldingRow({
      holdingId: row.holdingId,
      accountId: row.accountId,
      accountName: "Investment account",
      institutionName: "",
      accountMask: null,
      quantity: row.quantity,
      costBasis: row.costBasis,
      institutionValue: row.institutionValue,
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      assetType: row.assetType,
      currentPrice: row.currentPrice,
    }),
  );

  if (accountId) {
    positions = positions.filter((p) => p.accountId === accountId);
  }

  const securityIds = [
    ...new Set(holdingRows.map((r) => r.securityId)),
  ];

  const priceRows =
    securityIds.length === 0
      ? []
      : await db
          .select({
            securityId: securityPrices.securityId,
            asOfDate: securityPrices.asOfDate,
            closePrice: securityPrices.closePrice,
          })
          .from(securityPrices)
          .where(inArray(securityPrices.securityId, securityIds))
          .orderBy(desc(securityPrices.asOfDate));

  const pricesBySecurity = new Map<
    string,
    Array<{ asOfDate: string; closePrice: string }>
  >();
  for (const row of priceRows) {
    const list = pricesBySecurity.get(row.securityId) ?? [];
    list.push({ asOfDate: row.asOfDate, closePrice: row.closePrice });
    pricesBySecurity.set(row.securityId, list);
  }

  const scored: MomentumHolding[] = [];
  let thinHistory = 0;

  for (const row of holdingRows) {
    if (accountId && row.accountId !== accountId) continue;
    const prices = pricesBySecurity.get(row.securityId) ?? [];
    if (prices.length < 10) {
      thinHistory += 1;
      continue;
    }
    const momentum = computeMomentumScore(prices);
    if (!momentum) continue;

    const position = positions.find((p) => p.holdingId === row.holdingId);
    if (!position) continue;

    const gainLoss = Number.parseFloat(position.gainLoss);
    let classification: MomentumHolding["classification"] = "unscored";
    if (gainLoss > 0) {
      classification = "winner";
    } else if (gainLoss < 0 && momentum.signal === "deteriorating") {
      classification = "cut-candidate";
    } else if (gainLoss < 0) {
      classification = "hold-recover";
    }

    scored.push({
      holdingId: position.holdingId,
      ticker: position.ticker,
      name: position.name,
      value: position.value,
      gainLoss: position.gainLoss,
      gainLossPercent: position.gainLossPercent,
      momentumScore: momentum.score,
      momentumSignal: momentum.signal,
      classification,
    });
  }

  if (thinHistory > 0) {
    caveats.push(
      `${thinHistory} holding${thinHistory === 1 ? "" : "s"} skipped — insufficient price history for momentum.`,
    );
  }

  const cutCandidates = scored
    .filter((s) => s.classification === "cut-candidate")
    .sort((a, b) => Number.parseFloat(a.gainLoss) - Number.parseFloat(b.gainLoss));

  const holdRecover = scored.filter((s) => s.classification === "hold-recover");

  if (scored.length === 0) {
    return {
      available: false,
      confidence: 0.2,
      caveats: [
        ...caveats,
        "Not enough price history to score momentum — sync brokerage and wait for daily snapshots.",
      ],
      cutCandidates: [],
      holdRecover: [],
      whatIf: null,
    };
  }

  const freed = cutCandidates.reduce(
    (sum, c) => sum + Number.parseFloat(c.value),
    0,
  );
  const realizedLoss = cutCandidates.reduce(
    (sum, c) => sum + Number.parseFloat(c.gainLoss),
    0,
  );

  const topMomentum = scored
    .filter((s) => s.momentumScore > 0)
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 3);
  const avgTopMomentum =
    topMomentum.length > 0
      ? topMomentum.reduce((s, t) => s + t.momentumScore, 0) /
        topMomentum.length
      : 5;
  const upliftLow = freed * (avgTopMomentum / 100) * 0.25;
  const upliftHigh = freed * (avgTopMomentum / 100) * 0.75;

  return {
    available: true,
    confidence: thinHistory === 0 ? 0.65 : 0.45,
    caveats,
    cutCandidates,
    holdRecover,
    whatIf: {
      capitalFreed: formatMoneyAmount(freed),
      realizedLoss: formatMoneyAmount(realizedLoss),
      harvestableLoss: formatMoneyAmount(Math.abs(realizedLoss)),
      projectedUpliftLow: formatMoneyAmount(upliftLow),
      projectedUpliftHigh: formatMoneyAmount(upliftHigh),
    },
  };
}
