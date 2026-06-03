"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { SpendAnalyticsPanel } from "@/components/charts/spend-analytics-panel";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricGrid } from "@/components/ui/metric-grid";
import { AsyncPanel } from "@/components/ui/async-panel";
import {
  DrilldownDrawer,
  type DrilldownConfig,
} from "@/components/ui/drilldown-drawer";
import { AccountBalanceSummary } from "@/components/accounts/account-balance-summary";
import { WrappedBanner } from "@/components/preview/wrapped-banner";
import { useSummary } from "@/hooks/use-summary";
import {
  plaidHistoryDateRange,
  plaidHistoryPeriodLabel,
} from "@/lib/date-ranges";
import { formatMoney } from "@/lib/format-money";

export default function DashboardPage() {
  const { from, to } = plaidHistoryDateRange();
  const {
    data: summary,
    isLoading,
    isFetching,
    error,
  } = useSummary(from, to);

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading dashboard…"
      errorMessage="Failed to load dashboard data"
    >
      {summary ? (
        <DashboardContent summary={summary} />
      ) : null}
    </AsyncPanel>
  );
}

function DashboardContent({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useSummary>["data"]>;
}) {
  const [drilldown, setDrilldown] = useState<DrilldownConfig | null>(null);
  const closeDrilldown = useCallback(() => setDrilldown(null), []);

  const netSavings = Number.parseFloat(summary.netSavings);
  const isPositive = netSavings >= 0;
  const savingsRatePct = (summary.savingsRate * 100).toFixed(1);

  const savingsRateTone =
    summary.savingsRate >= 0.2
      ? "success"
      : summary.savingsRate >= 0.05
        ? "warning"
        : "danger";

  function openDrilldown(config: DrilldownConfig) {
    setDrilldown(config);
  }

  return (
    <>
      <div className="flex flex-col gap-4">

        {/* ── Period context (greeting lives in TopBar) ─────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-text-muted sm:text-sm">
            {plaidHistoryPeriodLabel()}
          </p>
          <Link
            href="/transactions"
            className="shrink-0 self-start rounded-[var(--radius-pill)] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-primary/40 hover:text-primary sm:self-auto"
          >
            All transactions →
          </Link>
        </div>

        {/* ── Wrapped (seasonal) ────────────────────────────────── */}
        <WrappedBanner />

        {/* ── Net Savings hero ──────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-[var(--radius-card)] p-4 text-white sm:p-6"
          style={{ background: "var(--gradient-hero)" }}
        >
          {/* Decorative circles */}
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-8 right-20 h-28 w-28 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
                Net Savings
              </p>
              <p
                className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl"
                data-money
              >
                {formatMoney(summary.netSavings)}
              </p>
              <p className="mt-2 text-sm text-white/75">
                {isPositive
                  ? "You're in the green — keep it up"
                  : "Spending's ahead of income — worth a look"}
              </p>
            </div>

            {/* Savings rate badge */}
            <div
              className={`mt-3 self-start rounded-[var(--radius-pill)] px-4 py-2 sm:mt-0 sm:self-auto ${
                isPositive
                  ? "bg-white/20"
                  : "bg-danger/30"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Savings rate
              </p>
              <p className="text-xl font-extrabold tabular-nums">
                {savingsRatePct}%
              </p>
            </div>
          </div>
        </div>

        {/* ── Spent / Income row ────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() =>
              openDrilldown({
                title: "Expenses",
                subtitle: `All expense transactions · ${plaidHistoryPeriodLabel()}`,
                filters: { type: "expense" },
                viewAllHref: "/transactions?type=expense",
              })
            }
            className="group flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-surface p-3 text-left transition-all hover:border-danger/30 hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                aria-hidden="true"
              />
              Spent
            </p>
            <p className="truncate text-lg font-extrabold tabular-nums tracking-tight text-danger sm:text-2xl" data-money>
              {formatMoney(summary.totalSpent)}
            </p>
            <p className="truncate text-[11px] text-text-muted">
              {formatMoney(summary.avgMonthlySpend)}/mo avg
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              openDrilldown({
                title: "Income",
                subtitle: `All income transactions · ${plaidHistoryPeriodLabel()}`,
                filters: { type: "income" },
                viewAllHref: "/transactions?type=income",
              })
            }
            className="group flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-surface p-3 text-left transition-all hover:border-success/30 hover:bg-success/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                aria-hidden="true"
              />
              Income
            </p>
            <p className="truncate text-lg font-extrabold tabular-nums tracking-tight text-success sm:text-2xl" data-money>
              {formatMoney(summary.income)}
            </p>
            <p className="truncate text-[11px] text-text-muted">
              {summary.transactionCount} transactions
            </p>
          </button>
        </div>

        {/* ── KPI strip ─────────────────────────────────────────── */}
        <MetricGrid minColumnWidth="8.5rem">
          <KpiCard
            label="Savings rate"
            value={`${savingsRatePct}%`}
            subtext="of income saved"
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
                },
                viewAllHref: `/transactions?category=${encodeURIComponent(summary.topCategory.name)}&type=expense`,
              })
            }
          />
          <KpiCard
            label="CC transfers out"
            value={formatMoney(summary.ccPaymentsExcluded)}
            subtext="excluded from spending"
            compact
            onClick={() =>
              openDrilldown({
                title: "Credit Card Payments",
                subtitle: "Inter-account transfers excluded from spending",
                filters: { type: "transfer" },
                viewAllHref: "/transactions?type=transfer",
              })
            }
          />
          {summary.pendingCount > 0 ? (
            <KpiCard
              label="Pending"
              value={String(summary.pendingCount)}
              subtext="not yet settled"
              tone="warning"
              compact
              onClick={() =>
                openDrilldown({
                  title: "Pending Transactions",
                  subtitle: "Not yet settled — amounts may change",
                  filters: {},
                  viewAllHref: "/transactions",
                })
              }
            />
          ) : null}
        </MetricGrid>

        {/* ── Account balance summary ───────────────────────────── */}
        <AccountBalanceSummary />

        {/* ── Analytics charts ─────────────────────────────────── */}
        <SpendAnalyticsPanel onOpenDrilldown={openDrilldown} />
      </div>

      <DrilldownDrawer config={drilldown} onClose={closeDrilldown} />
    </>
  );
}
