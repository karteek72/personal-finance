"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Financial Time Machine is a planned feature. Returns are illustrative, not advice.</span>
  </div>
);

interface PastHabit {
  id: string;
  emoji: string;
  category: string;
  spent: number; // total spent over the lookback
  yearsAgo: number;
  // Hypothetical value if invested in S&P 500 instead
  investedValue: number;
}

const HABITS: PastHabit[] = [
  { id: "dining", emoji: "🍔", category: "Restaurants & takeout", spent: 8400, yearsAgo: 3, investedValue: 12180 },
  { id: "rideshare", emoji: "🚕", category: "Rideshare & taxis", spent: 3120, yearsAgo: 3, investedValue: 4520 },
  { id: "subs", emoji: "📺", category: "Unused subscriptions", spent: 1860, yearsAgo: 3, investedValue: 2700 },
  { id: "coffee", emoji: "☕", category: "Coffee shops", spent: 2240, yearsAgo: 3, investedValue: 3250 },
  { id: "impulse", emoji: "🛍️", category: "Impulse online buys", spent: 5100, yearsAgo: 3, investedValue: 7400 },
];

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function TimeMachinePanel() {
  const [selected, setSelected] = useState<string[]>(["dining", "impulse"]);

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
      {PREVIEW_BANNER}

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
