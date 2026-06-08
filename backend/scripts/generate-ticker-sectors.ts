/**
 * Regenerate src/data/ticker-gics-sectors.ts from S&P 500 + US listings CSV.
 *
 * Requires /tmp/tickers.csv from:
 * curl -fsSL -o /tmp/tickers.csv \
 *   https://raw.githubusercontent.com/adanos-software/free-ticker-database/main/data/tickers.csv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const sp500Path = "/tmp/sp500.csv";
const tickersPath = "/tmp/tickers.csv";
const outPath = resolve("src/data/ticker-gics-sectors.ts");

const map: Record<string, string> = {};

try {
  const spLines = readFileSync(sp500Path, "utf8").trim().split("\n");
  for (let i = 1; i < spLines.length; i++) {
    const cols = parseCsvLine(spLines[i] ?? "");
    const symbol = cols[0]?.trim();
    const sector = cols[2]?.trim();
    if (symbol && sector) map[symbol] = sector;
  }
} catch {
  // optional S&P 500 seed file
}

const lines = readFileSync(tickersPath, "utf8").trim().split("\n");
const headers = parseCsvLine(lines[0] ?? "");
const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i] ?? "");
  const ticker = cols[idx.ticker ?? 0]?.trim().toUpperCase();
  const country = cols[idx.country_code ?? 0]?.trim();
  const assetType = cols[idx.asset_type ?? 0]?.trim();
  if (!ticker || country !== "US" || map[ticker]) continue;

  if (assetType === "Stock") {
    const sector = cols[idx.stock_sector ?? 0]?.trim();
    if (sector && sector.length <= 50) map[ticker] = sector;
  } else if (assetType === "ETF") {
    const cat = cols[idx.etf_category ?? 0]?.trim();
    if (cat && cat.length <= 50) {
      map[ticker] = cat.includes("ETF") ? cat : `${cat} ETF`;
    }
  }
}

Object.assign(map, {
  VOO: "Broad Market ETF",
  SPY: "Broad Market ETF",
  IVV: "Broad Market ETF",
  VTI: "Broad Market ETF",
  QQQ: "Technology ETF",
  BTC: "Crypto",
  ETH: "Crypto",
  SPAXX: "Cash & Money Market",
  FDRXX: "Cash & Money Market",
  SWVXX: "Cash & Money Market",
  VMFXX: "Cash & Money Market",
  SPRXX: "Cash & Money Market",
  FCASH: "Cash & Money Market",
  IREN: "Energy",
  RZLV: "Information Technology",
  LAC: "Materials",
});

const out = `/** Auto-generated — run \`npx tsx scripts/generate-ticker-sectors.ts\` to refresh. */
export const TICKER_GICS_SECTORS: Readonly<Record<string, string>> = ${JSON.stringify(map, null, 2)} as const;
`;

writeFileSync(outPath, out);
console.log(`Wrote ${Object.keys(map).length} tickers to ${outPath}`);
