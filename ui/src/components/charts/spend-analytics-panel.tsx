"use client";

import { useMemo, useState } from "react";

import { ChartFilterBar } from "@/components/charts/chart-filter-bar";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";
import { InteractiveBarChart } from "@/components/charts/interactive-bar-chart";
import { InteractiveDonutChart } from "@/components/charts/interactive-donut-chart";
import { InteractiveMemberChart } from "@/components/charts/interactive-member-chart";
import { InteractiveMultiLineChart } from "@/components/charts/interactive-multi-line-chart";
import { useAccounts } from "@/hooks/use-accounts";
import { useChartData } from "@/hooks/use-chart-data";
import { useHousehold } from "@/hooks/use-household";
import { formatMoney } from "@/lib/format-money";
import { useViewModeStore } from "@/stores/view-mode-store";

export function SpendAnalyticsPanel() {
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

  function clearFilters() {
    setSelectedAccountId("");
    setSelectedCategory("");
    setSelectedMemberId("");
  }

  if (isLoading) {
    return (
      <p className="text-sm text-text-muted">Loading interactive charts…</p>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-danger">Couldn't load chart data.</p>
    );
  }

  return (
    <section aria-label="Interactive spending charts" className="flex flex-col gap-5">
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
        onClear={clearFilters}
      />

      <div className="grid gap-2 rounded-[var(--radius-card)] bg-primary-soft/40 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Spent
          </p>
          <p className="text-lg font-bold tabular-nums text-text" data-money>
            {formatMoney(data.totals.expenses)}
          </p>
        </div>
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
            Net
          </p>
          <p className="text-lg font-bold tabular-nums text-primary" data-money>
            {formatMoney(data.totals.net)}
          </p>
        </div>
      </div>

      <InteractiveAreaChart monthly={data.monthly} />

      <div className="grid gap-5 lg:grid-cols-2">
        <InteractiveMemberChart
          slices={data.byMember}
          selectedMemberId={selectedMemberId}
          onSelectMember={setSelectedMemberId}
        />
        <InteractiveDonutChart
          slices={data.byCategory}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      <InteractiveBarChart
        slices={data.byAccount}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
      />

      <InteractiveMultiLineChart
        trends={data.categoryTrends}
        highlightedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        title="Top categories over time"
        subtitle="Click a legend item to focus"
      />
    </section>
  );
}
