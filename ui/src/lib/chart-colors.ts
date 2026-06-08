/** Distinct chart palette — docs/design/design-tokens.json investments.chartPalette */
export const CHART_PALETTE = [
  "#3B82F6",
  "#F97316",
  "#22C55E",
  "#EC4899",
  "#8B5CF6",
  "#14B8A6",
  "#EAB308",
  "#EF4444",
  "#6366F1",
  "#84CC16",
  "#F43F5E",
  "#0EA5E9",
] as const;

/** GICS sectors + ETF categories — design-tokens investments.gicsSectors */
export const gicsSectorColors: Record<string, string> = {
  "Communication Services": "#6366F1",
  "Consumer Discretionary": "#F97316",
  "Consumer Staples": "#22C55E",
  "Energy": "#EAB308",
  Financials: "#64748B",
  "Health Care": "#EC4899",
  Industrials: "#6B7280",
  "Information Technology": "#3B82F6",
  Technology: "#3B82F6",
  Materials: "#A16207",
  "Real Estate": "#14B8A6",
  Utilities: "#0EA5E9",
  Diversified: "#8B5CF6",
  "Broad Market ETF": "#01696f",
  "Technology ETF": "#3B82F6",
  "International ETF": "#14B8A6",
  "Fixed Income ETF": "#64748B",
  "Fixed Income": "#64748B",
  "Commodities ETF": "#EAB308",
  "Thematic ETF": "#A855F7",
  "Leveraged ETF": "#EF4444",
  Crypto: "#F59E0B",
  "Funds (uncategorized)": "#94A3B8",
  Unknown: "#9CA3AF",
  "Options (unknown sector)": "#C084FC",
};

export const assetAllocationColors: Record<string, string> = {
  "Stocks & ETFs": "#3B82F6",
  Options: "#8B5CF6",
  Other: "#94A3B8",
  Crypto: "#F59E0B",
  Bonds: "#64748B",
};

export function getChartPaletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] ?? CHART_PALETTE[0];
}

export function getGicsSectorColor(sector: string, index: number): string {
  return gicsSectorColors[sector] ?? getChartPaletteColor(index);
}

export function getAssetAllocationColor(name: string, index: number): string {
  return assetAllocationColors[name] ?? getChartPaletteColor(index);
}

export function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length < 7) return hex;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
