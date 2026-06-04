import {
  formatMoneyAmount,
  formatOptionPremium,
  roundPercent,
} from "../lib/money.js";

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

/** US equity options: premium and cost basis are quoted per share; P&L uses ×100 per contract. */
export const OPTION_SHARES_PER_CONTRACT = 100;

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

/** Plausible per-share option premium band (E*Trade-style quotes). */
const MAX_OPTION_PREMIUM_PER_SHARE = 500;

/**
 * SnapTrade: average_purchase_price is per contract (premium × 100).
 * E*Trade shows per-share premium. Legacy DB rows may store per-contract or position totals.
 */
export function resolveOptionPremiumPerShare(
  storedCostBasis: number,
  quantity: number,
  currentPricePerShare?: number,
): number {
  if (storedCostBasis <= 0) return 0;

  const candidates: number[] = [storedCostBasis];
  const fromPerContract = storedCostBasis / OPTION_SHARES_PER_CONTRACT;
  if (fromPerContract > 0 && fromPerContract <= MAX_OPTION_PREMIUM_PER_SHARE) {
    candidates.push(fromPerContract);
  }
  if (quantity > 0) {
    const fromPositionTotal =
      storedCostBasis / (quantity * OPTION_SHARES_PER_CONTRACT);
    if (
      fromPositionTotal > 0 &&
      fromPositionTotal <= MAX_OPTION_PREMIUM_PER_SHARE
    ) {
      candidates.push(fromPositionTotal);
    }
  }

  const plausible = [...new Set(candidates)].filter(
    (v) => v > 0 && v <= MAX_OPTION_PREMIUM_PER_SHARE,
  );

  if (plausible.length === 1) {
    return plausible[0]!;
  }

  if (currentPricePerShare != null && currentPricePerShare > 0) {
    return plausible.reduce((best, v) =>
      Math.abs(v - currentPricePerShare) < Math.abs(best - currentPricePerShare)
        ? v
        : best,
    );
  }

  // Without market price: per-contract DB encoding is usually ~100× per-share
  // (e.g. 495.52 stored for $4.9552/share — must not treat as per-share).
  if (
    fromPerContract >= 0.01 &&
    fromPerContract <= MAX_OPTION_PREMIUM_PER_SHARE &&
    storedCostBasis >= 25 &&
    Math.abs(storedCostBasis - fromPerContract * OPTION_SHARES_PER_CONTRACT) <
      0.02
  ) {
    return fromPerContract;
  }

  if (storedCostBasis < 25) {
    return storedCostBasis;
  }

  if (
    fromPerContract >= 0.01 &&
    fromPerContract <= MAX_OPTION_PREMIUM_PER_SHARE
  ) {
    return fromPerContract;
  }

  return storedCostBasis;
}

function optionContractMultiplier(
  assetType: string | undefined,
  ticker: string | undefined,
): number {
  if (assetType && ticker && isOptionAssetType(assetType, ticker)) {
    return OPTION_SHARES_PER_CONTRACT;
  }
  return 1;
}

export function holdingMarketValue(input: {
  quantity: string;
  costBasis: string;
  institutionValue: string | null;
  currentPrice: string;
  assetType?: string;
  ticker?: string;
}): { value: number; unitPrice: number; cost: number } {
  const qty = Number.parseFloat(input.quantity);
  const multiplier = optionContractMultiplier(input.assetType, input.ticker);
  const isOption = multiplier > 1;

  const price = Number.parseFloat(input.currentPrice);
  const basisPerShare = isOption
    ? resolveOptionPremiumPerShare(
        Number.parseFloat(input.costBasis),
        qty,
        price > 0 ? price : undefined,
      )
    : Number.parseFloat(input.costBasis);

  const cost = qty * basisPerShare * multiplier;

  let institution = Number.parseFloat(input.institutionValue ?? "0");
  if (isOption && institution > 0 && price > 0 && qty > 0) {
    const expected = qty * price * multiplier;
    // Legacy sync stored price×qty without ×100.
    if (institution < expected * 0.9) {
      institution = 0;
    }
  }

  if (institution > 0) {
    const unitPrice =
      qty > 0 ? institution / (qty * multiplier) : basisPerShare;
    return { value: institution, unitPrice, cost };
  }

  if (price > 0) {
    return {
      value: qty * price * multiplier,
      unitPrice: price,
      cost,
    };
  }

  return { value: cost, unitPrice: basisPerShare, cost };
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

/** OCC-style option symbol, e.g. HOOD  270115C00100000 */
const OCC_OPTION_TICKER = /^[A-Z]{1,6}\s+\d{6}[CP]\d{8}$/;

export function isOccOptionTicker(ticker: string): boolean {
  return OCC_OPTION_TICKER.test(ticker.trim().toUpperCase());
}

export function isOptionAssetType(assetType: string, ticker?: string): boolean {
  if (assetType === "option") return true;
  if (ticker && isOccOptionTicker(ticker)) return true;
  return false;
}

export function effectiveAssetType(
  assetType: string,
  ticker: string,
  sector: string | null,
): string {
  if (isOptionAssetType(assetType, ticker)) return "option";
  return assetType;
}

function parseOccExpiration(yymmdd: string): string {
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  const d = new Date(year, mm - 1, dd);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function parseOccOptionTicker(ticker: string): {
  underlyingTicker: string;
  optionType: string;
  strikeLabel: string;
  expirationLabel: string;
} | null {
  const normalized = ticker.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{1,6})\s+(\d{6})([CP])(\d{8})$/);
  if (!match) return null;

  const [, root, yymmdd, cp, strikeRaw] = match;
  const strikeNum = Number(strikeRaw) / 1000;
  const strikeLabel = Number.isFinite(strikeNum)
    ? `$${strikeNum % 1 === 0 ? strikeNum.toFixed(0) : strikeNum.toFixed(2)}`
    : "";

  return {
    underlyingTicker: root ?? "",
    optionType: cp === "P" ? "Put" : "Call",
    strikeLabel,
    expirationLabel: parseOccExpiration(yymmdd ?? ""),
  };
}

export function resolveOptionMeta(
  assetType: string,
  ticker: string,
  sector: string | null,
  name: string,
): {
  underlyingTicker: string | null;
  optionType: string | null;
  expirationLabel: string | null;
  displayName: string;
  displaySector: string | null;
} {
  if (!isOptionAssetType(assetType, ticker)) {
    return {
      underlyingTicker: null,
      optionType: null,
      expirationLabel: null,
      displayName: name,
      displaySector: sector,
    };
  }

  const fromSector = parseOptionSector(sector);
  if (fromSector.underlyingTicker) {
    return {
      underlyingTicker: fromSector.underlyingTicker,
      optionType: fromSector.optionType,
      expirationLabel: fromSector.expirationLabel,
      displayName: name,
      displaySector: sector,
    };
  }

  const occ = parseOccOptionTicker(ticker);
  if (!occ) {
    return {
      underlyingTicker: null,
      optionType: null,
      expirationLabel: null,
      displayName: name,
      displaySector: sector,
    };
  }

  const displaySector = `${occ.optionType} · ${occ.underlyingTicker} · exp ${occ.expirationLabel}`;
  const displayName =
    name && !isOccOptionTicker(name)
      ? name
      : `${occ.underlyingTicker} ${occ.strikeLabel} ${occ.optionType} · ${occ.expirationLabel}`;

  return {
    underlyingTicker: occ.underlyingTicker,
    optionType: occ.optionType,
    expirationLabel: occ.expirationLabel,
    displayName,
    displaySector,
  };
}

/** Returns per-share premium for options, per-share price for stocks. */
export function normalizeCostBasisPerUnit(input: {
  assetType: string;
  ticker: string;
  quantity: number;
  storedCostBasis: number;
  currentPricePerShare?: number;
}): number {
  if (!isOptionAssetType(input.assetType, input.ticker)) {
    return input.storedCostBasis;
  }
  return resolveOptionPremiumPerShare(
    input.storedCostBasis,
    input.quantity,
    input.currentPricePerShare,
  );
}

export function mapHoldingRow(row: MappedHoldingRow): InvestmentPosition {
  const qty = Number.parseFloat(row.quantity);
  const rawPrice = Number.parseFloat(row.currentPrice);
  const institution =
    row.institutionValue != null
      ? Number.parseFloat(row.institutionValue)
      : null;
  const assetType = effectiveAssetType(row.assetType, row.ticker, row.sector);
  const costPerShare = normalizeCostBasisPerUnit({
    assetType,
    ticker: row.ticker,
    quantity: qty,
    storedCostBasis: Number.parseFloat(row.costBasis),
    currentPricePerShare: rawPrice > 0 ? rawPrice : undefined,
  });
  const isOption = isOptionAssetType(assetType, row.ticker);
  const costBasisStr = isOption
    ? formatOptionPremium(costPerShare)
    : formatMoneyAmount(costPerShare);

  const { value, unitPrice, cost } = holdingMarketValue({
    quantity: row.quantity,
    costBasis: costBasisStr,
    institutionValue: row.institutionValue,
    currentPrice: row.currentPrice,
    assetType,
    ticker: row.ticker,
  });

  const optionMeta = resolveOptionMeta(
    assetType,
    row.ticker,
    row.sector,
    row.name,
  );

  return {
    holdingId: row.holdingId,
    accountId: row.accountId,
    accountName: row.accountName,
    institutionName: row.institutionName,
    accountMask: row.accountMask,
    ticker: row.ticker,
    name: optionMeta.displayName,
    sector: optionMeta.displaySector,
    assetType,
    quantity: qty,
    costBasis: costBasisStr,
    currentPrice: isOption
      ? formatOptionPremium(unitPrice)
      : formatMoneyAmount(unitPrice),
    value: formatMoneyAmount(value),
    gainLoss: formatMoneyAmount(value - cost),
    gainLossPercent: cost > 0 ? roundPercent(((value - cost) / cost) * 100) : 0,
    ...(isOptionAssetType(assetType, row.ticker)
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
    if (isOptionAssetType(position.assetType, position.ticker)) continue;

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
    if (isOptionAssetType(position.assetType, position.ticker)) {
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
