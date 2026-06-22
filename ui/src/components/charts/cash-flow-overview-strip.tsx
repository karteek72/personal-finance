"use client";

import clsx from "clsx";

import { useChartData } from "@/hooks/use-chart-data";
import { analyticsPeriodLabel } from "@/lib/date-ranges";
import { formatMoney } from "@/lib/format-money";
import { SectionLoader } from "@/components/ui/section-loader";
import type { ChartMonthlyPoint, ChartYearlyPoint } from "@/types/api";

interface CashFlowPeriodCardProps {
  label: string;
  income: string;
  expenses: string;
  net: string;
  maxScale: number;
}

function CashFlowPeriodCard({
  label,
  income,
  expenses,
  net,
  maxScale,
}: CashFlowPeriodCardProps) {
  const inc = Number.parseFloat(income);
  const exp = Number.parseFloat(expenses);
  const netVal = Number.parseFloat(net);
  const isPositive = netVal >= 0;

  const incW =
    maxScale > 0 ? Math.min(100, Math.round((inc / maxScale) * 100)) : 0;
  const expW =
    maxScale > 0 ? Math.min(100, Math.round((exp / maxScale) * 100)) : 0;

  return (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {label}
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

function shortMonth(yearMonth: string): string {
  const [year, mo] = yearMonth.split("-");
  return new Date(Number(year), Number(mo) - 1, 1).toLocaleString("default", {
    month: "short",
    year: "2-digit",
  });
}

function maxScaleFromPoints(
  points: { income: string; expenses: string }[],
): number {
  return points.reduce((max, p) => {
    const inc = Number.parseFloat(p.income);
    const exp = Number.parseFloat(p.expenses);
    return Math.max(max, inc, exp);
  }, 0);
}

interface CashFlowStripProps {
  accountId?: string;
  ariaLabel: string;
  title: string;
  points: { key: string; label: string; income: string; expenses: string; net: string }[];
}

function CashFlowStrip({
  accountId,
  ariaLabel,
  title,
  points,
}: CashFlowStripProps) {
  if (points.length === 0) return null;

  const maxScale = maxScaleFromPoints(points);

  return (
    <section aria-label={ariaLabel}>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
        {accountId ? (
          <span className="ml-1.5 font-normal normal-case text-text-muted/70">
            · filtered by account
          </span>
        ) : null}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {points.map((p) => (
          <CashFlowPeriodCard
            key={p.key}
            label={p.label}
            income={p.income}
            expenses={p.expenses}
            net={p.net}
            maxScale={maxScale}
          />
        ))}
      </div>
    </section>
  );
}

interface OverviewStripsProps {
  accountId?: string;
  memberId?: string;
}

export function MonthlyCashFlowOverviewStrip({
  accountId,
  memberId,
}: OverviewStripsProps) {
  const { data, isLoading } = useChartData({
    accountId: accountId || undefined,
    memberId: memberId || undefined,
  });

  if (isLoading) {
    return <SectionLoader message="Loading monthly cash flow" />;
  }

  if (!data?.monthly?.length) {
    return (
      <p className="text-sm text-text-muted">No monthly cash flow data yet.</p>
    );
  }

  return (
    <CashFlowStrip
      accountId={accountId}
      ariaLabel="Monthly cash flow overview"
      title={analyticsPeriodLabel()}
      points={data.monthlyOverview.map((m: ChartMonthlyPoint) => ({
        key: m.month,
        label: shortMonth(m.month),
        income: m.income,
        expenses: m.expenses,
        net: m.net,
      }))}
    />
  );
}

export function YearlyCashFlowOverviewStrip({
  accountId,
  memberId,
}: OverviewStripsProps) {
  const { data, isLoading } = useChartData({
    accountId: accountId || undefined,
    memberId: memberId || undefined,
  });
  const yearly = data?.yearlyOverview ?? [];

  if (isLoading) {
    return <SectionLoader message="Loading yearly cash flow" />;
  }

  if (yearly.length < 2) {
    return null;
  }

  const sortedYears = [...(data?.yearly ?? [])].map((y) => y.year).sort();
  const firstYear = sortedYears[0]!;
  const lastYear = sortedYears[sortedYears.length - 1]!;
  const title =
    firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`;

  return (
    <CashFlowStrip
      accountId={accountId}
      ariaLabel="Yearly cash flow overview"
      title={`By year · ${title}`}
      points={yearly.map((y: ChartYearlyPoint) => ({
        key: y.year,
        label: y.year,
        income: y.income,
        expenses: y.expenses,
        net: y.net,
      }))}
    />
  );
}

export function CashFlowOverviewStrips({
  accountId,
  memberId,
}: OverviewStripsProps) {
  return (
    <div className="flex flex-col gap-5">
      <YearlyCashFlowOverviewStrip accountId={accountId} memberId={memberId} />
      <MonthlyCashFlowOverviewStrip accountId={accountId} memberId={memberId} />
    </div>
  );
}
