"use client";

import { Suspense, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FeaturePanelLoading } from "@/components/preview/feature-empty-state";
import { useInvestments } from "@/hooks/use-features";
import { useListQueryUrl } from "@/hooks/use-list-query-url";
import { formatMoneyValue } from "@/lib/format-money";
import type { InvestmentPosition, PortfolioBreakdown, PositionKindFilter } from "@/types/api";

const PAGE_SIZE = 15;

interface Props {
  portfolioBreakdown: PortfolioBreakdown;
  accountId?: string;
}

function plClass(positive: boolean) {
  return positive ? "text-success" : "text-danger";
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

function fmtPremium(n: number) {
  return formatMoneyValue(n);
}

function HoldingsTable({
  kind,
  queryPrefix,
  accountId,
  portfolioBreakdown,
}: {
  kind: PositionKindFilter;
  queryPrefix: string;
  accountId?: string;
  portfolioBreakdown: PortfolioBreakdown;
}) {
  const [query, setQuery] = useListQueryUrl({
    defaults: {
      page: 1,
      pageSize: PAGE_SIZE,
      sort: "value",
      dir: "desc",
    },
    prefix: queryPrefix,
  });
  const { data, isLoading, isFetching } = useInvestments({
    ...query,
    accountId,
    kind,
  });
  const positions = data?.positions.rows ?? [];
  const positionsPage = data?.positions;
  const isOptions = kind === "options";

  const columns: DataTableColumn<InvestmentPosition>[] = [
    {
      id: "ticker",
      header: "Ticker",
      sortable: true,
      render: (p) => <span className="font-semibold text-text">{p.ticker}</span>,
    },
    {
      id: "name",
      header: "Name",
      sortable: true,
      render: (p) => (
        <span>
          <span className="font-medium text-text">{p.name}</span>
          <span className="mt-0.5 block text-[10px] text-text-muted">
            {assetTypeLabel(p.assetType)}
            {p.expirationLabel ? ` · exp ${p.expirationLabel}` : ""}
          </span>
        </span>
      ),
    },
    ...(isOptions
      ? [
          {
            id: "optionType",
            header: "Type",
            render: (p: InvestmentPosition) => (
              <span className="text-text-muted">{p.optionType ?? "—"}</span>
            ),
          } as DataTableColumn<InvestmentPosition>,
          {
            id: "underlying",
            header: "Underlying",
            render: (p: InvestmentPosition) => (
              <span className="text-text-muted">{p.underlyingTicker ?? "—"}</span>
            ),
          } as DataTableColumn<InvestmentPosition>,
        ]
      : []),
    {
      id: "account",
      header: "Account",
      render: (p) => (
        <span className="text-text-muted">
          {p.accountName}
          {p.accountMask ? ` ····${p.accountMask}` : ""}
        </span>
      ),
    },
    {
      id: "costBasis",
      header: "Avg cost",
      align: "right",
      sortable: true,
      render: (p) => (
        <span className="text-text">{fmtPremium(Number.parseFloat(p.costBasis))}</span>
      ),
    },
    {
      id: "quantity",
      header: "Qty",
      align: "right",
      render: (p) => <span className="text-text-muted">{p.quantity}</span>,
    },
    {
      id: "value",
      header: "Value",
      align: "right",
      sortable: true,
      render: (p) => (
        <span className="font-bold text-text">
          {formatMoneyValue(Number.parseFloat(p.value))}
        </span>
      ),
    },
    {
      id: "gainLoss",
      header: "P/L",
      align: "right",
      sortable: true,
      render: (p) => {
        const gainLoss = Number.parseFloat(p.gainLoss);
        const positive = gainLoss >= 0;
        return (
          <span className={`font-semibold ${plClass(positive)}`}>
            {positive ? "+" : ""}
            {formatMoneyValue(gainLoss)}
          </span>
        );
      },
    },
    {
      id: "gainLossPercent",
      header: "% change",
      align: "right",
      sortable: true,
      render: (p) => {
        const positive = p.gainLossPercent >= 0;
        return (
          <span className={`font-semibold ${plClass(positive)}`}>
            {positive ? "+" : ""}
            {p.gainLossPercent.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      {kind === "stocks" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Stocks & ETFs</p>
            <p className="text-sm font-bold text-text">
              {formatMoneyValue(Number.parseFloat(portfolioBreakdown.stocksValue))}
            </p>
            <p className="text-[10px] text-text-muted">
              {portfolioBreakdown.stocksSharePercent}% · {portfolioBreakdown.stockPositionCount}{" "}
              positions
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Options</p>
            <p className="text-sm font-bold text-text">
              {formatMoneyValue(Number.parseFloat(portfolioBreakdown.optionsValue))}
            </p>
            <p className="text-[10px] text-text-muted">
              {portfolioBreakdown.optionsSharePercent}% · {portfolioBreakdown.optionPositionCount}{" "}
              positions
            </p>
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={positions}
        rowKey={(p) => p.holdingId}
        total={positionsPage?.total ?? 0}
        page={query.page ?? 1}
        pageSize={query.pageSize ?? PAGE_SIZE}
        sort={positionsPage?.sort ?? "value"}
        dir={positionsPage?.dir ?? "desc"}
        onSortChange={(sort, dir) => setQuery({ sort, dir, page: 1 })}
        onPageChange={(page) => setQuery({ page })}
        onSearch={(q) => setQuery({ q: q || undefined, page: 1 })}
        searchValue={query.q}
        searchPlaceholder="Search ticker or name…"
        isLoading={isLoading}
        isFetching={isFetching}
        emptyMessage="No holdings match your filters yet."
      />
    </div>
  );
}

function HoldingsTablesContent({ portfolioBreakdown, accountId }: Props) {
  const [holdingsTab, setHoldingsTab] = useState<"stocks" | "options">("stocks");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-1">
        {(["stocks", "options"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setHoldingsTab(tab)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold ${
              holdingsTab === tab
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab === "stocks" ? "Stocks & ETFs" : "Options"}
          </button>
        ))}
      </div>

      {holdingsTab === "stocks" ? (
        <HoldingsTable
          kind="stocks"
          queryPrefix="holdingsStocks"
          accountId={accountId}
          portfolioBreakdown={portfolioBreakdown}
        />
      ) : (
        <HoldingsTable
          kind="options"
          queryPrefix="holdingsOptions"
          accountId={accountId}
          portfolioBreakdown={portfolioBreakdown}
        />
      )}
    </div>
  );
}

export function HoldingsPortfolioSection(props: Props) {
  return (
    <Suspense fallback={<FeaturePanelLoading />}>
      <HoldingsTablesContent {...props} />
    </Suspense>
  );
}
