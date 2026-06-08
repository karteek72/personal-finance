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
]);

const ETF_SECTOR_SUFFIX = " ETF";

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

export function lookupGicsSectorForTicker(
  ticker: string,
  assetType: string,
): string | null {
  const fromAssetType = sectorFromAssetType(assetType);
  if (fromAssetType) return fromAssetType;

  const normalized = normalizeEquityTicker(ticker);
  if (TICKER_GICS_SECTORS[normalized]) {
    return TICKER_GICS_SECTORS[normalized];
  }

  if (assetType === "etf" || assetType === "mutual_fund") {
    return null;
  }

  return null;
}

function lookupTickerSector(
  ticker: string,
  dbSectors: ReadonlyMap<string, string>,
): string | null {
  const normalized = normalizeEquityTicker(ticker);
  const fromDb = dbSectors.get(normalized);
  if (fromDb && !isOptionMetadataSector(fromDb)) {
    return fromDb;
  }
  return TICKER_GICS_SECTORS[normalized] ?? null;
}

export function resolveGicsSector(
  position: InvestmentPosition,
  dbSectors: ReadonlyMap<string, string>,
): string {
  const fromAssetType = sectorFromAssetType(position.assetType);
  if (fromAssetType) return fromAssetType;

  if (isOptionAssetType(position.assetType, position.ticker)) {
    const underlying = resolveUnderlyingTicker(position);
    if (underlying) {
      const underlyingSector = lookupTickerSector(underlying, dbSectors);
      if (underlyingSector) return underlyingSector;
    }
    return "Options (unknown sector)";
  }

  const stored = position.sector?.trim() ?? "";
  if (stored && !isOptionMetadataSector(stored)) {
    if (GICS_SECTORS.has(stored) || stored.endsWith(ETF_SECTOR_SUFFIX)) {
      return stored;
    }
  }

  const fromTicker = lookupTickerSector(position.ticker, dbSectors);
  if (fromTicker) return fromTicker;

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
