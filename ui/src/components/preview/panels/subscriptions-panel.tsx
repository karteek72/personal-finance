"use client";

import { Suspense } from "react";

import { parseLocalDate } from "@/lib/local-date";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useRecurring } from "@/hooks/use-features";
import { useListQueryUrl } from "@/hooks/use-list-query-url";
import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { formatMoney, formatMoneyValue } from "@/lib/format-money";
import type { RecurringItem } from "@/types/api";

const PAGE_SIZE = 10;

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SubscriptionsPanelContent() {
  const [query, setQuery] = useListQueryUrl({
    defaults: {
      page: 1,
      pageSize: PAGE_SIZE,
      sort: "amount",
      dir: "desc",
    },
    prefix: "sub",
  });
  const { data, isLoading, isFetching } = useRecurring(query);

  const rows = data?.subscriptions.rows ?? [];
  const total = data?.subscriptions.total ?? 0;

  if (!isLoading && total === 0) {
    return (
      <FeatureEmptyState
        feature="subscriptions"
        variant="insufficient-data"
      />
    );
  }

  const columns: DataTableColumn<RecurringItem>[] = [
    {
      id: "merchantName",
      header: "Subscription",
      sortable: true,
      render: (s) => (
        <span className="flex items-center gap-2 font-semibold text-text">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-xs font-bold text-white"
            style={{ background: s.brandColor ?? "#6366f1" }}
          >
            {s.merchantName.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {s.merchantName}
            {s.priceChanged ? (
              <span className="ml-2 text-[10px] font-bold text-danger">Price up</span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortable: true,
      render: (s) => <span className="text-text-muted">{s.category}</span>,
    },
    {
      id: "nextChargeDate",
      header: "Next charge",
      sortable: true,
      render: (s) => (
        <span className="text-text-muted">{shortDate(s.nextChargeDate)}</span>
      ),
    },
    {
      id: "amount",
      header: "Monthly",
      align: "right",
      sortable: true,
      render: (s) => (
        <span className="font-semibold text-text">
          {formatMoney(s.amount)}
          {s.priceChanged && s.previousAmount ? (
            <span className="ml-1 text-[10px] font-normal text-text-muted">
              (was {formatMoney(s.previousAmount)})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      sortable: true,
      render: (s) => (
        <span className="text-text-muted capitalize">{s.status.replace(/-/g, " ")}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Monthly total</p>
          <p className="mt-0.5 text-2xl font-extrabold text-text">
            {data ? formatMoney(data.monthlyTotal) : "—"}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Annual cost</p>
          <p className="mt-0.5 text-2xl font-extrabold text-text">
            {data ? formatMoney(data.annualTotal) : "—"}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Active subs</p>
          <p className="mt-0.5 text-2xl font-extrabold text-text">
            {data?.activeCount ?? 0}
          </p>
        </div>
      </div>

      {(data?.priceChanges ?? 0) > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-text">
          <strong>{data?.priceChanges}</strong> subscription
          {data?.priceChanges === 1 ? "" : "s"} raised prices recently — search or sort to review.
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.merchantName}
        total={total}
        page={query.page ?? 1}
        pageSize={query.pageSize ?? PAGE_SIZE}
        sort={data?.subscriptions.sort ?? "amount"}
        dir={data?.subscriptions.dir ?? "desc"}
        onSortChange={(sort, dir) => setQuery({ sort, dir, page: 1 })}
        onPageChange={(page) => setQuery({ page })}
        onSearch={(q) => setQuery({ q: q || undefined, page: 1 })}
        searchValue={query.q}
        searchPlaceholder="Search subscriptions…"
        isLoading={isLoading}
        isFetching={isFetching}
        emptyMessage="No subscriptions match your filters."
      />
    </div>
  );
}

export function SubscriptionsPanel() {
  return (
    <Suspense fallback={<FeaturePanelLoading />}>
      <SubscriptionsPanelContent />
    </Suspense>
  );
}
