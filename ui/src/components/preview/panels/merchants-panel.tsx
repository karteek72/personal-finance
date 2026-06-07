"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useMerchants, useMerchantsTable } from "@/hooks/use-features";
import { formatMoney } from "@/lib/format-money";
import type { ListQuery, MerchantRow, MerchantsResponse } from "@/types/api";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length <= 1) {
    return <span className="text-xs text-text-muted">—</span>;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 60},${20 - ((v - min) / range) * 18}`)
    .join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PAGE_SIZE = 10;

function MerchantsTab() {
  const [query, setQuery] = useState<ListQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
    sort: "total",
    dir: "desc",
  });
  const { data, isLoading, isFetching } = useMerchantsTable(query);

  const summary = data?.summary;
  const rows = data?.rows ?? [];

  const kpis = [
    {
      label: "Top merchant",
      value: summary?.topMerchant?.name ?? "—",
      sub: summary?.topMerchant ? formatMoney(summary.topMerchant.total) : "",
    },
    {
      label: "Most visited",
      value: summary?.mostVisited?.name ?? "—",
      sub: summary?.mostVisited ? `${summary.mostVisited.visits} visits` : "",
    },
    {
      label: "Fastest growing",
      value: summary?.fastestGrowing?.name ?? "—",
      sub: summary?.fastestGrowing
        ? `${summary.fastestGrowing.trend > 0 ? "+" : ""}${summary.fastestGrowing.trend}% MoM`
        : "",
    },
    {
      label: "Merchants tracked",
      value: `${summary?.merchantCount ?? 0}`,
      sub: summary ? `${formatMoney(summary.totalSpend)} total` : "",
    },
  ];

  const columns: DataTableColumn<MerchantRow>[] = [
    {
      id: "name",
      header: "Merchant",
      sortable: true,
      render: (m) => (
        <span className="flex items-center gap-2 font-semibold text-text">
          <span>{m.emoji}</span>
          {m.name}
        </span>
      ),
    },
    {
      id: "visits",
      header: "Visits",
      align: "right",
      sortable: true,
      render: (m) => <span className="text-text-muted">{m.visits}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortable: true,
      render: (m) => <span className="font-semibold text-text">{formatMoney(m.total)}</span>,
    },
    {
      id: "avgTransaction",
      header: "Avg",
      align: "right",
      sortable: true,
      render: (m) => <span className="text-text-muted">{formatMoney(m.avgTransaction)}</span>,
    },
    {
      id: "trend",
      header: "Trend",
      align: "right",
      sortable: true,
      render: (m) => (
        <span className={`font-semibold ${m.trend > 0 ? "text-danger" : "text-success"}`}>
          {m.trend > 0 ? "+" : ""}
          {m.trend}%
        </span>
      ),
    },
    {
      id: "trail",
      header: "6-mo",
      align: "right",
      render: (m) => (
        <span className="flex justify-end">
          <Sparkline data={m.trail} color={m.trend > 0 ? "#ef4444" : "#22c55e"} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <p className="text-[11px] font-medium text-text-muted">{k.label}</p>
            <p className="mt-1 truncate text-base font-bold text-text">{k.value}</p>
            <p className="text-[11px] text-text-muted">{k.sub}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(m) => m.name}
        total={data?.total ?? 0}
        page={query.page ?? 1}
        pageSize={query.pageSize ?? PAGE_SIZE}
        sort={data?.sort ?? "total"}
        dir={data?.dir ?? "desc"}
        onSortChange={(sort, dir) => setQuery((q) => ({ ...q, sort, dir, page: 1 }))}
        onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
        onSearch={(q) => setQuery((prev) => ({ ...prev, q: q || undefined, page: 1 }))}
        searchValue={query.q}
        searchPlaceholder="Search merchants…"
        isLoading={isLoading}
        isFetching={isFetching}
        emptyMessage="No merchants match your filters yet."
      />
    </div>
  );
}

function IncomeTab({
  data,
  isLoading,
}: {
  data: MerchantsResponse | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <FeaturePanelLoading />;

  const INCOME_MONTHS = data?.income.months ?? [];
  const INCOME = data?.income.primary ?? [];
  const SIDE_INCOME = data?.income.side ?? [];
  const sources = data?.incomeSources ?? 0;

  if (INCOME.length === 0) {
    return (
      <FeatureEmptyState feature="income insights" variant="insufficient-data" />
    );
  }

  const totalIncome =
    INCOME.reduce((a, b) => a + b, 0) + SIDE_INCOME.reduce((a, b) => a + b, 0);
  const avgIncome = totalIncome / (INCOME_MONTHS.length || 1);
  const incomeMean = INCOME.reduce((a, b) => a + b, 0) / (INCOME.length || 1);
  const variance = incomeMean
    ? Math.round(
        (Math.sqrt(
          INCOME.reduce((s, v) => s + Math.pow(v - incomeMean, 2), 0) / INCOME.length,
        ) /
          incomeMean) *
          100,
      )
    : 0;
  const maxIncomeBar = Math.max(...INCOME.map((v, i) => v + (SIDE_INCOME[i] ?? 0)), 1);
  const lastSide = SIDE_INCOME[SIDE_INCOME.length - 1] ?? 0;
  const lastMonth = INCOME_MONTHS[INCOME_MONTHS.length - 1] ?? "this month";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Avg monthly income", value: money(Math.round(avgIncome)), color: "text-text" },
          { label: "Income stability", value: `${100 - variance}%`, color: variance < 10 ? "text-success" : "text-warning" },
          { label: "Side income (6mo)", value: money(SIDE_INCOME.reduce((a, b) => a + b, 0)), color: "text-success" },
          { label: "Sources", value: `${sources}`, color: "text-text" },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <p className="text-[11px] font-medium text-text-muted">{k.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-bold text-text">Income by month (primary + side)</p>
        <div className="flex h-44 items-end gap-3">
          {INCOME_MONTHS.map((mo, i) => {
            const primary = INCOME[i] ?? 0;
            const side = SIDE_INCOME[i] ?? 0;
            return (
              <div key={mo} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[var(--radius-xs)]" style={{ height: `${((primary + side) / maxIncomeBar) * 150}px` }}>
                  <div className="w-full bg-primary" style={{ height: `${(primary / (primary + side)) * 100}%` }} />
                  {side > 0 && <div className="w-full bg-success" style={{ height: `${(side / (primary + side)) * 100}%` }} />}
                </div>
                <span className="text-[10px] text-text-muted">{mo}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Salary</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Side income</span>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm font-bold text-text">💡 Income insight</p>
        <p className="mt-1 text-sm text-text-muted">
          Your income is <strong>{100 - variance}% stable</strong> month-to-month. Side income reached {money(lastSide)} in {lastMonth} — at this pace it could cover a recurring bill within a couple quarters.
        </p>
      </div>
    </div>
  );
}

export function MerchantsPanel() {
  const [tab, setTab] = useState<"merchants" | "income">("merchants");
  const gate = useFeaturePanelGate("merchant and income insights");
  const income = useMerchants();

  if (!gate.ready) return gate.node;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[
          { id: "merchants" as const, label: "Merchant analytics" },
          { id: "income" as const, label: "Income analytics" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === t.id ? "border-primary bg-primary-soft text-primary" : "border-border text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "merchants" ? (
        <MerchantsTab />
      ) : (
        <IncomeTab data={income.data} isLoading={income.isLoading} />
      )}
    </div>
  );
}
