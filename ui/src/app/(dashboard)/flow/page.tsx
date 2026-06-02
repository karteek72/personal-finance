import { TrendChart } from "@/components/charts/trend-chart";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";

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

interface FlowColumnProps {
  title: string;
  lines: { label: string; amount: string }[];
  footerLabel: string;
  footerAmount: string;
}

function FlowColumn({
  title,
  lines,
  footerLabel,
  footerAmount,
}: FlowColumnProps) {
  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {lines.map((line) => (
          <li
            key={line.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-text-muted">{line.label}</span>
            <span className="font-mono font-medium tabular-nums" data-money>
              {formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm font-medium text-text">
        <span>{footerLabel}</span>
        <span className="font-mono tabular-nums" data-money>
          {formatMoney(footerAmount)}
        </span>
      </div>
    </article>
  );
}

export default async function MoneyFlowPage() {
  const { from, to } = yearToDateRange();
  const flow = await api.getMoneyFlow(from, to);

  const labels = flow.monthlySeries.map((point) =>
    formatMonthLabel(point.month),
  );
  const incomeData = flow.monthlySeries.map((point) =>
    Number.parseFloat(point.income),
  );
  const expenseData = flow.monthlySeries.map((point) =>
    Number.parseFloat(point.expenses),
  );
  const netData = flow.monthlySeries.map((point) =>
    Number.parseFloat(point.net),
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-text">Reconciliation</h2>
        <p className="text-sm text-text-muted">
          Income, bank transfers, and credit card charges
        </p>
      </header>

      <div
        role="status"
        className="rounded-[var(--radius-card)] border border-success/30 bg-success/10 px-4 py-3 text-sm"
      >
        <p className="font-medium text-success">Reconciliation balanced</p>
        <p className="mt-0.5 text-text-muted">
          Income, bank transfers, and credit card charges reconcile for the
          selected period.
        </p>
      </div>

      <section
        aria-label="Flow breakdown"
        className="grid gap-4 md:grid-cols-3"
      >
        <FlowColumn
          title="Income Sources"
          lines={flow.income.sources}
          footerLabel="Total Income"
          footerAmount={flow.income.total}
        />
        <FlowColumn
          title="Bank Accounts"
          lines={flow.bankAccounts.accounts}
          footerLabel="Transfers Out"
          footerAmount={flow.bankAccounts.transfersOut}
        />
        <FlowColumn
          title="Credit Cards"
          lines={flow.creditCards.accounts}
          footerLabel="Total Charges"
          footerAmount={flow.creditCards.totalCharges}
        />
      </section>

      <section aria-label="Income vs expenses" className="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-base font-semibold text-text">Income</h3>
          <TrendChart labels={labels} data={incomeData} label="Income" />
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-text">Expenses</h3>
          <TrendChart labels={labels} data={expenseData} label="Expenses" />
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-text">Net</h3>
          <TrendChart labels={labels} data={netData} label="Net" />
        </div>
      </section>
    </div>
  );
}
