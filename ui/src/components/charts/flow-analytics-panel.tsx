"use client";

import { useMemo, useState } from "react";

import { ChartFilterBar } from "@/components/charts/chart-filter-bar";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";
import { InteractiveBarChart } from "@/components/charts/interactive-bar-chart";
import { useAccounts } from "@/hooks/use-accounts";
import { useHousehold } from "@/hooks/use-household";
import { useChartData } from "@/hooks/use-chart-data";
import { formatMoney } from "@/lib/format-money";
import { useViewModeStore } from "@/stores/view-mode-store";

export function FlowAnalyticsPanel() {
  const scope = useViewModeStore((state) => state.scope);
  const setScope = useViewModeStore((state) => state.setScope);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const { data: accountsData } = useAccounts();
  const { data: householdData } = useHousehold();
  const { data, isLoading, error } = useChartData({
    accountId: selectedAccountId || undefined,
    category: selectedCategory || undefined,
    memberId: selectedMemberId || undefined,
    scope: selectedMemberId ? undefined : scope,
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
        members={householdData?.members ?? []}
        selectedAccountId={selectedAccountId}
        selectedCategory={selectedCategory}
        selectedMemberId={selectedMemberId}
        scope={scope}
        onScopeChange={setScope}
        onAccountChange={setSelectedAccountId}
        onCategoryChange={setSelectedCategory}
        onMemberChange={setSelectedMemberId}
        onClear={() => {
          setSelectedAccountId("");
          setSelectedCategory("");
          setSelectedMemberId("");
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
