"use client";

import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { AsyncPanel } from "@/components/ui/async-panel";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/use-categories";

export default function CategoriesPage() {
  const { data, isLoading, isFetching, error } = useCategories();

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading categories…"
      errorMessage="Failed to load categories"
    >
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Where your money goes"
          subtitle="Filter by account or category — charts update live"
        />

        <CategoryAnalyticsPanel
          initialCategories={data?.categories ?? []}
        />
      </div>
    </AsyncPanel>
  );
}
