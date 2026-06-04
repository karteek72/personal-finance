"use client";

import { useEffect, useRef, useState } from "react";

import { FeatureEmptyState } from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useRecurring } from "@/hooks/use-features";

interface PastHabit {
  id: string;
  emoji: string;
  category: string;
  spent: number; // total spent over the lookback
  yearsAgo: number;
  // Hypothetical value if invested in S&P 500 instead
  investedValue: number;
}

const LOOKBACK_YEARS = 3;
// Approx S&P 500 growth multiple over the lookback (illustrative)
const INVEST_MULTIPLE = 1.45;

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function TimeMachinePanel() {
  const gate = useFeaturePanelGate("money time machine");
  const { data } = useRecurring();
  const [selected, setSelected] = useState<string[]>([]);
  const seeded = useRef(false);

  const HABITS: PastHabit[] = (data?.leaks.habits ?? []).map((h) => {
    const spent = Number.parseFloat(h.monthly) * 12 * LOOKBACK_YEARS;
    return {
      id: h.id,
      emoji: h.emoji ?? "💸",
      category: h.label,
      spent,
      yearsAgo: LOOKBACK_YEARS,
      investedValue: Math.round(spent * INVEST_MULTIPLE),
    };
  });

  useEffect(() => {
    if (HABITS.length > 0 && !seeded.current) {
      seeded.current = true;
      setSelected(HABITS.slice(0, 2).map((h) => h.id));
    }
  }, [HABITS]);

  if (!gate.ready) return gate.node;
  if (HABITS.length === 0) {
    return <FeatureEmptyState feature="money time machine" variant="insufficient-data" />;
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const chosen = HABITS.filter((h) => selected.includes(h.id));
  const totalSpent = chosen.reduce((s, h) => s + h.spent, 0);
  const totalInvested = chosen.reduce((s, h) => s + h.investedValue, 0);
  const missedGain = totalInvested - totalSpent;

  // Future projection of the missed gain (compounded forward 20y at 7%)
  const future20 = totalInvested * Math.pow(1.07, 20);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">If you&apos;d invested instead of spent…</p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{money(totalInvested)}</p>
        <p className="mt-1 text-sm text-white/70">
          The {money(totalSpent)} you spent on selected habits over the last 3 years would be worth <strong>{money(totalInvested)}</strong> today in an S&P 500 index fund — a missed gain of <strong>{money(missedGain)}</strong>.
        </p>
      </div>

      {/* Habit selector */}
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
                  <p className="text-[11px] text-text-muted">would-be worth {money(h.investedValue)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison + future */}
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
                <div className="h-full rounded-full bg-danger" style={{ width: `${(totalSpent / totalInvested) * 100}%` }} />
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
          <p className="mb-1 text-sm font-bold text-text">Fast-forward 20 years</p>
          <p className="text-[11px] text-text-muted">If left to compound at 7%/yr from today</p>
          <p className="mt-3 text-4xl font-extrabold tabular-nums text-text">{money(future20)}</p>
          <p className="mt-1 text-sm text-text-muted">
            The same habits, redirected to investing going forward, turn into a meaningful chunk of your future net worth.
          </p>
        </div>
      </div>
    </div>
  );
}
