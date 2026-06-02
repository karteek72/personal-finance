"use client";

import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/use-categories";

export default function CategoriesPage() {
  const { data, isLoading, error } = useCategories();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted">
        Loading categories…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-danger">
        {error instanceof Error ? error.message : "Failed to load categories"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Where your money goes"
        subtitle="Filter by account or category — charts update live"
      />

      <CategoryAnalyticsPanel
        initialCategories={data?.categories ?? []}
      />
    </div>
  );
}
