import { TICKER_GICS_SECTORS } from "../data/ticker-gics-sectors.js";
import {
  isOptionAssetType,
  parseOccOptionTicker,
  parseOptionSector,
  type InvestmentPosition,
} from "./holdings-mapper.js";

const GICS_SECTORS = new Set([
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
  "Technology",
  "Diversified",
  "Fixed Income",
  "Crypto",
  "Cash & Money Market",
  "Broad Market ETF",
  "Technology ETF",
  "International ETF",
  "Fixed Income ETF",
  "Commodities ETF",
  "Thematic ETF",
  "Leveraged ETF",
  "Other ETF",
]);

const MONEY_MARKET_TICKERS = new Set([
  "SPAXX",
  "FDRXX",
  "SWVXX",
  "VMFXX",
  "SPRXX",
  "FCASH",
  "CORE",
  "SNAXX",
]);

const ETF_SECTOR_SUFFIX = " ETF";
const CUSIP_TICKER = /^\d{5,}[A-Z0-9]*$/;

/** SnapTrade stores option metadata in `sector`, not GICS. */
export function isOptionMetadataSector(sector: string | null): boolean {
  if (!sector) return false;
  const trimmed = sector.trim();
  if (/^(Call|Put)\s·/.test(trimmed)) return true;
  if (trimmed.includes(" · exp ")) return true;
  return false;
}

export function normalizeEquityTicker(ticker: string): string {
  return ticker.trim().toUpperCase().split(/\s+/)[0] ?? ticker;
}

export function resolveUnderlyingTicker(
  position: InvestmentPosition,
): string | null {
  if (position.underlyingTicker?.trim()) {
    return normalizeEquityTicker(position.underlyingTicker);
  }

  const fromSector = parseOptionSector(position.sector);
  if (fromSector.underlyingTicker?.trim()) {
    return normalizeEquityTicker(fromSector.underlyingTicker);
  }

  const occ = parseOccOptionTicker(position.ticker);
  if (occ?.underlyingTicker) {
    return normalizeEquityTicker(occ.underlyingTicker);
  }

  return null;
}

function sectorFromAssetType(assetType: string): string | null {
  switch (assetType) {
    case "crypto":
      return "Crypto";
    case "bond":
    case "fixed_income":
      return "Fixed Income";
    default:
      return null;
  }
}

function isMoneyMarketTicker(ticker: string): boolean {
  const normalized = normalizeEquityTicker(ticker);
  if (MONEY_MARKET_TICKERS.has(normalized)) return true;
  if (/^[A-Z]{4,5}XX$/.test(normalized)) return true;
  return false;
}

function isUnclassifiedSecurityTicker(ticker: string): boolean {
  const normalized = normalizeEquityTicker(ticker);
  return CUSIP_TICKER.test(normalized);
}

export function lookupGicsSectorForTicker(
  ticker: string,
  assetType: string,
): string | null {
  const normalized = normalizeEquityTicker(ticker);

  if (isMoneyMarketTicker(normalized)) {
    return "Cash & Money Market";
  }
  if (isUnclassifiedSecurityTicker(normalized)) {
    return null;
  }

  const fromAssetType = sectorFromAssetType(assetType);
  if (fromAssetType) return fromAssetType;

  if (TICKER_GICS_SECTORS[normalized]) {
    return TICKER_GICS_SECTORS[normalized];
  }

  return null;
}

function lookupTickerSector(
  ticker: string,
  dbSectors: ReadonlyMap<string, string>,
  portfolioHints: ReadonlyMap<string, string>,
): string | null {
  const normalized = normalizeEquityTicker(ticker);

  const fromHint = portfolioHints.get(normalized);
  if (fromHint) return fromHint;

  const fromDb = dbSectors.get(normalized);
  if (fromDb && !isOptionMetadataSector(fromDb)) {
    return fromDb;
  }

  return TICKER_GICS_SECTORS[normalized] ?? null;
}

function resolveEquitySector(
  position: InvestmentPosition,
  dbSectors: ReadonlyMap<string, string>,
  portfolioHints: ReadonlyMap<string, string>,
): string | null {
  const stored = position.sector?.trim() ?? "";
  if (stored && !isOptionMetadataSector(stored)) {
    if (GICS_SECTORS.has(stored) || stored.endsWith(ETF_SECTOR_SUFFIX)) {
      return stored;
    }
  }

  return lookupTickerSector(position.ticker, dbSectors, portfolioHints);
}

/** Resolve sectors from equity holdings first so options can inherit the same sector. */
export function buildPortfolioSectorHints(
  positions: InvestmentPosition[],
  dbSectors: ReadonlyMap<string, string>,
): Map<string, string> {
  const hints = new Map<string, string>();
  for (const position of positions) {
    if (isOptionAssetType(position.assetType, position.ticker)) continue;
    const sector = resolveEquitySector(position, dbSectors, hints);
    if (!sector) continue;
    hints.set(normalizeEquityTicker(position.ticker), sector);
  }
  return hints;
}

export function resolveGicsSector(
  position: InvestmentPosition,
  dbSectors: ReadonlyMap<string, string>,
  portfolioHints: ReadonlyMap<string, string> = new Map(),
): string {
  const fromAssetType = sectorFromAssetType(position.assetType);
  if (fromAssetType) return fromAssetType;

  if (isMoneyMarketTicker(position.ticker)) {
    return "Cash & Money Market";
  }
  if (isUnclassifiedSecurityTicker(position.ticker)) {
    return "Unclassified security";
  }

  if (isOptionAssetType(position.assetType, position.ticker)) {
    const underlying = resolveUnderlyingTicker(position);
    if (underlying) {
      const underlyingSector = lookupTickerSector(
        underlying,
        dbSectors,
        portfolioHints,
      );
      if (underlyingSector) return underlyingSector;
    }
    return "Options (unknown sector)";
  }

  const fromEquity = resolveEquitySector(position, dbSectors, portfolioHints);
  if (fromEquity) return fromEquity;

  if (position.assetType === "etf" || position.assetType === "mutual_fund") {
    return "Funds (uncategorized)";
  }

  return "Unknown";
}

export function buildDbSectorMap(
  rows: ReadonlyArray<{ ticker: string; sector: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const sector = row.sector?.trim();
    if (!sector || isOptionMetadataSector(sector)) continue;
    map.set(normalizeEquityTicker(row.ticker), sector);
  }
  return map;
}

export function collectSectorLookupTickers(
  positions: InvestmentPosition[],
): string[] {
  const tickers = new Set<string>();
  for (const position of positions) {
    tickers.add(normalizeEquityTicker(position.ticker));
    const underlying = resolveUnderlyingTicker(position);
    if (underlying) tickers.add(underlying);
  }
  return [...tickers];
}

export function collectTickersNeedingSectorBackfill(
  rows: ReadonlyArray<{ ticker: string; sector: string | null; assetType: string }>,
): Array<{ ticker: string; sector: string }> {
  const updates: Array<{ ticker: string; sector: string }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.sector && !isOptionMetadataSector(row.sector)) continue;
    const ticker = normalizeEquityTicker(row.ticker);
    if (seen.has(ticker)) continue;
    const sector = lookupGicsSectorForTicker(row.ticker, row.assetType);
    if (sector) {
      seen.add(ticker);
      updates.push({ ticker, sector });
    }
  }
  return updates;
}
