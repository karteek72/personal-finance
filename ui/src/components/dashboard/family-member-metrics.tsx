"use client";

import Link from "next/link";

import { AsyncPanel } from "@/components/ui/async-panel";
import { Card } from "@/components/ui/card";
import { useHousehold, useHouseholdInsights } from "@/hooks/use-household";
import { formatMoney } from "@/lib/format-money";

interface FamilyMemberMetricsProps {
  from: string;
  to: string;
  periodLabel: string;
}

export function FamilyMemberMetrics({
  from,
  to,
  periodLabel,
}: FamilyMemberMetricsProps) {
  const { data: household } = useHousehold();
  const {
    data: insights,
    isLoading,
    isFetching,
    error,
  } = useHouseholdInsights(from, to);

  const membersWithAccounts =
    insights?.members.filter((member) => member.accountCount > 0) ?? [];

  if (!household || household.members.length <= 1) {
    return null;
  }

  if (!isLoading && membersWithAccounts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Family member income and spending">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-text">Family breakdown</h2>
          <p className="text-xs text-text-muted">
            Income vs spending by member · {periodLabel}
          </p>
        </div>
        <Link
          href="/family"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Manage family →
        </Link>
      </div>

      <AsyncPanel
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        loadingMessage="Loading family metrics…"
        errorMessage="Couldn't load family metrics."
      >
        {insights ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {membersWithAccounts.map((member) => {
              const spent = Number.parseFloat(member.totalSpent);
              const income = Number.parseFloat(member.totalIncome);
              const net = income - spent;
              const maxValue = Math.max(spent, income, 1);
              const spentPct = (spent / maxValue) * 100;
              const incomePct = (income / maxValue) * 100;

              return (
                <Card key={member.memberId} className="relative overflow-hidden">
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: member.avatarColor }}
                  />
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-text-inverse"
                      style={{ backgroundColor: member.avatarColor }}
                    >
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-text">
                        {member.displayName}
                      </h3>
                      <p className="text-xs text-text-muted">
                        {member.accountCount}{" "}
                        {member.accountCount === 1 ? "account" : "accounts"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase text-text-muted">
                        Net
                      </p>
                      <p
                        className={`text-base font-extrabold tabular-nums ${
                          net >= 0 ? "text-success" : "text-danger"
                        }`}
                        data-money
                      >
                        {formatMoney(net.toFixed(2))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-text-muted">
                        Income
                      </p>
                      <p
                        className="mt-0.5 text-lg font-extrabold tabular-nums text-success"
                        data-money
                      >
                        {formatMoney(member.totalIncome)}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-text-muted">
                        Spent
                      </p>
                      <p
                        className="mt-0.5 text-lg font-extrabold tabular-nums text-danger"
                        data-money
                      >
                        {formatMoney(member.totalSpent)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-[10px] font-semibold text-success">
                        In
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${incomePct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-[10px] font-semibold text-danger">
                        Out
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full bg-danger"
                          style={{ width: `${spentPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </AsyncPanel>
    </section>
  );
}
