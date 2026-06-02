import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api-client";

function defaultDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year - 1}-01-01`, to: `${year}-12-31` };
}

export default async function CategoriesPage() {
  const { from, to } = defaultDateRange();
  const categories = await api.getCategories(from, to);

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
