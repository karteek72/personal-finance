import { CategoriesBreakdown } from "@/components/categories/categories-breakdown";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api-client";

function defaultDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year - 1}-01-01`, to: `${year}-12-31` };
}

function formatMonthLabel(month: string): string {
  const [, monthPart] = month.split("-");
  const monthIndex = Number.parseInt(monthPart ?? "1", 10) - 1;
  return new Date(2000, monthIndex, 1).toLocaleString("en-US", {
    month: "short",
  });
}

export default async function CategoriesPage() {
  const { from, to } = defaultDateRange();

  const [categories, trends] = await Promise.all([
    api.getCategories(from, to),
    api.getTrends(from, to),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Where your money goes"
        subtitle="Tap any category to see what's inside"
      />

      <CategoriesBreakdown categories={categories.categories} />

      <section aria-label="Category trends" className="grid gap-5 lg:grid-cols-2">
        {trends.trends.slice(0, 4).map((trend) => (
          <div key={trend.name}>
            <h3 className="mb-3 text-sm font-bold text-text">{trend.name}</h3>
            <TrendChart
              labels={trend.months.map((point) => formatMonthLabel(point.month))}
              data={trend.months.map((point) =>
                Number.parseFloat(point.amount),
              )}
              label={trend.name}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
