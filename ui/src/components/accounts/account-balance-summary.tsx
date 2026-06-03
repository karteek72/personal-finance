"use client";

import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAccounts } from "@/hooks/use-accounts";
import { formatMoney } from "@/lib/format-money";
import type { Account } from "@/types/api";

interface AccountGroup {
  label: string;
  type: Account["type"];
  emoji: string;
  accounts: Account[];
  total: number;
  /** Credit accounts show balance as "owed" — flip sign for display */
  invertSign: boolean;
}

function buildGroups(accounts: Account[]): AccountGroup[] {
  const depository = accounts.filter((a) => a.type === "depository");
  const credit = accounts.filter((a) => a.type === "credit");
  const investment = accounts.filter((a) => a.type === "investment");

  const sum = (accs: Account[], field: keyof Account = "balanceCurrent") =>
    accs.reduce((s, a) => s + Number.parseFloat((a[field] as string) ?? "0"), 0);

  const groups: AccountGroup[] = [];

  if (depository.length > 0) {
    groups.push({
      label: "Cash & Savings",
      type: "depository",
      emoji: "🏦",
      accounts: depository,
      total: sum(depository),
      invertSign: false,
    });
  }

  if (credit.length > 0) {
    groups.push({
      label: "Credit Cards",
      type: "credit",
      emoji: "💳",
      accounts: credit,
      // current balance on credit = amount owed (positive = owed)
      total: sum(credit),
      invertSign: false,
    });
  }

  if (investment.length > 0) {
    groups.push({
      label: "Investments",
      type: "investment",
      emoji: "📈",
      accounts: investment,
      total: sum(investment),
      invertSign: false,
    });
  }

  return groups;
}

const typeTone: Record<Account["type"], string> = {
  depository: "text-success",
  credit: "text-danger",
  investment: "text-primary",
};

const typeBg: Record<Account["type"], string> = {
  depository: "bg-success/8 border-success/20",
  credit: "bg-danger/8 border-danger/20",
  investment: "bg-primary-soft/50 border-primary/20",
};

export function AccountBalanceSummary() {
  const { data, isLoading } = useAccounts();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[var(--radius-card)] bg-border/30"
          />
        ))}
      </div>
    );
  }

  const accounts = data?.accounts ?? [];
  if (accounts.length === 0) return null;

  const groups = buildGroups(accounts);

  return (
    <section aria-label="Account balances">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Account Balances
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {groups.map((group) => (
          <button
            key={group.type}
            type="button"
            onClick={() => router.push("/accounts")}
            className={clsx(
              "group flex flex-col rounded-[var(--radius-card)] border px-4 py-3 text-left transition-opacity hover:opacity-80",
              typeBg[group.type],
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-muted">
                {group.emoji} {group.label}
              </span>
              <svg
                aria-hidden
                className="h-3 w-3 text-text-muted/50 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p
              className={clsx(
                "mt-1 text-xl font-bold tabular-nums tracking-tight",
                typeTone[group.type],
              )}
              data-money
            >
              {formatMoney(group.total.toFixed(2))}
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">
              {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
