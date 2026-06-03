"use client";

import clsx from "clsx";
import { CategoryAnalyticsPanel } from "@/components/charts/category-analytics-panel";
import { AsyncPanel } from "@/components/ui/async-panel";
import { PageHeader } from "@/components/ui/page-header";
import { useCategories } from "@/hooks/use-categories";
import { useMoneyFlow } from "@/hooks/use-money-flow";
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
            className="h-full rounded-full bg-success"
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
            className="h-full rounded-full bg-danger"
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

function MonthlyFlowStrip() {
  const { data: flow } = useMoneyFlow();

  if (!flow?.monthlySeries?.length) return null;

  const maxIncome = flow.monthlySeries.reduce(
    (max, m) => Math.max(max, Number.parseFloat(m.income)),
    0,
  );

  return (
    <section aria-label="Monthly cash flow overview">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Monthly overview
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {flow.monthlySeries.map((m) => (
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

export default function CategoriesPage() {
  const { data, isLoading, isFetching, error } = useCategories();

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading categories…"
      errorMessage="Failed to load categories"
    >
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Where your money goes"
          subtitle="Month-by-month overview, then drill into categories"
        />

        {/* Monthly cash-flow strip — loads independently */}
        <MonthlyFlowStrip />

        <CategoryAnalyticsPanel
          initialCategories={data?.categories ?? []}
        />
      </div>
    </AsyncPanel>
  );
}
