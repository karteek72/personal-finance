"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";

import type {
  InvestmentPosition,
  StockAggregate,
} from "@/types/api";

type HoldingsView = "account" | "stocks" | "options";
type SortDir = "asc" | "desc";

type OptionSortKey = "ticker" | "expiration" | "contracts" | "pl" | "gain";
type StockSortKey =
  | "ticker"
  | "name"
  | "shares"
  | "avg"
  | "current"
  | "value"
  | "pl"
  | "gain";
type PositionSortKey =
  | "ticker"
  | "name"
  | "account"
  | "shares"
  | "avg"
  | "current"
  | "pl"
  | "gain";

interface Props {
  positions: InvestmentPosition[];
  stockAggregates: StockAggregate[];
  optionPositions: InvestmentPosition[];
  portfolioBreakdown: {
    stocksValue: string;
    optionsValue: string;
    stocksSharePercent: number;
    optionsSharePercent: number;
    stockPositionCount: number;
    optionPositionCount: number;
  };
  accountOptions: Array<{ id: string; name: string; mask: string | null }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPremium(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Per-share option premium (matches E*Trade avg price precision). */
function fmtOptionPremium(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function plClass(positive: boolean) {
  return positive ? "text-success" : "text-danger";
}

const OCC_OPTION_TICKER = /^[A-Z]{1,6}\s+\d{6}[CP]\d{8}$/i;

function isOption(position: Pick<InvestmentPosition, "assetType" | "ticker">) {
  if (position.assetType === "option") return true;
  return OCC_OPTION_TICKER.test(position.ticker.trim());
}

function assetTypeLabel(assetType: string): string {
  const labels: Record<string, string> = {
    equity: "Stock",
    etf: "ETF",
    mutual_fund: "Mutual fund",
    bond: "Bond",
    crypto: "Crypto",
    option: "Option",
  };
  return labels[assetType] ?? assetType;
}

function compareNumbers(a: number, b: number, dir: SortDir): number {
  return dir === "asc" ? a - b : b - a;
}

function compareStrings(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b);
  return dir === "asc" ? cmp : -cmp;
}

function toggleSort<K extends string>(
  column: K,
  sortKey: K,
  setSortKey: (k: K) => void,
  sortDir: SortDir,
  setSortDir: (d: SortDir | ((prev: SortDir) => SortDir)) => void,
  defaultAsc: K[],
) {
  if (column === sortKey) {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  } else {
    setSortKey(column);
    setSortDir(defaultAsc.includes(column) ? "asc" : "desc");
  }
}

function SortableHeader<K extends string>({
  label,
  column,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: K;
  align?: "left" | "right";
  sortKey: K;
  sortDir: SortDir;
  onSort: (column: K) => void;
}) {
  const active = sortKey === column;
  return (
    <th
      className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide transition-colors hover:text-text ${
          active ? "text-primary" : "text-text-muted"
        } ${align === "right" ? "w-full justify-end" : ""}`}
      >
        <span>{label}</span>
        <span className="text-[9px] leading-none opacity-80" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function HoldingsTableShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        {children}
      </table>
      {footer ? (
        <p className="border-t border-border bg-surface-raised/50 px-3 py-2 text-[10px] text-text-muted">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

function optionTickerLabel(position: InvestmentPosition): string {
  return position.underlyingTicker ?? position.ticker.split(/\s+/)[0] ?? position.ticker;
}

function optionExpirationSortKey(position: InvestmentPosition): number {
  const label =
    position.expirationLabel ??
    position.sector?.match(/exp (.+)$/)?.[1] ??
    "";
  const parsed = Date.parse(label);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortOptionPositions(
  items: InvestmentPosition[],
  sortKey: OptionSortKey,
  sortDir: SortDir,
): InvestmentPosition[] {
  return [...items].sort((a, b) => {
    switch (sortKey) {
      case "ticker":
        return compareStrings(optionTickerLabel(a), optionTickerLabel(b), sortDir);
      case "expiration":
        return compareNumbers(
          optionExpirationSortKey(a),
          optionExpirationSortKey(b),
          sortDir,
        );
      case "contracts":
        return compareNumbers(a.quantity, b.quantity, sortDir);
      case "pl":
        return compareNumbers(
          Number.parseFloat(a.gainLoss),
          Number.parseFloat(b.gainLoss),
          sortDir,
        );
      case "gain":
        return compareNumbers(a.gainLossPercent, b.gainLossPercent, sortDir);
      default:
        return 0;
    }
  });
}

function stockAvgCost(agg: StockAggregate): number {
  return agg.totalQuantity > 0
    ? Number.parseFloat(agg.totalCost) / agg.totalQuantity
    : 0;
}

function sortStockAggregates(
  items: StockAggregate[],
  sortKey: StockSortKey,
  sortDir: SortDir,
): StockAggregate[] {
  return [...items].sort((a, b) => {
    switch (sortKey) {
      case "ticker":
        return compareStrings(a.ticker, b.ticker, sortDir);
      case "name":
        return compareStrings(a.name, b.name, sortDir);
      case "shares":
        return compareNumbers(a.totalQuantity, b.totalQuantity, sortDir);
      case "avg":
        return compareNumbers(stockAvgCost(a), stockAvgCost(b), sortDir);
      case "current":
        return compareNumbers(
          Number.parseFloat(a.currentPrice),
          Number.parseFloat(b.currentPrice),
          sortDir,
        );
      case "value":
        return compareNumbers(
          Number.parseFloat(a.totalValue),
          Number.parseFloat(b.totalValue),
          sortDir,
        );
      case "pl":
        return compareNumbers(
          Number.parseFloat(a.gainLoss),
          Number.parseFloat(b.gainLoss),
          sortDir,
        );
      case "gain":
        return compareNumbers(a.gainLossPercent, b.gainLossPercent, sortDir);
      default:
        return 0;
    }
  });
}

function sortHoldingsPositions(
  items: InvestmentPosition[],
  sortKey: PositionSortKey,
  sortDir: SortDir,
): InvestmentPosition[] {
  return [...items].sort((a, b) => {
    switch (sortKey) {
      case "ticker":
        return compareStrings(a.ticker, b.ticker, sortDir);
      case "name":
        return compareStrings(a.name, b.name, sortDir);
      case "account":
        return compareStrings(a.accountName, b.accountName, sortDir);
      case "shares":
        return compareNumbers(a.quantity, b.quantity, sortDir);
      case "avg":
        return compareNumbers(
          Number.parseFloat(a.costBasis),
          Number.parseFloat(b.costBasis),
          sortDir,
        );
      case "current":
        return compareNumbers(
          Number.parseFloat(a.currentPrice),
          Number.parseFloat(b.currentPrice),
          sortDir,
        );
      case "pl":
        return compareNumbers(
          Number.parseFloat(a.gainLoss),
          Number.parseFloat(b.gainLoss),
          sortDir,
        );
      case "gain":
        return compareNumbers(a.gainLossPercent, b.gainLossPercent, sortDir);
      default:
        return 0;
    }
  });
}

function OptionsPositionsTable({ positions }: { positions: InvestmentPosition[] }) {
  const [sortKey, setSortKey] = useState<OptionSortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(
    () => sortOptionPositions(positions, sortKey, sortDir),
    [positions, sortKey, sortDir],
  );

  const handleSort = (column: OptionSortKey) => {
    toggleSort(column, sortKey, setSortKey, sortDir, setSortDir, [
      "ticker",
      "expiration",
    ]);
  };

  return (
    <HoldingsTableShell footer="Avg and current prices are per-share premium (×100 per contract), matching E*Trade.">
      <thead>
        <tr className="border-b border-border bg-surface-raised/80">
          <SortableHeader label="Ticker" column="ticker" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Expiration" column="expiration" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Avg price
          </th>
          <SortableHeader label="Contracts" column="contracts" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Current
          </th>
          <SortableHeader label="P/L" column="pl" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="% change" column="gain" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((position) => {
          const positive = Number.parseFloat(position.gainLoss) >= 0;
          const gainLoss = Number.parseFloat(position.gainLoss);
          const expiration =
            position.expirationLabel ??
            (position.sector?.match(/exp (.+)$/)?.[1] ?? "—");
          const contractLabel = position.optionType
            ? `${optionTickerLabel(position)} ${position.optionType}`
            : optionTickerLabel(position);

          return (
            <tr
              key={position.holdingId}
              className="border-b border-border/60 bg-surface last:border-b-0 hover:bg-surface-raised/40"
            >
              <td className="px-3 py-3">
                <p className="font-semibold text-text">{contractLabel}</p>
                <p className="mt-0.5 truncate text-[10px] text-text-muted" title={position.name}>
                  {position.name}
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  {position.accountName}
                  {position.accountMask ? ` ····${position.accountMask}` : ""}
                </p>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-text">{expiration}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-text">
                {fmtOptionPremium(Number.parseFloat(position.costBasis))}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-text">
                {position.quantity}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-text">
                {fmtOptionPremium(Number.parseFloat(position.currentPrice))}
              </td>
              <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${plClass(positive)}`}>
                {positive ? "+" : ""}
                {fmt(gainLoss)}
              </td>
              <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${plClass(positive)}`}>
                {positive ? "+" : ""}
                {position.gainLossPercent.toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </HoldingsTableShell>
  );
}

function StockAggregatesTable({ aggregates }: { aggregates: StockAggregate[] }) {
  const [sortKey, setSortKey] = useState<StockSortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const sorted = useMemo(
    () => sortStockAggregates(aggregates, sortKey, sortDir),
    [aggregates, sortKey, sortDir],
  );

  const handleSort = (column: StockSortKey) => {
    toggleSort(column, sortKey, setSortKey, sortDir, setSortDir, ["ticker", "name"]);
  };

  return (
    <HoldingsTableShell footer="Aggregated across accounts. Click a row with multiple accounts to see lots.">
      <thead>
        <tr className="border-b border-border bg-surface-raised/80">
          <SortableHeader label="Ticker" column="ticker" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Avg cost" column="avg" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Shares" column="shares" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Current" column="current" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Value" column="value" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="P/L" column="pl" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="% change" column="gain" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((agg) => {
          const positive = Number.parseFloat(agg.gainLoss) >= 0;
          const gainLoss = Number.parseFloat(agg.gainLoss);
          const avg = stockAvgCost(agg);
          const expanded = expandedTicker === agg.ticker && agg.lots.length > 1;

          return (
            <Fragment key={agg.ticker}>
              <tr
                className={`border-b border-border/60 bg-surface hover:bg-surface-raised/40 ${
                  agg.lots.length > 1 ? "cursor-pointer" : ""
                }`}
                onClick={
                  agg.lots.length > 1
                    ? () =>
                        setExpandedTicker((t) => (t === agg.ticker ? null : agg.ticker))
                    : undefined
                }
              >
                <td className="px-3 py-3">
                  <p className="font-semibold text-text">{agg.ticker}</p>
                  {agg.accountCount > 1 ? (
                    <p className="mt-0.5 text-[10px] text-primary">
                      {agg.accountCount} accounts {expanded ? "▲" : "▼"}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-text">{agg.name}</p>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {assetTypeLabel(agg.assetType)}
                    {agg.sector ? ` · ${agg.sector}` : ""}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-text">
                  {fmtPremium(avg)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-text">
                  {agg.totalQuantity}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-text">
                  {fmtPremium(Number.parseFloat(agg.currentPrice))}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-text">
                  {fmt(Number.parseFloat(agg.totalValue))}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${plClass(positive)}`}>
                  {positive ? "+" : ""}
                  {fmt(gainLoss)}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${plClass(positive)}`}>
                  {positive ? "+" : ""}
                  {agg.gainLossPercent.toFixed(1)}%
                </td>
              </tr>
              {expanded
                ? agg.lots.map((lot) => (
                    <tr
                      key={`${agg.ticker}-${lot.accountId}`}
                      className="border-b border-border/40 bg-surface-raised/30"
                    >
                      <td className="px-3 py-2 pl-6 text-[10px] text-text-muted" colSpan={2}>
                        {lot.accountName}
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] text-text-muted">
                        {fmtPremium(Number.parseFloat(lot.costBasis))}
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] text-text">
                        {lot.quantity}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right text-[10px] font-medium text-text">
                        {fmt(Number.parseFloat(lot.value))}
                      </td>
                      <td className="px-3 py-2" colSpan={2} />
                    </tr>
                  ))
                : null}
            </Fragment>
          );
        })}
      </tbody>
    </HoldingsTableShell>
  );
}

function HoldingsPositionsTable({
  positions,
  showAccountColumn,
}: {
  positions: InvestmentPosition[];
  showAccountColumn: boolean;
}) {
  const [sortKey, setSortKey] = useState<PositionSortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(
    () => sortHoldingsPositions(positions, sortKey, sortDir),
    [positions, sortKey, sortDir],
  );

  const handleSort = (column: PositionSortKey) => {
    toggleSort(column, sortKey, setSortKey, sortDir, setSortDir, [
      "ticker",
      "name",
      "account",
    ]);
  };

  return (
    <HoldingsTableShell>
      <thead>
        <tr className="border-b border-border bg-surface-raised/80">
          <SortableHeader label="Ticker" column="ticker" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          {showAccountColumn ? (
            <SortableHeader label="Account" column="account" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          ) : null}
          <SortableHeader label="Avg cost" column="avg" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Shares" column="shares" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="Current" column="current" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="P/L" column="pl" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader label="% change" column="gain" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((position) => {
          const positive = Number.parseFloat(position.gainLoss) >= 0;
          const gainLoss = Number.parseFloat(position.gainLoss);
          const option = isOption(position);
          const avgFmt = option ? fmtOptionPremium : fmtPremium;

          return (
            <tr
              key={position.holdingId}
              className="border-b border-border/60 bg-surface last:border-b-0 hover:bg-surface-raised/40"
            >
              <td className="px-3 py-3 font-semibold text-text">{position.ticker}</td>
              <td className="px-3 py-3">
                <p className="font-medium text-text">{position.name}</p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  {assetTypeLabel(position.assetType)}
                  {option && position.expirationLabel
                    ? ` · exp ${position.expirationLabel}`
                    : ""}
                  {!option && position.sector ? ` · ${position.sector}` : ""}
                </p>
              </td>
              {showAccountColumn ? (
                <td className="whitespace-nowrap px-3 py-3 text-text">
                  {position.accountName}
                  {position.accountMask ? (
                    <span className="text-text-muted"> ····{position.accountMask}</span>
                  ) : null}
                </td>
              ) : null}
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-text">
                {avgFmt(Number.parseFloat(position.costBasis))}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-text">
                {position.quantity}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-text">
                {avgFmt(Number.parseFloat(position.currentPrice))}
              </td>
              <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${plClass(positive)}`}>
                {positive ? "+" : ""}
                {fmt(gainLoss)}
              </td>
              <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${plClass(positive)}`}>
                {positive ? "+" : ""}
                {position.gainLossPercent.toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </HoldingsTableShell>
  );
}

export function HoldingsPortfolioSection({
  positions,
  stockAggregates,
  optionPositions,
  portfolioBreakdown,
  accountOptions,
}: Props) {
  const [view, setView] = useState<HoldingsView>("stocks");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const filteredPositions = useMemo(() => {
    let list = positions;
    if (view === "options") {
      list = optionPositions;
    } else if (view === "stocks") {
      list = positions.filter((p) => !isOption(p));
    }
    if (accountFilter !== "all") {
      list = list.filter((p) => p.accountId === accountFilter);
    }
    return list;
  }, [positions, optionPositions, view, accountFilter]);

  const filteredAggregates = useMemo(() => {
    let list = stockAggregates;
    if (accountFilter !== "all") {
      list = list
        .map((agg) => {
          const lots = agg.lots.filter((lot) => lot.accountId === accountFilter);
          if (lots.length === 0) return null;
          const totalValue = lots.reduce((s, l) => s + Number.parseFloat(l.value), 0);
          const totalQuantity = lots.reduce((s, l) => s + l.quantity, 0);
          const totalCost = lots.reduce(
            (s, l) => s + l.quantity * Number.parseFloat(l.costBasis),
            0,
          );
          return {
            ...agg,
            lots,
            accountCount: lots.length,
            totalQuantity,
            totalValue: totalValue.toFixed(2),
            totalCost: totalCost.toFixed(2),
            gainLoss: (totalValue - totalCost).toFixed(2),
            gainLossPercent:
              totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
          };
        })
        .filter((agg): agg is StockAggregate => agg != null);
    }
    return list;
  }, [stockAggregates, accountFilter]);

  const accountGroups = useMemo(() => {
    const grouped = new Map<string, InvestmentPosition[]>();
    for (const position of filteredPositions) {
      const list = grouped.get(position.accountId) ?? [];
      list.push(position);
      grouped.set(position.accountId, list);
    }
    return [...grouped.entries()].map(([accountId, accountPositions]) => {
      const first = accountPositions[0]!;
      const total = accountPositions.reduce(
        (s, p) => s + Number.parseFloat(p.value),
        0,
      );
      return { accountId, accountPositions, first, total };
    });
  }, [filteredPositions]);

  const isEmpty =
    view === "stocks"
      ? filteredAggregates.length === 0
      : filteredPositions.length === 0;

  const showAccountColumnInTable =
    view === "account" && accountFilter === "all" && accountGroups.length > 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Stocks & ETFs</p>
          <p className="text-sm font-bold text-text">{fmt(Number.parseFloat(portfolioBreakdown.stocksValue))}</p>
          <p className="text-[10px] text-text-muted">{portfolioBreakdown.stocksSharePercent}% · {portfolioBreakdown.stockPositionCount} positions</p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Options</p>
          <p className="text-sm font-bold text-text">{fmt(Number.parseFloat(portfolioBreakdown.optionsValue))}</p>
          <p className="text-[10px] text-text-muted">{portfolioBreakdown.optionsSharePercent}% · {portfolioBreakdown.optionPositionCount} positions</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "stocks" as const, label: "By stock" },
            { id: "options" as const, label: "Options" },
            { id: "account" as const, label: "By account" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
              view === tab.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 text-xs text-text"
        >
          <option value="all">All accounts</option>
          {accountOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{a.mask ? ` ····${a.mask}` : ""}
            </option>
          ))}
        </select>
      </div>

      {isEmpty ? (
        <p className="px-1 py-4 text-center text-sm text-text-muted">
          No holdings match this view. Try another tab or sync your brokerage.
        </p>
      ) : null}

      {view === "stocks" && !isEmpty ? (
        <StockAggregatesTable aggregates={filteredAggregates} />
      ) : null}

      {view === "options" && !isEmpty ? (
        <OptionsPositionsTable positions={filteredPositions} />
      ) : null}

      {view === "account" && !isEmpty ? (
        showAccountColumnInTable ? (
          <HoldingsPositionsTable
            positions={filteredPositions}
            showAccountColumn
          />
        ) : (
          <div className="space-y-4">
            {accountGroups.map(({ accountId, accountPositions, first, total }) => (
              <div key={accountId} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <p className="text-sm font-semibold text-text">{first.accountName}</p>
                    <p className="text-xs text-text-muted">
                      {first.institutionName}
                      {first.accountMask ? ` ····${first.accountMask}` : ""}
                      {" · "}
                      {accountPositions.length} position
                      {accountPositions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-text">{fmt(total)}</p>
                </div>
                <HoldingsPositionsTable
                  positions={accountPositions}
                  showAccountColumn={false}
                />
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
