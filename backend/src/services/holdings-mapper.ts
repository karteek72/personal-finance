import { formatMoneyAmount, roundPercent } from "../lib/money.js";

export interface MappedHoldingRow {
  holdingId: string;
  accountId: string;
  accountName: string;
  institutionName: string;
  accountMask: string | null;
  quantity: string;
  costBasis: string;
  institutionValue: string | null;
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
  currentPrice: string;
}

export interface InvestmentPosition {
  holdingId: string;
  accountId: string;
  accountName: string;
  institutionName: string;
  accountMask: string | null;
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

export interface StockAggregateLot {
  accountId: string;
  accountName: string;
  quantity: number;
  value: string;
  costBasis: string;
}

export interface StockAggregate {
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
  totalQuantity: number;
  currentPrice: string;
  totalValue: string;
  totalCost: string;
  gainLoss: string;
  gainLossPercent: number;
  accountCount: number;
  lots: StockAggregateLot[];
}

export interface PortfolioBreakdown {
  stocksValue: string;
  optionsValue: string;
  otherValue: string;
  stocksSharePercent: number;
  optionsSharePercent: number;
  stockPositionCount: number;
  optionPositionCount: number;
  totalPositionCount: number;
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

export function parseOptionSector(sector: string | null): {
  optionType: string | null;
  underlyingTicker: string | null;
  expirationLabel: string | null;
} {
  if (!sector) {
    return { optionType: null, underlyingTicker: null, expirationLabel: null };
  }
  const parts = sector.split(" · ");
  return {
    optionType: parts[0] ?? null,
    underlyingTicker: parts[1] ?? null,
    expirationLabel: parts[2]?.replace(/^exp /, "") ?? null,
  };
}

export function isOptionAssetType(assetType: string): boolean {
  return assetType === "option";
}

export function mapHoldingRow(row: MappedHoldingRow): InvestmentPosition {
  const qty = Number.parseFloat(row.quantity);
  const { value, unitPrice, cost } = holdingMarketValue({
    quantity: row.quantity,
    costBasis: row.costBasis,
    institutionValue: row.institutionValue,
    currentPrice: row.currentPrice,
  });
  const optionMeta =
    row.assetType === "option" ? parseOptionSector(row.sector) : null;

  return {
    holdingId: row.holdingId,
    accountId: row.accountId,
    accountName: row.accountName,
    institutionName: row.institutionName,
    accountMask: row.accountMask,
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
    ...(optionMeta
      ? {
          underlyingTicker: optionMeta.underlyingTicker,
          optionType: optionMeta.optionType,
          expirationLabel: optionMeta.expirationLabel,
        }
      : {}),
  };
}

export function aggregateStockPositions(
  positions: InvestmentPosition[],
): StockAggregate[] {
  const byTicker = new Map<
    string,
    {
      name: string;
      sector: string | null;
      assetType: string;
      currentPrice: number;
      totalQuantity: number;
      totalValue: number;
      totalCost: number;
      lots: StockAggregateLot[];
    }
  >();

  for (const position of positions) {
    if (isOptionAssetType(position.assetType)) continue;

    const value = Number.parseFloat(position.value);
    const cost =
      position.quantity * Number.parseFloat(position.costBasis);
    const price = Number.parseFloat(position.currentPrice);
    const existing = byTicker.get(position.ticker);

    if (existing) {
      existing.totalQuantity += position.quantity;
      existing.totalValue += value;
      existing.totalCost += cost;
      existing.lots.push({
        accountId: position.accountId,
        accountName: position.accountName,
        quantity: position.quantity,
        value: position.value,
        costBasis: position.costBasis,
      });
    } else {
      byTicker.set(position.ticker, {
        name: position.name,
        sector: position.sector,
        assetType: position.assetType,
        currentPrice: price,
        totalQuantity: position.quantity,
        totalValue: value,
        totalCost: cost,
        lots: [
          {
            accountId: position.accountId,
            accountName: position.accountName,
            quantity: position.quantity,
            value: position.value,
            costBasis: position.costBasis,
          },
        ],
      });
    }
  }

  return [...byTicker.entries()]
    .map(([ticker, agg]) => ({
      ticker,
      name: agg.name,
      sector: agg.sector,
      assetType: agg.assetType,
      totalQuantity: agg.totalQuantity,
      currentPrice: formatMoneyAmount(agg.currentPrice),
      totalValue: formatMoneyAmount(agg.totalValue),
      totalCost: formatMoneyAmount(agg.totalCost),
      gainLoss: formatMoneyAmount(agg.totalValue - agg.totalCost),
      gainLossPercent:
        agg.totalCost > 0
          ? roundPercent(((agg.totalValue - agg.totalCost) / agg.totalCost) * 100)
          : 0,
      accountCount: agg.lots.length,
      lots: agg.lots,
    }))
    .sort(
      (a, b) =>
        Number.parseFloat(b.totalValue) - Number.parseFloat(a.totalValue),
    );
}

export function buildPortfolioBreakdown(
  positions: InvestmentPosition[],
): PortfolioBreakdown {
  let stocksValue = 0;
  let optionsValue = 0;
  let otherValue = 0;
  let stockPositionCount = 0;
  let optionPositionCount = 0;

  for (const position of positions) {
    const value = Number.parseFloat(position.value);
    if (isOptionAssetType(position.assetType)) {
      optionsValue += value;
      optionPositionCount += 1;
    } else if (
      position.assetType === "equity" ||
      position.assetType === "etf" ||
      position.assetType === "mutual_fund"
    ) {
      stocksValue += value;
      stockPositionCount += 1;
    } else {
      otherValue += value;
      stockPositionCount += 1;
    }
  }

  const total = stocksValue + optionsValue + otherValue;

  return {
    stocksValue: formatMoneyAmount(stocksValue),
    optionsValue: formatMoneyAmount(optionsValue),
    otherValue: formatMoneyAmount(otherValue),
    stocksSharePercent:
      total > 0 ? roundPercent((stocksValue / total) * 100) : 0,
    optionsSharePercent:
      total > 0 ? roundPercent((optionsValue / total) * 100) : 0,
    stockPositionCount,
    optionPositionCount,
    totalPositionCount: positions.length,
  };
}

export { holdingMarketValue };
