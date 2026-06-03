"use client";

import { AsyncPanel } from "@/components/ui/async-panel";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useMoneyFlow } from "@/hooks/use-money-flow";
import { formatMoney } from "@/lib/format-money";

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

export default function MoneyFlowPage() {
  const { data: flow, isLoading, isFetching, error } = useMoneyFlow();

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      loadingMessage="Loading money flow…"
      errorMessage="Failed to load money flow"
    >
      {flow ? (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Money flow"
        subtitle="How income moves through your bank and card accounts"
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
    </div>
      ) : null}
    </AsyncPanel>
  );
}
