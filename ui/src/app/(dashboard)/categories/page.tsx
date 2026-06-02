import { CategoriesBreakdown } from "@/components/categories/categories-breakdown";
import { TrendChart } from "@/components/charts/trend-chart";
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
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-text">Breakdown</h2>
        <p className="text-sm text-text-muted">
          Click a category to drill down into its transactions
        </p>
      </header>

      <CategoriesBreakdown categories={categories.categories} />

      <section aria-label="Category trends" className="grid gap-4 lg:grid-cols-2">
        {trends.trends.slice(0, 4).map((trend) => (
          <div key={trend.name}>
            <h3 className="mb-2 text-base font-semibold text-text">
              {trend.name}
            </h3>
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
