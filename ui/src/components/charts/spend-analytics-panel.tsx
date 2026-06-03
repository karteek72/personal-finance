"use client";

import { useMemo, useState } from "react";

import { AsyncPanel } from "@/components/ui/async-panel";
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
import type { DrilldownConfig } from "@/components/ui/drilldown-drawer";

interface SpendAnalyticsPanelProps {
  onOpenDrilldown?: (config: DrilldownConfig) => void;
}

export function SpendAnalyticsPanel({ onOpenDrilldown }: SpendAnalyticsPanelProps) {
  const scope = useViewModeStore((state) => state.scope);
  const setScope = useViewModeStore((state) => state.setScope);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const { data: accountsData } = useAccounts();
  const { data: householdData } = useHousehold();
  const { data, isLoading, isFetching, error } = useChartData({
    accountId: selectedAccountId || undefined,
    category: selectedCategory || undefined,
    memberId: selectedMemberId || undefined,
    scope: selectedMemberId ? undefined : scope,
  });

  const categoryNames = useMemo(
    () => data?.byCategory.map((slice) => slice.name) ?? [],
    [data],
  );

  const hasActiveFilter =
    Boolean(selectedCategory) ||
    Boolean(selectedAccountId) ||
    Boolean(selectedMemberId);

  function clearFilters() {
    setSelectedAccountId("");
    setSelectedCategory("");
    setSelectedMemberId("");
  }

  function handleViewTransactions() {
    if (!onOpenDrilldown) return;
    const filterLabel = selectedCategory
      ? selectedCategory
      : selectedMemberId
        ? (householdData?.members.find((m) => m.id === selectedMemberId)?.displayName ?? "Member")
        : selectedAccountId
          ? (accountsData?.accounts.find((a) => a.id === selectedAccountId)?.name ?? "Account")
          : "All";
    onOpenDrilldown({
      title: filterLabel,
      subtitle: "Matching transactions from the selected filter",
      filters: {
        category: selectedCategory || undefined,
        accountId: selectedAccountId || undefined,
        memberId: selectedMemberId || undefined,
        type: "expense",
      },
      viewAllHref: `/transactions?${new URLSearchParams({
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(selectedAccountId ? { accountId: selectedAccountId } : {}),
        ...(selectedMemberId ? { memberId: selectedMemberId } : {}),
        type: "expense",
      }).toString()}`,
    });
  }

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading interactive charts…"
      errorMessage="Couldn't load chart data."
    >
      {data ? (
    <section aria-label="Interactive spending charts" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
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
        </div>
        {hasActiveFilter && onOpenDrilldown ? (
          <button
            type="button"
            onClick={handleViewTransactions}
            className="shrink-0 rounded-[var(--radius-pill)] bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            View transactions →
          </button>
        ) : null}
      </div>

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
      ) : null}
    </AsyncPanel>
  );
}
