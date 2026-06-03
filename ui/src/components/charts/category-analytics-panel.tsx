"use client";

import { useMemo, useState } from "react";

import { CategoriesBreakdown } from "@/components/categories/categories-breakdown";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChartFilterBar } from "@/components/charts/chart-filter-bar";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";
import { InteractiveDonutChart } from "@/components/charts/interactive-donut-chart";
import { InteractiveMultiLineChart } from "@/components/charts/interactive-multi-line-chart";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
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
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(
    null,
  );

  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data, isLoading, isFetching } = useChartData({
    accountId: selectedAccountId || undefined,
    category: selectedCategory ?? undefined,
  });

  const categoryBreakdown = categoriesData?.categories ?? initialCategories;

  const displayCategories = useMemo((): CategoryTotal[] => {
    if (!data?.byCategory.length) {
      return categoryBreakdown;
    }

    const subMap = new Map(
      categoryBreakdown.map((cat) => [cat.name, cat.subcategories ?? []]),
    );

    return data.byCategory.map((slice) => ({
      name: slice.name,
      amount: slice.amount,
      percentage: slice.percentage,
      deltaVsPriorMonth: 0,
      subcategories: subMap.get(slice.name) ?? [],
    }));
  }, [data, categoryBreakdown]);

  const breakdownCategories = useMemo((): CategoryTotal[] => {
    if (!selectedCategory || !data?.bySubCategory?.length) {
      return displayCategories;
    }
    return displayCategories.map((cat) =>
      cat.name === selectedCategory
        ? {
            ...cat,
            subcategories: data.bySubCategory.map((sub) => ({
              name: sub.name,
              amount: sub.amount,
              percentage: sub.percentage,
            })),
          }
        : cat,
    );
  }, [displayCategories, selectedCategory, data?.bySubCategory]);

  const activeCategoryData = useMemo(
    () => breakdownCategories.find((c) => c.name === selectedCategory) ?? null,
    [breakdownCategories, selectedCategory],
  );

  const subcategorySlices = useMemo(() => {
    if (data?.bySubCategory?.length && selectedCategory) {
      return data.bySubCategory;
    }
    return activeCategoryData?.subcategories?.map((sub) => ({
      name: sub.name,
      amount: sub.amount,
      percentage: sub.percentage,
    })) ?? [];
  }, [data?.bySubCategory, activeCategoryData, selectedCategory]);

  const filterCategories = useMemo(
    () => displayCategories.map((category) => category.name),
    [displayCategories],
  );

  function handleSelectCategory(category: string | null) {
    setSelectedCategory(category);
    setSelectedSubCategory(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <ChartFilterBar
        accounts={accountsData?.accounts ?? []}
        categories={filterCategories}
        selectedAccountId={selectedAccountId}
        selectedCategory={selectedCategory ?? ""}
        onAccountChange={setSelectedAccountId}
        onCategoryChange={(category) =>
          handleSelectCategory(category || null)
        }
        onClear={() => {
          setSelectedAccountId("");
          handleSelectCategory(null);
        }}
      />

      {isFetching && !isLoading ? (
        <div
          className="flex items-center gap-2 text-sm text-text-muted"
          aria-live="polite"
        >
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
              handleSelectCategory(category || null)
            }
          />
          {selectedCategory && subcategorySlices.length > 0 ? (
            <InteractiveDonutChart
              slices={subcategorySlices}
              selectedCategory={selectedSubCategory ?? ""}
              onSelectCategory={(sub) =>
                setSelectedSubCategory(sub === selectedSubCategory ? null : sub || null)
              }
              parentCategory={selectedCategory}
              title={`${selectedCategory} breakdown`}
              subtitle="Click a slice to filter transactions"
            />
          ) : (
            <InteractiveAreaChart monthly={data.monthly} />
          )}
        </div>
      ) : null}

      {selectedCategory && subcategorySlices.length > 0 && data ? (
        <InteractiveAreaChart monthly={data.monthly} />
      ) : null}

      <InteractiveMultiLineChart
        trends={data?.categoryTrends ?? []}
        highlightedCategory={selectedCategory ?? undefined}
        onSelectCategory={(category) => handleSelectCategory(category || null)}
        title="Category trends"
        subtitle="Filters apply to all charts above"
      />

      <CategoriesBreakdown
        categories={breakdownCategories}
        selectedCategory={selectedCategory}
        selectedSubCategory={selectedSubCategory}
        onSelectCategory={handleSelectCategory}
        onSelectSubCategory={setSelectedSubCategory}
      />
    </div>
  );
}
