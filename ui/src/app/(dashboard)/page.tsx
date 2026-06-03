"use client";

import { useCallback, useState } from "react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Card } from "@/components/ui/card";
import { SpendAnalyticsPanel } from "@/components/charts/spend-analytics-panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { AsyncPanel } from "@/components/ui/async-panel";
import {
  DrilldownDrawer,
  type DrilldownConfig,
} from "@/components/ui/drilldown-drawer";
import { AccountBalanceSummary } from "@/components/accounts/account-balance-summary";
import { useAlerts } from "@/hooks/use-alerts";
import { useSummary } from "@/hooks/use-summary";
import {
  plaidHistoryDateRange,
  plaidHistoryPeriodLabel,
} from "@/lib/date-ranges";
import { formatMoney } from "@/lib/format-money";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatSavingsRate(rate: number): string {
  const pct = (rate * 100).toFixed(1);
  return `${pct}%`;
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
        <DashboardContent summary={summary} alerts={alerts} from={from} to={to} />
      ) : null}
    </AsyncPanel>
  );
}

function DashboardContent({
  summary,
  alerts,
  from,
  to,
}: {
  summary: NonNullable<ReturnType<typeof useSummary>["data"]>;
  alerts: NonNullable<ReturnType<typeof useAlerts>["data"]>;
  from: string;
  to: string;
}) {
  const [drilldown, setDrilldown] = useState<DrilldownConfig | null>(null);
  const closeDrilldown = useCallback(() => setDrilldown(null), []);

  const netSavings = Number.parseFloat(summary.netSavings);
  const isPositive = netSavings >= 0;
  const savingsRateTone =
    summary.savingsRate >= 0.2
      ? "success"
      : summary.savingsRate >= 0.05
        ? "warning"
        : "danger";

  function openDrilldown(config: DrilldownConfig) {
    setDrilldown(config);
  }

  const baseDateFilter = { from, to };

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* ── Hero card ─────────────────────────────────────────── */}
        <Card
          padding="lg"
          className="overflow-hidden border-0 text-text-inverse"
          style={{ background: "var(--gradient-hero)" }}
        >
          <p className="text-sm font-medium opacity-90">{getGreeting()} 👋</p>
          <p className="mt-1 text-sm opacity-80">
            Net savings · {plaidHistoryPeriodLabel()}
          </p>
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
            <button
              type="button"
              onClick={() =>
                openDrilldown({
                  title: "Expenses",
                  subtitle: `All expense transactions · ${plaidHistoryPeriodLabel()}`,
                  filters: { type: "expense", ...baseDateFilter },
                  viewAllHref: `/transactions?type=expense`,
                })
              }
              className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 text-left backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Spent
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums" data-money>
                {formatMoney(summary.totalSpent)}
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                openDrilldown({
                  title: "Income",
                  subtitle: `All income transactions · ${plaidHistoryPeriodLabel()}`,
                  filters: { type: "income", ...baseDateFilter },
                  viewAllHref: `/transactions?type=income`,
                })
              }
              className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 text-left backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Income
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums" data-money>
                {formatMoney(summary.income)}
              </p>
            </button>
            <div className="rounded-[var(--radius-sm)] bg-white/15 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Avg spend / mo
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums" data-money>
                {formatMoney(summary.avgMonthlySpend)}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Alerts ────────────────────────────────────────────── */}
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

        {/* ── KPI grid ──────────────────────────────────────────── */}
        <section aria-label="Key metrics">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Key Metrics
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Savings rate"
              value={formatSavingsRate(summary.savingsRate)}
              tone={savingsRateTone}
              compact
            />
            <KpiCard
              label="Top category"
              value={formatMoney(summary.topCategory.amount)}
              subtext={summary.topCategory.name}
              tone="primary"
              compact
              onClick={() =>
                openDrilldown({
                  title: summary.topCategory.name,
                  subtitle: `Top spending category · ${plaidHistoryPeriodLabel()}`,
                  filters: {
                    category: summary.topCategory.name,
                    type: "expense",
                    ...baseDateFilter,
                  },
                  viewAllHref: `/transactions?category=${encodeURIComponent(summary.topCategory.name)}&type=expense`,
                })
              }
            />
            <KpiCard
              label="Transactions"
              value={String(summary.transactionCount)}
              subtext="expense txns in period"
              compact
              onClick={() =>
                openDrilldown({
                  title: "All Expenses",
                  subtitle: `${summary.transactionCount} expense transactions · ${plaidHistoryPeriodLabel()}`,
                  filters: { type: "expense", ...baseDateFilter },
                  viewAllHref: `/transactions?type=expense`,
                })
              }
            />
            <KpiCard
              label="CC payments excluded"
              value={formatMoney(summary.ccPaymentsExcluded)}
              subtext="transfer reconciliation"
              compact
              onClick={() =>
                openDrilldown({
                  title: "Credit Card Payments",
                  subtitle: "Inter-account transfers excluded from spending",
                  filters: { type: "transfer", ...baseDateFilter },
                  viewAllHref: `/transactions?type=transfer`,
                })
              }
            />
            {summary.pendingCount > 0 ? (
              <KpiCard
                label="Pending"
                value={String(summary.pendingCount)}
                subtext="transactions not yet settled"
                tone="warning"
                compact
                onClick={() =>
                  openDrilldown({
                    title: "Pending Transactions",
                    subtitle: "Not yet settled — amounts may change",
                    filters: { ...baseDateFilter },
                    viewAllHref: `/transactions`,
                  })
                }
              />
            ) : null}
          </div>
        </section>

        {/* ── Account balance summary ───────────────────────────── */}
        <AccountBalanceSummary />

        {/* ── Interactive analytics ────────────────────────────── */}
        <SpendAnalyticsPanel onOpenDrilldown={openDrilldown} />
      </div>

      <DrilldownDrawer config={drilldown} onClose={closeDrilldown} />
    </>
  );
}
