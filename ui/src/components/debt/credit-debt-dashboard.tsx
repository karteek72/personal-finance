"use client";

import Link from "next/link";

import { AsyncPanel } from "@/components/ui/async-panel";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useCreditDebtSummary } from "@/hooks/use-credit-debt";
import { formatMoney } from "@/lib/format-money";
import type { CreditCardDebtRow } from "@/types/api";

function formatDueLabel(daysUntilDue: number | null | undefined): string {
  if (daysUntilDue == null) {
    return "Due date unknown";
  }
  if (daysUntilDue < 0) {
    return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue`;
  }
  if (daysUntilDue === 0) {
    return "Due today";
  }
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}

function CreditCardDebtCard({ card }: { card: CreditCardDebtRow }) {
  const liability = card.liability;

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {card.institutionName}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold text-text">
            {card.name}
            {card.mask ? ` · ••${card.mask}` : ""}
          </h3>
        </div>
        {liability?.isOverdue ? (
          <span className="shrink-0 rounded-[var(--radius-pill)] bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase text-danger">
            Overdue
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-text-muted">Current balance</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-text" data-money>
            {formatMoney(card.balanceCurrent)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Statement balance</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-text" data-money>
            {liability?.lastStatementBalance
              ? formatMoney(liability.lastStatementBalance)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Minimum due</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-text" data-money>
            {liability?.minimumPaymentAmount
              ? formatMoney(liability.minimumPaymentAmount)
              : "—"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {formatDueLabel(liability?.daysUntilDue)}
            {liability?.nextPaymentDueDate
              ? ` · ${new Date(`${liability.nextPaymentDueDate}T00:00:00`).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Purchase APR</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-text">
            {liability?.purchaseApr ? `${liability.purchaseApr}%` : "—"}
          </p>
          {liability?.estimatedMonthlyInterest ? (
            <p className="mt-0.5 text-xs text-text-muted">
              ~{formatMoney(liability.estimatedMonthlyInterest)}/mo interest
            </p>
          ) : null}
        </div>
      </div>

      {liability?.statementVsCurrentDelta &&
      Number.parseFloat(liability.statementVsCurrentDelta) !== 0 ? (
        <p className="rounded-[var(--radius-sm)] bg-primary-soft/40 px-3 py-2 text-xs text-text-muted">
          {Number.parseFloat(liability.statementVsCurrentDelta) > 0
            ? `${formatMoney(liability.statementVsCurrentDelta)} above last statement — new charges since close`
            : `${formatMoney(String(Math.abs(Number.parseFloat(liability.statementVsCurrentDelta))))} below last statement — payments or credits applied`}
        </p>
      ) : null}

      {liability?.lastPaymentAmount && liability.lastPaymentDate ? (
        <p className="text-xs text-text-muted">
          Last payment {formatMoney(liability.lastPaymentAmount)} on{" "}
          {new Date(`${liability.lastPaymentDate}T00:00:00`).toLocaleDateString()}
        </p>
      ) : null}

      {!liability ? (
        <p className="text-xs text-text-muted">
          Statement details unavailable. Enable Plaid Liabilities and sync this card.
        </p>
      ) : null}
    </Card>
  );
}

export function CreditDebtDashboard() {
  const { data, isLoading, isFetching, error, refetch } = useCreditDebtSummary();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Credit & debt"
        subtitle="Statement balances, due dates, and interest — separate from daily spending"
        action={
          <Link
            href="/accounts"
            className="rounded-[var(--radius-pill)] bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-opacity hover:opacity-80 card-shadow"
          >
            Manage accounts
          </Link>
        }
      />

      <AsyncPanel
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        loadingMessage="Loading credit card details…"
        errorMessage="Couldn't load credit & debt summary."
      >
        {data ? (
          <>
            <p className="text-sm text-text-muted">{data.coverageLabel}</p>

            <section
              aria-label="Credit debt overview"
              className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              <KpiCard
                label="Current balance"
                value={formatMoney(data.totalCurrentBalance)}
                tone="danger"
                compact
              />
              <KpiCard
                label="Statement total"
                value={formatMoney(data.totalStatementBalance)}
                compact
              />
              <KpiCard
                label="Minimum due"
                value={formatMoney(data.totalMinimumDue)}
                tone="warning"
                compact
              />
              <KpiCard
                label="Est. monthly interest"
                value={formatMoney(data.totalEstimatedMonthlyInterest)}
                compact
              />
            </section>

            {data.overdueCount > 0 ? (
              <Card padding="sm" className="border-danger/30 bg-danger/5 text-sm text-danger">
                {data.overdueCount} card{data.overdueCount === 1 ? "" : "s"} report an overdue payment.
              </Card>
            ) : null}

            {data.cards.length === 0 ? (
              <Card padding="lg" className="text-center">
                <p className="text-lg font-bold text-text">No credit cards linked</p>
                <p className="mt-1 text-sm text-text-muted">
                  Connect a credit card from Wallet to track statement balances and due dates.
                </p>
                <Link
                  href="/accounts"
                  className="mt-4 inline-flex rounded-[var(--radius-pill)] bg-primary px-4 py-2 text-sm font-semibold text-text-inverse"
                >
                  Go to Wallet
                </Link>
              </Card>
            ) : (
              <section
                aria-label="Credit cards"
                className="grid gap-4 lg:grid-cols-2"
              >
                {data.cards.map((card) => (
                  <CreditCardDebtCard key={card.accountId} card={card} />
                ))}
              </section>
            )}
          </>
        ) : null}
      </AsyncPanel>
    </div>
  );
}
