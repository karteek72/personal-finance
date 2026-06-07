"use client";

import { useEffect, useRef, useState } from "react";

import { FeatureEmptyState } from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useInvestments, useRecurring } from "@/hooks/use-features";

interface PastHabit {
  id: string;
  emoji: string;
  category: string;
  spent: number;
  yearsAgo: number;
  investedValue: number;
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function TimeMachinePanel() {
  const gate = useFeaturePanelGate("money time machine");
  const { data } = useRecurring();
  const { data: investments } = useInvestments();
  const [selected, setSelected] = useState<string[]>([]);
  const seeded = useRef(false);

  const investmentHistory = investments?.investmentHistory ?? null;
  const timeMachine = data?.timeMachine ?? null;
  const lookbackYears = timeMachine?.lookbackYears ?? 3;
  const investMultiple = timeMachine?.investMultiple ?? 1.45;
  const futureRate = timeMachine?.futureCompoundRate ?? 0.07;
  const futureYears = timeMachine?.futureYears ?? 20;

  const HABITS: PastHabit[] = (timeMachine?.habits ?? []).map((h) => ({
    id: h.id,
    emoji: h.emoji ?? "💸",
    category: h.label,
    spent: Number.parseFloat(h.spent),
    yearsAgo: h.yearsAgo,
    investedValue: Number.parseFloat(h.investedValue),
  }));

  useEffect(() => {
    if (HABITS.length > 0 && !seeded.current) {
      seeded.current = true;
      setSelected(HABITS.slice(0, 2).map((h) => h.id));
    }
  }, [HABITS]);

  if (!gate.ready) return gate.node;
  if (HABITS.length === 0 && !investmentHistory) {
    return <FeatureEmptyState feature="money time machine" variant="insufficient-data" />;
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const chosen = HABITS.filter((h) => selected.includes(h.id));
  const totalSpent = chosen.reduce((s, h) => s + h.spent, 0);
  const totalInvested = chosen.reduce((s, h) => s + h.investedValue, 0);
  const missedGain = totalInvested - totalSpent;
  const future20 = totalInvested * Math.pow(1 + futureRate, futureYears);

  return (
    <div className="space-y-5">
      {investmentHistory ? (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <p className="text-sm font-bold text-text">Your brokerage history</p>
          <p className="mt-2 text-sm text-text-muted">
            Over the last {investmentHistory.lookbackYears} years you deployed{" "}
            <strong className="text-text">
              ${Number.parseFloat(investmentHistory.totalContributed).toLocaleString()}
            </strong>{" "}
            of cash into investments ({investmentHistory.buyTransactionCount} buys
            {investmentHistory.transactionCount > investmentHistory.buyTransactionCount
              ? ` plus ${investmentHistory.transactionCount - investmentHistory.buyTransactionCount} deposits`
              : ""}
            ). That&apos;s actual cash out the door — not contract notional or
            account transfers.
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Current portfolio value:{" "}
            <strong className="text-text">
              ${Number.parseFloat(investmentHistory.currentPortfolioValue).toLocaleString()}
            </strong>
          </p>
        </div>
      ) : null}

      {HABITS.length === 0 && investmentHistory ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface/50 p-4">
          <p className="text-sm font-bold text-text">Spending habits</p>
          <p className="mt-2 text-sm text-text-muted">
            The &quot;what if you&apos;d invested instead&quot; section needs
            categorized spending from your linked bank and card accounts. Import
            statements or connect Plaid — we&apos;ll detect coffee, dining,
            rideshare, and subscriptions automatically.
          </p>
        </div>
      ) : null}

      {HABITS.length > 0 ? (
        <>
          <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">If you&apos;d invested instead of spent…</p>
            <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{money(totalInvested)}</p>
            <p className="mt-1 text-sm text-white/70">
              The {money(totalSpent)} you spent on selected habits over the last {lookbackYears} years would be worth <strong>{money(totalInvested)}</strong> today if they had been invested in an S&P 500 index fund at an illustrative {investMultiple}× return — a hypothetical missed gain of <strong>{money(missedGain)}</strong> (not a personalized backtest).
            </p>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-bold text-text">Pick habits to rewind</p>
            <div className="space-y-2">
              {HABITS.map((h) => {
                const isOn = selected.includes(h.id);
                const gain = h.investedValue - h.spent;
                return (
                  <button
                    key={h.id}
                    onClick={() => toggle(h.id)}
                    className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-all ${
                      isOn ? "border-primary bg-primary-soft" : "border-border hover:border-text-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{h.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-text">{h.category}</p>
                        <p className="text-[11px] text-text-muted">Spent {money(h.spent)} over {h.yearsAgo} years</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-success">+{money(gain)}</p>
                      <p className="text-[11px] text-text-muted">would-be worth {money(h.investedValue)} (illustrative {investMultiple}×)</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <p className="mb-3 text-sm font-bold text-text">Spent vs. invested</p>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-text-muted">What you spent</span>
                    <span className="font-semibold text-text tabular-nums">{money(totalSpent)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-danger" style={{ width: `${totalInvested > 0 ? (totalSpent / totalInvested) * 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-text-muted">If invested (today)</span>
                    <span className="font-semibold text-text tabular-nums">{money(totalInvested)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-success" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <p className="mb-1 text-sm font-bold text-text">Fast-forward {futureYears} years</p>
              <p className="text-[11px] text-text-muted">If left to compound at {(futureRate * 100).toFixed(0)}%/yr from today</p>
              <p className="mt-3 text-4xl font-extrabold tabular-nums text-text">{money(future20)}</p>
              <p className="mt-1 text-sm text-text-muted">
                The same habits, redirected to investing going forward, turn into a meaningful chunk of your future net worth.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
