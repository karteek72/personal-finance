"use client";

import Link from "next/link";

import { useAccounts } from "@/hooks/use-accounts";
import { useNetWorth } from "@/hooks/use-features";
import type { Account } from "@/types/api";

function monthLabel(month: string): string {
  // month is "YYYY-MM"; render a short label like "May"
  const parts = month.split("-");
  const m = Number.parseInt(parts[1] ?? "", 10);
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return Number.isFinite(m) && m >= 1 && m <= 12 ? (names[m - 1] as string) : month;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function sum(accounts: Account[]) {
  return accounts.reduce((s, a) => s + Number.parseFloat(a.balanceCurrent ?? "0"), 0);
}

const TYPE_LABEL: Record<Account["type"], string> = {
  depository: "Cash & Savings",
  investment: "Investments",
  credit: "Credit Cards",
};

export function NetWorthPanel() {
  const { data, isLoading } = useAccounts();
  const { data: netWorthData } = useNetWorth();
  const accounts = data?.accounts ?? [];

  const trendData = (netWorthData?.trend ?? []).map((t) => ({
    month: monthLabel(t.month),
    value: Number.parseFloat(t.netWorth),
  }));
  const hasRealTrend = trendData.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-border/30" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-text">No accounts connected yet</p>
        <p className="mt-1 text-xs text-text-muted">Link a bank, card, or brokerage to see your net worth.</p>
        <Link
          href="/accounts"
          className="mt-4 inline-block rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-hero)" }}
        >
          Connect an account
        </Link>
      </div>
    );
  }

  const depository = accounts.filter((a) => a.type === "depository");
  const credit = accounts.filter((a) => a.type === "credit");
  const investment = accounts.filter((a) => a.type === "investment");

  const cash = sum(depository);
  const invested = sum(investment);
  const debt = sum(credit);
  const totalAssets = cash + invested;
  const netWorth = totalAssets - debt;

  const assetGroups = [
    { type: "depository" as const, accounts: depository, total: cash, color: "#22c55e" },
    { type: "investment" as const, accounts: investment, total: invested, color: "#3b82f6" },
  ].filter((g) => g.accounts.length > 0);

  const minVal = Math.min(...trendData.map((h) => h.value));
  const maxVal = Math.max(...trendData.map((h) => h.value));
  const range = maxVal - minVal;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-[var(--radius-lg)] p-6" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-sm font-medium text-white/70">Net Worth</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{fmt(netWorth)}</p>
        <div className="mt-4 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-white/60">Total assets</p>
            <p className="text-sm font-bold text-white">{fmt(totalAssets)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Total debt</p>
            <p className="text-sm font-bold text-white">{fmt(debt)}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Accounts</p>
            <p className="text-sm font-bold text-white">{accounts.length}</p>
          </div>
        </div>
      </div>

      {/* Trend chart — real net-worth snapshots when available */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text">Net worth trend</p>
        {hasRealTrend ? (
          <div className="flex h-24 items-end gap-2">
            {trendData.map((h, i) => {
              const heightPct = range === 0 ? 50 : ((h.value - minVal) / range) * 80 + 10;
              const isLatest = i === trendData.length - 1;
              return (
                <div key={`${h.month}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-[var(--radius-xs)] transition-all"
                    style={{ height: `${heightPct}px`, background: isLatest ? "var(--color-primary)" : "var(--color-border)" }}
                  />
                  <span className="text-[9px] text-text-muted">{h.month}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">
            Historical net-worth tracking starts once enough synced balance snapshots accumulate.
          </p>
        )}
      </div>

      {/* Assets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Assets</p>
          <p className="text-xs font-bold text-success">{fmt(totalAssets)}</p>
        </div>
        {assetGroups.map((group) => (
          <div key={group.type} className="space-y-2">
            <p className="px-1 text-[11px] font-medium text-text-muted">{TYPE_LABEL[group.type]}</p>
            {group.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />
                  <div>
                    <p className="text-sm font-semibold text-text">{a.name}</p>
                    <p className="text-xs text-text-muted">{a.institutionName}{a.mask ? ` ····${a.mask}` : ""}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-text">{fmt(Number.parseFloat(a.balanceCurrent ?? "0"))}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Liabilities */}
      {credit.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Liabilities</p>
            <p className="text-xs font-bold text-danger">−{fmt(debt)}</p>
          </div>
          {credit.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-danger" />
                <div>
                  <p className="text-sm font-semibold text-text">{a.name}</p>
                  <p className="text-xs text-text-muted">{a.institutionName}{a.mask ? ` ····${a.mask}` : ""}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-danger">−{fmt(Number.parseFloat(a.balanceCurrent ?? "0"))}</p>
            </div>
          ))}
          <Link href="/accounts" className="block px-1 text-[11px] font-semibold text-primary hover:underline">
            Manage credit &amp; debt →
          </Link>
        </div>
      )}
    </div>
  );
}
