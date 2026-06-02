import { AlertBanner } from "@/components/ui/alert-banner";
import { DonutChart } from "@/components/charts/donut-chart";
import { KpiCard } from "@/components/ui/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { api } from "@/lib/api-client";
import { getCategoryColor } from "@/lib/category-colors";
import { formatMoney } from "@/lib/format-money";
import type { TrendsResponse } from "@/types/api";

function yearToDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function formatMonthLabel(month: string): string {
  const [, monthPart] = month.split("-");
  const monthIndex = Number.parseInt(monthPart ?? "1", 10) - 1;
  return new Date(2000, monthIndex, 1).toLocaleString("en-US", {
    month: "short",
  });
}

function aggregateMonthlySpend(trends: TrendsResponse): {
  labels: string[];
  data: number[];
} {
  const monthTotals = new Map<string, number>();

  for (const trend of trends.trends) {
    for (const point of trend.months) {
      const current = monthTotals.get(point.month) ?? 0;
      monthTotals.set(
        point.month,
        current + Number.parseFloat(point.amount),
      );
    }
  }

  const sorted = [...monthTotals.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return {
    labels: sorted.map(([month]) => formatMonthLabel(month)),
    data: sorted.map(([, total]) => total),
  };
}

export default async function DashboardPage() {
  const { from, to } = yearToDateRange();

  const [summary, alerts, categories, trends, accounts] = await Promise.all([
    api.getSummary(from, to),
    api.getAlerts(),
    api.getCategories(from, to),
    api.getTrends(from, to),
    api.getAccounts(),
  ]);

  const monthlySpend = aggregateMonthlySpend(trends);

  const donutSegments = categories.categories.map((category) => ({
    label: category.name,
    value: Number.parseFloat(category.amount),
    color: getCategoryColor(category.name),
  }));

  const accountBar = accounts.accounts.map((account) => ({
    label: account.name,
    value: Number.parseFloat(account.balanceCurrent),
  }));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-text">Overview</h2>
        <p className="text-sm text-text-muted">
          Spending, income, and alerts for the current year
        </p>
      </header>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3"
      >
        <KpiCard
          label="Total Spent"
          value={formatMoney(summary.totalSpent)}
          tone="danger"
        />
        <KpiCard
          label="Income"
          value={formatMoney(summary.income)}
          tone="success"
        />
        <KpiCard
          label="Net Savings"
          value={formatMoney(summary.netSavings)}
          tone="primary"
        />
        <KpiCard
          label="Avg Monthly"
          value={formatMoney(summary.avgMonthlySpend)}
        />
        <KpiCard
          label="Top Category"
          value={formatMoney(summary.topCategory.amount)}
          subtext={summary.topCategory.name}
        />
        <KpiCard
          label="CC Payments Excluded"
          value={formatMoney(summary.ccPaymentsExcluded)}
        />
      </section>

      {alerts.alerts.length > 0 ? (
        <section aria-label="Alerts" className="flex flex-col gap-2">
          {alerts.alerts.map((alert) => (
            <AlertBanner
              key={alert.id}
              title={alert.title}
              message={alert.message}
              severity={alert.severity}
              dismissible={alert.dismissible}
            />
          ))}
        </section>
      ) : null}

      <section aria-label="Monthly spend trend">
        <h3 className="mb-2 text-base font-semibold text-text">
          Monthly Spend
        </h3>
        <TrendChart
          labels={monthlySpend.labels}
          data={monthlySpend.data}
          label="Spend"
        />
      </section>

      <section
        aria-label="Category and account breakdown"
        className="grid gap-4 lg:grid-cols-2"
      >
        <div>
          <h3 className="mb-2 text-base font-semibold text-text">
            Spending by Category
          </h3>
          <DonutChart segments={donutSegments} />
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-text">
            Spend by Account
          </h3>
          <TrendChart
            labels={accountBar.map((item) => item.label)}
            data={accountBar.map((item) => item.value)}
            label="Balance"
          />
        </div>
      </section>
    </div>
  );
}
