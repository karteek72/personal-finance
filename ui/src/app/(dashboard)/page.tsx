"use client";

import { AlertBanner } from "@/components/ui/alert-banner";
import { Card } from "@/components/ui/card";
import { SpendAnalyticsPanel } from "@/components/charts/spend-analytics-panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { AsyncPanel } from "@/components/ui/async-panel";
import { useAlerts } from "@/hooks/use-alerts";
import { useSummary } from "@/hooks/use-summary";
import { plaidHistoryDateRange } from "@/lib/date-ranges";
import { formatMoney } from "@/lib/format-money";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { from, to } = plaidHistoryDateRange();
  const {
    data: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    error: summaryError,
  } = useSummary(from, to);
  const {
    data: alerts,
    isLoading: alertsLoading,
    isFetching: alertsFetching,
  } = useAlerts();

  const isLoading = summaryLoading || alertsLoading;
  const isFetching = summaryFetching || alertsFetching;

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={summaryError}
      loadingMessage="Loading dashboard…"
      errorMessage="Failed to load dashboard data"
    >
      {summary && alerts ? (
        <DashboardContent summary={summary} alerts={alerts} />
      ) : null}
    </AsyncPanel>
  );
}

function DashboardContent({
  summary,
  alerts,
}: {
  summary: NonNullable<ReturnType<typeof useSummary>["data"]>;
  alerts: NonNullable<ReturnType<typeof useAlerts>["data"]>;
}) {
  const netSavings = Number.parseFloat(summary.netSavings);
  const isPositive = netSavings >= 0;

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

      <SpendAnalyticsPanel />
    </div>
  );
}
