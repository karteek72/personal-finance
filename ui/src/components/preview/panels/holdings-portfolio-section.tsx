"use client";

import { useMemo, useState } from "react";

import type {
  InvestmentPosition,
  StockAggregate,
} from "@/types/api";

type HoldingsView = "account" | "stocks" | "options";
type SortKey = "value" | "gain" | "name" | "quantity";
type SortDir = "asc" | "desc";

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

function isOption(assetType: string) {
  return assetType === "option";
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

function holdingBadge(position: Pick<InvestmentPosition, "ticker" | "assetType" | "underlyingTicker">): string {
  if (isOption(position.assetType)) {
    return (position.underlyingTicker ?? position.ticker.split(/\s+/)[0] ?? position.ticker).slice(0, 4);
  }
  return position.ticker.slice(0, 4);
}

function compareNumbers(a: number, b: number, dir: SortDir): number {
  return dir === "asc" ? a - b : b - a;
}

function sortPositions(
  items: InvestmentPosition[],
  sortKey: SortKey,
  sortDir: SortDir,
): InvestmentPosition[] {
  return [...items].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case "quantity":
        return compareNumbers(a.quantity, b.quantity, sortDir);
      case "gain":
        return compareNumbers(a.gainLossPercent, b.gainLossPercent, sortDir);
      case "value":
      default:
        return compareNumbers(
          Number.parseFloat(a.value),
          Number.parseFloat(b.value),
          sortDir,
        );
    }
  });
}

function sortAggregates(
  items: StockAggregate[],
  sortKey: SortKey,
  sortDir: SortDir,
): StockAggregate[] {
  return [...items].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case "quantity":
        return compareNumbers(a.totalQuantity, b.totalQuantity, sortDir);
      case "gain":
        return compareNumbers(a.gainLossPercent, b.gainLossPercent, sortDir);
      case "value":
      default:
        return compareNumbers(
          Number.parseFloat(a.totalValue),
          Number.parseFloat(b.totalValue),
          sortDir,
        );
    }
  });
}

function PositionRow({ position }: { position: InvestmentPosition }) {
  const value = Number.parseFloat(position.value);
  const positive = Number.parseFloat(position.gainLoss) >= 0;
  const option = isOption(position.assetType);

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
      <div
        className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[var(--radius-sm)] font-bold text-text ${
          option ? "bg-warning/15 ring-1 ring-warning/30" : "bg-surface-raised"
        }`}
      >
        <span className="text-[10px] leading-none">{holdingBadge(position)}</span>
        {option ? (
          <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-warning">opt</span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-text">{position.name}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              option ? "bg-warning/10 text-warning" : "bg-surface-raised text-text-muted"
            }`}
          >
            {assetTypeLabel(position.assetType)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          {option ? (
            <>
              {position.quantity} contract{position.quantity === 1 ? "" : "s"}
              {position.optionType ? ` · ${position.optionType}` : ""}
              {position.expirationLabel ? ` · exp ${position.expirationLabel}` : ""}
              {" · "}
              {fmtPremium(Number.parseFloat(position.currentPrice))} premium
            </>
          ) : (
            <>
              {position.quantity} share{position.quantity === 1 ? "" : "s"}
              {position.sector ? ` · ${position.sector}` : ` · ${assetTypeLabel(position.assetType)}`}
            </>
          )}
          {" · "}
          {position.accountName}
          {position.accountMask ? ` ····${position.accountMask}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-text">{fmt(value)}</p>
        <p className={`text-xs font-semibold ${positive ? "text-success" : "text-danger"}`}>
          {positive ? "+" : ""}
          {position.gainLossPercent.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

function AggregateRow({ aggregate, expanded, onToggle }: {
  aggregate: StockAggregate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const value = Number.parseFloat(aggregate.totalValue);
  const positive = Number.parseFloat(aggregate.gainLoss) >= 0;

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-raised text-[10px] font-bold text-text">
          {aggregate.ticker.slice(0, 4)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-text">{aggregate.name}</p>
            <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {assetTypeLabel(aggregate.assetType)}
            </span>
            {aggregate.accountCount > 1 ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {aggregate.accountCount} accounts
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {aggregate.totalQuantity} share{aggregate.totalQuantity === 1 ? "" : "s"} total
            {aggregate.sector ? ` · ${aggregate.sector}` : ""}
            {" · avg cost "}
            {fmtPremium(
              aggregate.totalQuantity > 0
                ? Number.parseFloat(aggregate.totalCost) / aggregate.totalQuantity
                : 0,
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-text">{fmt(value)}</p>
          <p className={`text-xs font-semibold ${positive ? "text-success" : "text-danger"}`}>
            {positive ? "+" : ""}
            {aggregate.gainLossPercent.toFixed(1)}%
          </p>
        </div>
      </button>
      {expanded && aggregate.lots.length > 1 ? (
        <div className="space-y-1 border-t border-border px-3 pb-3 pt-2">
          {aggregate.lots.map((lot) => (
            <div
              key={`${aggregate.ticker}-${lot.accountId}`}
              className="flex items-center justify-between rounded-[var(--radius-sm)] bg-surface-raised/60 px-3 py-2 text-xs"
            >
              <span className="text-text-muted">{lot.accountName}</span>
              <span className="font-semibold text-text">
                {lot.quantity} sh · {fmt(Number.parseFloat(lot.value))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
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
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const filteredPositions = useMemo(() => {
    let list = positions;
    if (view === "options") {
      list = optionPositions;
    } else if (view === "stocks") {
      list = positions.filter((p) => !isOption(p.assetType));
    }
    if (accountFilter !== "all") {
      list = list.filter((p) => p.accountId === accountFilter);
    }
    return sortPositions(list, sortKey, sortDir);
  }, [positions, optionPositions, view, accountFilter, sortKey, sortDir]);

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
    return sortAggregates(list, sortKey, sortDir);
  }, [stockAggregates, accountFilter, sortKey, sortDir]);

  const positionsByAccount = useMemo(() => {
    const grouped = new Map<string, InvestmentPosition[]>();
    for (const position of filteredPositions) {
      const list = grouped.get(position.accountId) ?? [];
      list.push(position);
      grouped.set(position.accountId, list);
    }
    return [...grouped.entries()].sort((a, b) => {
      const aVal = a[1].reduce((s, p) => s + Number.parseFloat(p.value), 0);
      const bVal = b[1].reduce((s, p) => s + Number.parseFloat(p.value), 0);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredPositions, sortDir]);

  const isEmpty =
    view === "stocks"
      ? filteredAggregates.length === 0
      : filteredPositions.length === 0;

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
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 text-xs text-text"
        >
          <option value="value">Sort: Value</option>
          <option value="gain">Sort: Gain %</option>
          <option value="name">Sort: Name</option>
          <option value="quantity">Sort: Quantity</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text"
        >
          {sortDir === "desc" ? "↓ High to low" : "↑ Low to high"}
        </button>
      </div>

      {isEmpty ? (
        <p className="px-1 py-4 text-center text-sm text-text-muted">
          No holdings match this view. Try another tab or sync your brokerage.
        </p>
      ) : null}

      {view === "stocks" && !isEmpty ? (
        <div className="space-y-2">
          {filteredAggregates.map((agg) => (
            <AggregateRow
              key={agg.ticker}
              aggregate={agg}
              expanded={expandedTicker === agg.ticker}
              onToggle={() =>
                setExpandedTicker((t) => (t === agg.ticker ? null : agg.ticker))
              }
            />
          ))}
        </div>
      ) : null}

      {view === "options" && !isEmpty ? (
        <div className="space-y-2">
          {filteredPositions.map((position) => (
            <PositionRow key={position.holdingId} position={position} />
          ))}
        </div>
      ) : null}

      {view === "account" && !isEmpty ? (
        <div className="space-y-4">
          {positionsByAccount.map(([accountId, accountPositions]) => {
            const accountTotal = accountPositions.reduce(
              (s, p) => s + Number.parseFloat(p.value),
              0,
            );
            const first = accountPositions[0]!;
            return (
              <div key={accountId} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <p className="text-sm font-semibold text-text">{first.accountName}</p>
                    <p className="text-xs text-text-muted">
                      {first.institutionName}
                      {first.accountMask ? ` ····${first.accountMask}` : ""}
                      {" · "}
                      {accountPositions.length} position{accountPositions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-text">{fmt(accountTotal)}</p>
                </div>
                {accountPositions.map((position) => (
                  <PositionRow key={position.holdingId} position={position} />
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
