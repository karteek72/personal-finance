"use client";

import { useMemo, useState } from "react";

import { CategoriesBreakdown } from "@/components/categories/categories-breakdown";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChartFilterBar } from "@/components/charts/chart-filter-bar";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";
import { InteractiveDonutChart } from "@/components/charts/interactive-donut-chart";
import { InteractiveMultiLineChart } from "@/components/charts/interactive-multi-line-chart";
import { useAccounts } from "@/hooks/use-accounts";
import { useChartData } from "@/hooks/use-chart-data";
import type { CategoryTotal } from "@/types/api";

interface CategoryAnalyticsPanelProps {
  initialCategories?: CategoryTotal[];
}

export function CategoryAnalyticsPanel({
  initialCategories = [],
}: CategoryAnalyticsPanelProps) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: accountsData } = useAccounts();
  const { data, isLoading, isFetching } = useChartData({
    accountId: selectedAccountId || undefined,
    category: selectedCategory ?? undefined,
  });

  const displayCategories = useMemo(() => {
    if (data?.byCategory.length) {
      return data.byCategory.map((slice) => ({
        name: slice.name,
        amount: slice.amount,
        percentage: slice.percentage,
        deltaVsPriorMonth: 0,
      }));
    }
    return initialCategories;
  }, [data, initialCategories]);

  const filterCategories = useMemo(
    () => displayCategories.map((category) => category.name),
    [displayCategories],
  );

  return (
    <div className="flex flex-col gap-5">
      <ChartFilterBar
        accounts={accountsData?.accounts ?? []}
        categories={filterCategories}
        selectedAccountId={selectedAccountId}
        selectedCategory={selectedCategory ?? ""}
        onAccountChange={setSelectedAccountId}
        onCategoryChange={(category) =>
          setSelectedCategory(category || null)
        }
        onClear={() => {
          setSelectedAccountId("");
          setSelectedCategory(null);
        }}
      />

      {isFetching && !isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
          <LoadingSpinner size="sm" label="Updating charts" />
          Updating charts…
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <InteractiveDonutChart
            slices={data.byCategory}
            selectedCategory={selectedCategory ?? ""}
            onSelectCategory={(category) =>
              setSelectedCategory(category || null)
            }
          />
          <InteractiveAreaChart monthly={data.monthly} />
        </div>
      ) : null}

      <InteractiveMultiLineChart
        trends={data?.categoryTrends ?? []}
        highlightedCategory={selectedCategory ?? undefined}
        onSelectCategory={(category) =>
          setSelectedCategory(category || null)
        }
        title="Category trends"
        subtitle="Filters apply to all charts above"
      />

      <CategoriesBreakdown
        categories={displayCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
    </div>
  );
}
