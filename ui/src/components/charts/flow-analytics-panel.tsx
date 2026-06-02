"use client";

import { useMemo, useState } from "react";

import { ChartFilterBar } from "@/components/charts/chart-filter-bar";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";
import { InteractiveBarChart } from "@/components/charts/interactive-bar-chart";
import { useAccounts } from "@/hooks/use-accounts";
import { useChartData } from "@/hooks/use-chart-data";
import { formatMoney } from "@/lib/format-money";

export function FlowAnalyticsPanel() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: accountsData } = useAccounts();
  const { data, isLoading, error } = useChartData({
    accountId: selectedAccountId || undefined,
    category: selectedCategory || undefined,
  });

  const categoryNames = useMemo(
    () => data?.byCategory.map((slice) => slice.name) ?? [],
    [data],
  );

  if (isLoading) {
    return (
      <p className="text-sm text-text-muted">Loading flow charts…</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-danger">Couldn't load flow chart data.</p>
    );
  }

  return (
    <section aria-label="Interactive flow charts" className="flex flex-col gap-5">
      <ChartFilterBar
        accounts={accountsData?.accounts ?? []}
        categories={categoryNames}
        selectedAccountId={selectedAccountId}
        selectedCategory={selectedCategory}
        onAccountChange={setSelectedAccountId}
        onCategoryChange={setSelectedCategory}
        onClear={() => {
          setSelectedAccountId("");
          setSelectedCategory("");
        }}
      />

      <div className="grid gap-2 rounded-[var(--radius-card)] bg-primary-soft/40 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Income
          </p>
          <p className="text-lg font-bold tabular-nums text-success" data-money>
            {formatMoney(data.totals.income)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Expenses
          </p>
          <p className="text-lg font-bold tabular-nums text-text" data-money>
            {formatMoney(data.totals.expenses)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Net
          </p>
          <p className="text-lg font-bold tabular-nums text-primary" data-money>
            {formatMoney(data.totals.net)}
          </p>
        </div>
      </div>

      <InteractiveAreaChart monthly={data.monthly} />

      <InteractiveBarChart
        slices={data.byAccount}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
      />
    </section>
  );
}
