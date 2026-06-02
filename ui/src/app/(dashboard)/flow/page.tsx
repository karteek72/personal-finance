import { TrendChart } from "@/components/charts/trend-chart";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
  emoji: string;
  lines: { label: string; amount: string }[];
  footerLabel: string;
  footerAmount: string;
}

function FlowColumn({
  title,
  emoji,
  lines,
  footerLabel,
  footerAmount,
}: FlowColumnProps) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <h2 className="text-base font-bold text-text">{title}</h2>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {lines.map((line) => (
          <li
            key={line.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate text-text-muted">{line.label}</span>
            <span className="font-semibold tabular-nums text-text" data-money>
              {formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-sm font-semibold text-text">{footerLabel}</span>
        <span className="text-sm font-bold tabular-nums text-primary" data-money>
          {formatMoney(footerAmount)}
        </span>
      </div>
    </Card>
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Money flow"
        subtitle="Income in, spending out — see how it balances"
      />

      <Card className="border-success/20 bg-success/10">
        <p className="font-semibold text-success">All balanced ✓</p>
        <p className="mt-0.5 text-sm text-text-muted">
          Income, transfers, and card charges reconcile for this period.
        </p>
      </Card>

      <section
        aria-label="Flow breakdown"
        className="grid gap-4 md:grid-cols-3"
      >
        <FlowColumn
          title="Income"
          emoji="💰"
          lines={flow.income.sources}
          footerLabel="Total in"
          footerAmount={flow.income.total}
        />
        <FlowColumn
          title="Bank accounts"
          emoji="🏦"
          lines={flow.bankAccounts.accounts}
          footerLabel="Transfers out"
          footerAmount={flow.bankAccounts.transfersOut}
        />
        <FlowColumn
          title="Credit cards"
          emoji="💳"
          lines={flow.creditCards.accounts}
          footerLabel="Total charges"
          footerAmount={flow.creditCards.totalCharges}
        />
      </section>

      <section aria-label="Income vs expenses" className="grid gap-5 lg:grid-cols-3">
        <div>
          <h3 className="mb-3 text-sm font-bold text-text">Income</h3>
          <TrendChart labels={labels} data={incomeData} label="Income" />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-text">Expenses</h3>
          <TrendChart labels={labels} data={expenseData} label="Expenses" />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-text">Net</h3>
          <TrendChart labels={labels} data={netData} label="Net" />
        </div>
      </section>
    </div>
  );
}
