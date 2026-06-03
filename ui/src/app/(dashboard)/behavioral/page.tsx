"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Behavioral Finance is a planned feature. Data shown is illustrative.</span>
  </div>
);

const PATTERNS = [
  { label: "Weekend spending", value: "+43%", description: "You spend 43% more on Saturdays and Sundays vs. weekdays", severity: "warning" },
  { label: "Post-payday splurge", value: "+67%", description: "In the 3 days after your paycheck, spending spikes 67%", severity: "warning" },
  { label: "Late-night orders", value: "$189/mo", description: "38% of your food delivery orders happen between 10pm–2am", severity: "neutral" },
  { label: "Stress spending", value: "+28%", description: "Shopping and dining surge on high-workload weeks", severity: "neutral" },
];

const CHALLENGES = [
  { title: "Dining budget cut", goal: "Reduce dining by 20% this month", progress: 62, days: 18, color: "#f97316" },
  { title: "No impulse over $50", goal: "Wait 24h before any purchase >$50", progress: 85, days: 6, color: "#22c55e" },
  { title: "Auto-savings streak", goal: "Automate $200 extra to savings", progress: 100, days: 0, color: "#a855f7", complete: true },
];

const HABIT_STREAKS = [
  { label: "Under budget", days: 12, max: 30, color: "#22c55e" },
  { label: "No food delivery", days: 5, max: 14, color: "#3b82f6" },
  { label: "Savings auto-transfer", days: 47, max: 60, color: "#a855f7" },
];

const CREEP_MONTHS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
const INCOME = [7200, 7200, 7600, 7600, 7600, 7600, 8100, 8100, 8100, 8100];
const SPENDING = [4800, 4900, 5200, 5400, 5600, 5700, 6100, 6300, 6400, 6520];

export default function BehavioralPage() {
  const [activeChallenge, setActiveChallenge] = useState<string | null>(null);

  const maxVal = Math.max(...INCOME, ...SPENDING);

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Spending personality */}
      <div
        className="rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Your spending archetype</p>
        <p className="mt-1 text-3xl font-extrabold text-white">The Foodie</p>
        <p className="mt-1 text-sm text-white/70">
          Dining & experiences drive 38% of your discretionary spend. You value memories over things. Cost: $14,200/yr — 11% above the median for your income bracket.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Dining</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Travel</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Entertainment</span>
        </div>
      </div>

      {/* Lifestyle creep chart */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Lifestyle creep detector</p>
            <p className="text-xs text-text-muted">Income vs. spending over 10 months</p>
          </div>
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
            Creep detected
          </span>
        </div>
        <div className="mt-3 flex h-20 items-end gap-1">
          {CREEP_MONTHS.map((m, i) => {
            const incPct = ((INCOME[i] ?? 0) / maxVal) * 72;
            const spndPct = ((SPENDING[i] ?? 0) / maxVal) * 72;
            return (
              <div key={m} className="flex flex-1 flex-col items-center gap-0.5">
                <div className="flex w-full flex-col items-center gap-0.5">
                  <div className="w-full space-y-0.5">
                    <div className="w-full rounded-sm" style={{ height: `${incPct}px`, background: "var(--color-success)", opacity: 0.3 }} />
                  </div>
                </div>
                <div className="absolute" style={{ height: `${spndPct}px` }} />
                <span className="text-[8px] text-text-muted">{m}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-success/40" />Income
          </span>
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ background: "var(--color-primary)" }} />Spending
          </span>
        </div>
        <p className="mt-2 rounded-[var(--radius-sm)] bg-warning/10 p-2 text-xs text-warning">
          Since your March raise (+$500/mo), spending grew $420/mo — your savings rate improved only $80/mo.
        </p>
      </div>

      {/* Emotional patterns */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Spending patterns detected</p>
        {PATTERNS.map((p) => (
          <div
            key={p.label}
            className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3.5"
          >
            <div className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.severity === "warning" ? "bg-warning/10 text-warning" : "bg-border text-text-muted"}`}>
              {p.value}
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{p.label}</p>
              <p className="text-xs text-text-muted">{p.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Habit streaks */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text">Habit streaks</p>
        <div className="space-y-3">
          {HABIT_STREAKS.map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-text">{s.label}</span>
                <span className="font-bold" style={{ color: s.color }}>{s.days} day streak</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full" style={{ width: `${(s.days / s.max) * 100}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day challenges */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Active challenges</p>
        {CHALLENGES.map((c) => (
          <div
            key={c.title}
            className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text">{c.title}</p>
                <p className="text-xs text-text-muted">{c.goal}</p>
              </div>
              {c.complete ? (
                <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success">Complete!</span>
              ) : (
                <span className="text-[10px] text-text-muted">{c.days}d left</span>
              )}
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: c.color }} />
            </div>
            <p className="mt-1 text-right text-[11px] text-text-muted">{c.progress}% complete</p>
          </div>
        ))}
        <button className="w-full rounded-[var(--radius-md)] border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary">
          + Start a new challenge
        </button>
      </div>

      {/* Counterfactual */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text mb-2">True cost calculator</p>
        <div className="space-y-2">
          {[
            { habit: "Daily coffee ($6)", annual: "$2,190", tenYear: "$27,000 if invested at 7% return" },
            { habit: "Food delivery (avg $35/order, 4x/wk)", annual: "$7,280", tenYear: "$91,000 if invested" },
          ].map((item) => (
            <div key={item.habit} className="rounded-[var(--radius-sm)] bg-surface-raised p-3">
              <p className="text-xs font-semibold text-text">{item.habit}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.annual}/yr · {item.tenYear}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
