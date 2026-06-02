import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { PageHeader } from "@/components/ui/page-header";
import { fetchJsonServer } from "@/lib/api-server";
import type { CategoriesResponse } from "@/types/api";

function defaultDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year - 1}-01-01`, to: `${year}-12-31` };
}

export default async function CategoriesPage() {
  const { from, to } = defaultDateRange();
  const categories = await fetchJsonServer<CategoriesResponse>(
    `/transactions/by-category?from=${from}&to=${to}`,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Where your money goes"
        subtitle="Filter by account or category — charts update live"
      />

      <CategoryAnalyticsPanel initialCategories={categories.categories} />
    </div>
  );
}
