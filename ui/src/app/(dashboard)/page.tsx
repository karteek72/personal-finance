import { AlertBanner } from "@/components/ui/alert-banner";
import { Card } from "@/components/ui/card";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
  const netSavings = Number.parseFloat(summary.netSavings);
  const isPositive = netSavings >= 0;

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
    <div className="flex flex-col gap-5">
      <Card
        padding="lg"
        className="overflow-hidden border-0 text-text-inverse"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-sm font-medium opacity-90">{getGreeting()} 👋</p>
        <p className="mt-1 text-sm opacity-80">Your net savings this year</p>
        <p
          className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl"
          data-money
        >
          {formatMoney(summary.netSavings)}
        </p>
        <p className="mt-2 text-sm opacity-80">
          {isPositive
            ? "You're in the green — keep it up"
            : "Spending's ahead of income — worth a look"}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              Spent
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums" data-money>
              {formatMoney(summary.totalSpent)}
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              Income
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums" data-money>
              {formatMoney(summary.income)}
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              Avg / mo
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums" data-money>
              {formatMoney(summary.avgMonthlySpend)}
            </p>
          </div>
        </div>
      </Card>

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

      <section aria-label="Quick stats" className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Top category"
          value={formatMoney(summary.topCategory.amount)}
          subtext={summary.topCategory.name}
          tone="primary"
          compact
        />
        <KpiCard
          label="CC payments excluded"
          value={formatMoney(summary.ccPaymentsExcluded)}
          compact
        />
      </section>

      <section aria-label="Monthly spend trend">
        <h3 className="mb-3 text-base font-bold text-text">Monthly spend</h3>
        <TrendChart
          labels={monthlySpend.labels}
          data={monthlySpend.data}
          label="Spend"
        />
      </section>

      <section
        aria-label="Category and account breakdown"
        className="grid gap-5 lg:grid-cols-2"
      >
        <div>
          <h3 className="mb-3 text-base font-bold text-text">Where it went</h3>
          <DonutChart segments={donutSegments} />
        </div>
        <div>
          <h3 className="mb-3 text-base font-bold text-text">By account</h3>
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
