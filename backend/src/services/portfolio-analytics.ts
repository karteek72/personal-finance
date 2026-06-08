import { formatMoneyAmount, roundPercent } from "../lib/money.js";
import {
  isOptionAssetType,
  type InvestmentPosition,
} from "./holdings-mapper.js";
import { resolveGicsSector, buildPortfolioSectorHints } from "./security-sector.js";

export interface PortfolioSideSummary {
  count: number;
  value: string;
  sharePercent: number;
}

export interface PortfolioPerformer {
  ticker: string;
  name: string;
  gainLoss: string;
  gainLossPercent: number;
}

export interface PortfolioConcentration {
  largestPositionWeight: number;
  top5Weight: number;
  hhi: number;
}

export interface SectorAllocationRow {
  sector: string;
  value: string;
  sharePercent: number;
}

export interface GrossPlSplit {
  total: string;
  positionCount: number;
}

export interface PortfolioAnalytics {
  winners: PortfolioSideSummary;
  losers: PortfolioSideSummary;
  winRate: number;
  bestPerformer: PortfolioPerformer | null;
  worstPerformer: PortfolioPerformer | null;
  bestPerformerByDollar: PortfolioPerformer | null;
  worstPerformerByDollar: PortfolioPerformer | null;
  concentration: PortfolioConcentration;
  sectorAllocation: SectorAllocationRow[];
  unrealizedProfit: GrossPlSplit;
  unrealizedLoss: GrossPlSplit;
  costBasisCompleteness: {
    scored: number;
    total: number;
    percent: number;
  };
  caveats: string[];
}

function hasScorableCostBasis(position: InvestmentPosition): boolean {
  const cost = Number.parseFloat(position.costBasis);
  return Number.isFinite(cost) && cost > 0;
}

function positionValue(position: InvestmentPosition): number {
  return Number.parseFloat(position.value);
}

function positionGainLoss(position: InvestmentPosition): number {
  return Number.parseFloat(position.gainLoss);
}

export function computePortfolioAnalytics(
  positions: InvestmentPosition[],
  portfolioValue: number,
  dbSectors: ReadonlyMap<string, string> = new Map(),
  portfolioHints?: ReadonlyMap<string, string>,
): PortfolioAnalytics {
  const caveats: string[] = [];
  const scored = positions.filter(hasScorableCostBasis);
  const excluded = positions.length - scored.length;

  if (excluded > 0) {
    caveats.push(
      `${excluded} position${excluded === 1 ? "" : "s"} excluded from win/loss stats — missing cost basis.`,
    );
  }

  const winners = scored.filter((p) => positionGainLoss(p) > 0);
  const losers = scored.filter((p) => positionGainLoss(p) < 0);

  const winnersValue = winners.reduce((sum, p) => sum + positionValue(p), 0);
  const losersValue = losers.reduce((sum, p) => sum + positionValue(p), 0);
  const denom = portfolioValue > 0 ? portfolioValue : 1;

  const profitPositions = scored.filter((p) => positionGainLoss(p) > 0);
  const lossPositions = scored.filter((p) => positionGainLoss(p) < 0);
  const grossProfit = profitPositions.reduce(
    (sum, p) => sum + positionGainLoss(p),
    0,
  );
  const grossLoss = lossPositions.reduce(
    (sum, p) => sum + positionGainLoss(p),
    0,
  );

  const byPercent = [...scored].sort(
    (a, b) => b.gainLossPercent - a.gainLossPercent,
  );
  const byDollar = [...scored].sort(
    (a, b) => positionGainLoss(b) - positionGainLoss(a),
  );

  const weights = positions.map((p) => {
    const v = positionValue(p);
    return portfolioValue > 0 ? (v / portfolioValue) * 100 : 0;
  });
  const sortedWeights = [...weights].sort((a, b) => b - a);
  const top5Weight = sortedWeights
    .slice(0, 5)
    .reduce((sum, w) => sum + w, 0);
  const hhi =
    weights.reduce((sum, w) => sum + (w / 100) ** 2, 0) * 10_000;

  const sectorMap = new Map<string, number>();
  let unknownSectorCount = 0;
  const portfolioSectorHints =
    portfolioHints ??
    buildPortfolioSectorHints(positions, dbSectors);

  for (const position of positions) {
    const sector = resolveGicsSector(position, dbSectors, portfolioSectorHints);
    if (
      sector === "Unknown" ||
      sector === "Options (unknown sector)" ||
      sector === "Unclassified security"
    ) {
      unknownSectorCount += 1;
    }
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + positionValue(position));
  }
  const sectorAllocation = [...sectorMap.entries()]
    .map(([sector, value]) => ({
      sector,
      value: formatMoneyAmount(value),
      sharePercent: roundPercent((value / denom) * 100),
    }))
    .sort((a, b) => Number.parseFloat(b.value) - Number.parseFloat(a.value));

  if (unknownSectorCount > 0) {
    caveats.push(
      `${unknownSectorCount} position${unknownSectorCount === 1 ? "" : "s"} could not be mapped to a GICS sector — shown as Unknown or Options (unknown sector).`,
    );
  }

  const toPerformer = (p: InvestmentPosition): PortfolioPerformer => ({
    ticker: p.ticker,
    name: p.name,
    gainLoss: p.gainLoss,
    gainLossPercent: p.gainLossPercent,
  });

  return {
    winners: {
      count: winners.length,
      value: formatMoneyAmount(winnersValue),
      sharePercent: roundPercent((winnersValue / denom) * 100),
    },
    losers: {
      count: losers.length,
      value: formatMoneyAmount(losersValue),
      sharePercent: roundPercent((losersValue / denom) * 100),
    },
    winRate:
      scored.length > 0
        ? roundPercent((winners.length / scored.length) * 100)
        : 0,
    bestPerformer: byPercent[0] ? toPerformer(byPercent[0]) : null,
    worstPerformer: byPercent.length > 0 ? toPerformer(byPercent.at(-1)!) : null,
    bestPerformerByDollar: byDollar[0] ? toPerformer(byDollar[0]) : null,
    worstPerformerByDollar:
      byDollar.length > 0 ? toPerformer(byDollar.at(-1)!) : null,
    concentration: {
      largestPositionWeight: roundPercent(sortedWeights[0] ?? 0),
      top5Weight: roundPercent(top5Weight),
      hhi: roundPercent(hhi),
    },
    sectorAllocation,
    unrealizedProfit: {
      total: formatMoneyAmount(grossProfit),
      positionCount: profitPositions.length,
    },
    unrealizedLoss: {
      total: formatMoneyAmount(grossLoss),
      positionCount: lossPositions.length,
    },
    costBasisCompleteness: {
      scored: scored.length,
      total: positions.length,
      percent:
        positions.length > 0
          ? roundPercent((scored.length / positions.length) * 100)
          : 0,
    },
    caveats,
  };
}

export type PositionKindFilter = "all" | "stocks" | "options";

export function parsePositionKindFilter(
  raw: string | undefined,
): PositionKindFilter {
  if (raw === "stocks" || raw === "options") return raw;
  return "all";
}

export function isStockPosition(position: InvestmentPosition): boolean {
  if (isOptionAssetType(position.assetType, position.ticker)) return false;
  return (
    position.assetType === "equity" ||
    position.assetType === "etf" ||
    position.assetType === "mutual_fund"
  );
}

export function filterPositionsByKind(
  positions: InvestmentPosition[],
  kind: PositionKindFilter,
): InvestmentPosition[] {
  if (kind === "all") return positions;
  if (kind === "options") {
    return positions.filter((p) =>
      isOptionAssetType(p.assetType, p.ticker),
    );
  }
  return positions.filter((p) => isStockPosition(p));
}
