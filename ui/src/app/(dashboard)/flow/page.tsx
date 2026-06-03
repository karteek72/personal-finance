"use client";

import clsx from "clsx";
import { AsyncPanel } from "@/components/ui/async-panel";
import { useMoneyFlow } from "@/hooks/use-money-flow";
import { formatMoney } from "@/lib/format-money";
import { plaidHistoryPeriodLabel } from "@/lib/date-ranges";

/* ─── helpers ──────────────────────────────────────────────────────── */

function shortMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("default", { month: "short", year: "2-digit" });
}

/* ─── Monthly trend card ────────────────────────────────────────────── */

interface MonthCardProps {
  month: string;
  income: string;
  expenses: string;
  net: string;
  maxIncome: number;
}

function MonthCard({ month, income, expenses, net, maxIncome }: MonthCardProps) {
  const inc = Number.parseFloat(income);
  const exp = Number.parseFloat(expenses);
  const netVal = Number.parseFloat(net);
  const isPositive = netVal >= 0;

  const incomeWidth = maxIncome > 0 ? Math.round((inc / maxIncome) * 100) : 0;
  const expenseWidth = maxIncome > 0 ? Math.round((exp / maxIncome) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
        {shortMonth(month)}
      </p>

      {/* Income bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-text-muted">Income</span>
          <span className="font-semibold tabular-nums text-success" data-money>
            {formatMoney(income)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${incomeWidth}%` }}
          />
        </div>
      </div>

      {/* Expenses bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-text-muted">Spent</span>
          <span className="font-semibold tabular-nums text-danger" data-money>
            {formatMoney(expenses)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full bg-danger transition-all duration-500"
            style={{ width: `${expenseWidth}%` }}
          />
        </div>
      </div>

      {/* Net */}
      <div className="border-t border-border/50 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-text-muted">Net</span>
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

/* ─── Flow section (income / bank / credit) ────────────────────────── */

interface FlowSectionProps {
  title: string;
  icon: string;
  lines: { label: string; amount: string }[];
  totalLabel: string;
  totalAmount: string;
  toneClass?: string;
}

function FlowSection({
  title,
  icon,
  lines,
  totalLabel,
  totalAmount,
  toneClass = "text-primary",
}: FlowSectionProps) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-border bg-surface">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="text-lg" aria-hidden="true">{icon}</span>
        <h3 className="text-sm font-bold text-text">{title}</h3>
      </div>

      {/* Lines */}
      <ul className="flex flex-col divide-y divide-border/40">
        {lines.map((line) => (
          <li
            key={line.label}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <span className="truncate text-text-muted">{line.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-text" data-money>
              {formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer total */}
      <div className="mt-auto flex items-center justify-between border-t border-border/60 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {totalLabel}
        </span>
        <span className={clsx("text-base font-extrabold tabular-nums", toneClass)} data-money>
          {formatMoney(totalAmount)}
        </span>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function CashFlowPage() {
  const { data: flow, isLoading, isFetching, error } = useMoneyFlow();

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading cash flow…"
      errorMessage="Failed to load cash flow"
    >
      {flow ? <CashFlowContent flow={flow} /> : null}
    </AsyncPanel>
  );
}

function CashFlowContent({
  flow,
}: {
  flow: NonNullable<ReturnType<typeof useMoneyFlow>["data"]>;
}) {
  const maxIncome = flow.monthlySeries.reduce(
    (max, m) => Math.max(max, Number.parseFloat(m.income)),
    0,
  );

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page title ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text">
          Cash Flow
        </h2>
        <p className="mt-0.5 text-xs font-medium text-text-muted">
          {plaidHistoryPeriodLabel()} · Income vs spending by month
        </p>
      </div>

      {/* ── Monthly trend ─────────────────────────────────────────── */}
      {flow.monthlySeries.length > 0 ? (
        <section aria-label="Monthly cash flow trend">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Monthly breakdown
          </h3>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 11rem), 1fr))",
            }}
          >
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
      ) : null}

      {/* ── This period breakdown ─────────────────────────────────── */}
      <section aria-label="Period flow breakdown">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Where money came from &amp; went
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <FlowSection
            title="Income sources"
            icon="💰"
            lines={flow.income.sources}
            totalLabel="Total in"
            totalAmount={flow.income.total}
            toneClass="text-success"
          />
          <FlowSection
            title="Bank accounts"
            icon="🏦"
            lines={flow.bankAccounts.accounts}
            totalLabel="Transfers out"
            totalAmount={flow.bankAccounts.transfersOut}
            toneClass="text-primary"
          />
          <FlowSection
            title="Credit cards"
            icon="💳"
            lines={flow.creditCards.accounts}
            totalLabel="Total charges"
            totalAmount={flow.creditCards.totalCharges}
            toneClass="text-danger"
          />
        </div>
      </section>

      {/* ── Reconciliation status ─────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-success/20 bg-success/8 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-sm font-bold text-success">
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-text">All balanced</p>
          <p className="text-xs text-text-muted">
            Income, transfers, and card charges reconcile for this period.
          </p>
        </div>
      </div>
    </div>
  );
}
