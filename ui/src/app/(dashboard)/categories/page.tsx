"use client";

import { useState } from "react";
import clsx from "clsx";
import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { MerchantsPanel } from "@/components/preview/panels/merchants-panel";
import { PatternsPanel } from "@/components/preview/panels/patterns-panel";
import { AsyncPanel } from "@/components/ui/async-panel";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/use-categories";
import { useChartData } from "@/hooks/use-chart-data";
import { formatMoney } from "@/lib/format-money";

/* ─── Monthly cash-flow card ─────────────────────────────────────── */

interface MonthCardProps {
  month: string;
  income: string;
  expenses: string;
  net: string;
  maxIncome: number;
}

function shortMonth(yearMonth: string): string {
  const [year, mo] = yearMonth.split("-");
  return new Date(Number(year), Number(mo) - 1, 1).toLocaleString("default", {
    month: "short",
    year: "2-digit",
  });
}

function MonthCard({ month, income, expenses, net, maxIncome }: MonthCardProps) {
  const inc = Number.parseFloat(income);
  const exp = Number.parseFloat(expenses);
  const netVal = Number.parseFloat(net);
  const isPositive = netVal >= 0;

  const incW = maxIncome > 0 ? Math.round((inc / maxIncome) * 100) : 0;
  const expW = maxIncome > 0 ? Math.round((exp / maxIncome) * 100) : 0;

  return (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {shortMonth(month)}
      </p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-text-muted">Income</span>
          <span className="font-semibold tabular-nums text-success" data-money>
            {formatMoney(income)}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${incW}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-text-muted">Spent</span>
          <span className="font-semibold tabular-nums text-danger" data-money>
            {formatMoney(expenses)}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full bg-danger transition-all duration-500"
            style={{ width: `${expW}%` }}
          />
        </div>
      </div>

      <div className="border-t border-border/50 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">Net</span>
          <span
            className={clsx(
              "text-sm font-extrabold tabular-nums",
              isPositive ? "text-success" : "text-danger",
            )}
            data-money
          >
            {isPositive ? "+" : ""}
            {formatMoney(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Monthly flow strip ─────────────────────────────────────────── */

interface MonthlyFlowStripProps {
  accountId?: string;
}

function MonthlyFlowStrip({ accountId }: MonthlyFlowStripProps) {
  // Reuse the same useChartData call that CategoryAnalyticsPanel makes —
  // React Query deduplicates requests with identical keys.
  const { data } = useChartData({ accountId: accountId || undefined });

  if (!data?.monthly?.length) return null;

  const maxIncome = data.monthly.reduce(
    (max, m) => Math.max(max, Number.parseFloat(m.income)),
    0,
  );

  return (
    <section aria-label="Monthly cash flow overview">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Monthly overview
        {accountId ? (
          <span className="ml-1.5 font-normal normal-case text-text-muted/70">
            · filtered by account
          </span>
        ) : null}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {data.monthly.map((m) => (
          <MonthCard
            key={m.month}
            month={m.month}
            income={m.income}
            expenses={m.expenses}
            net={m.net}
            maxIncome={maxIncome}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "merchants", label: "Merchants" },
  { id: "patterns", label: "Patterns" },
] as const;

type SpendTab = (typeof TABS)[number]["id"];

function OverviewTab() {
  const { data, isLoading, isFetching, error } = useCategories();
  // Lifted up so MonthlyFlowStrip and CategoryAnalyticsPanel share the same filter
  const [selectedAccountId, setSelectedAccountId] = useState("");

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading categories…"
      errorMessage="Failed to load categories"
    >
      <div className="flex flex-col gap-5">
        {/* Monthly strip — filters with account selection */}
        <MonthlyFlowStrip accountId={selectedAccountId} />

        <CategoryAnalyticsPanel
          initialCategories={data?.categories ?? []}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
        />
      </div>
    </AsyncPanel>
  );
}

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<SpendTab>("overview");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Where your money goes"
        subtitle="Month-by-month overview, top merchants, and spending patterns"
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
              activeTab === t.id
                ? "bg-primary text-white"
                : "bg-surface-raised text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "merchants" && <MerchantsPanel />}
      {activeTab === "patterns" && <PatternsPanel />}
    </div>
  );
}
