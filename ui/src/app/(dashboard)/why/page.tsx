"use client";

import { useMemo, useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Why Tagger is a planned feature. Data shown is illustrative.</span>
  </div>
);

const REASONS = [
  { id: "need", emoji: "✅", label: "Needed it", color: "#22c55e" },
  { id: "treat", emoji: "🎉", label: "Treat", color: "#a855f7" },
  { id: "social", emoji: "👥", label: "Social", color: "#3b82f6" },
  { id: "bored", emoji: "😐", label: "Bored", color: "#f59e0b" },
  { id: "stress", emoji: "😣", label: "Stress", color: "#ef4444" },
  { id: "impulse", emoji: "⚡", label: "Impulse", color: "#ec4899" },
] as const;

type ReasonId = (typeof REASONS)[number]["id"];

interface Txn {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  emoji: string;
  defaultReason?: ReasonId;
}

const INITIAL: Txn[] = [
  { id: "t1", merchant: "DoorDash", amount: 38.4, date: "Today, 11:42pm", emoji: "🍔", defaultReason: "stress" },
  { id: "t2", merchant: "Amazon", amount: 64.99, date: "Today, 2:15pm", emoji: "📦", defaultReason: "impulse" },
  { id: "t3", merchant: "Whole Foods", amount: 112.3, date: "Yesterday", emoji: "🛒", defaultReason: "need" },
  { id: "t4", merchant: "Bar Louie", amount: 56.0, date: "Yesterday", emoji: "🍻", defaultReason: "social" },
  { id: "t5", merchant: "Steam", amount: 29.99, date: "2 days ago", emoji: "🎮", defaultReason: "bored" },
  { id: "t6", merchant: "Sephora", amount: 84.5, date: "3 days ago", emoji: "💄", defaultReason: "treat" },
];

// Pre-tagged history for the insights chart
const HISTORY: Record<ReasonId, number> = {
  need: 1840,
  treat: 420,
  social: 610,
  bored: 290,
  stress: 540,
  impulse: 480,
};

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function WhyPage() {
  const [tags, setTags] = useState<Record<string, ReasonId>>(
    Object.fromEntries(INITIAL.filter((t) => t.defaultReason).map((t) => [t.id, t.defaultReason!])),
  );

  const setTag = (txnId: string, reason: ReasonId) =>
    setTags((t) => ({ ...t, [txnId]: reason }));

  const emotionalTotal = HISTORY.stress + HISTORY.bored + HISTORY.impulse;
  const totalSpend = Object.values(HISTORY).reduce((a, b) => a + b, 0);
  const emotionalPct = Math.round((emotionalTotal / totalSpend) * 100);

  const breakdown = useMemo(
    () => REASONS.map((r) => ({ ...r, total: HISTORY[r.id] })).sort((a, b) => b.total - a.total),
    [],
  );
  const maxReason = Math.max(...breakdown.map((b) => b.total));

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Hero insight */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Emotional spending this month</p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{emotionalPct}%</p>
        <p className="mt-1 text-sm text-white/70">
          {money(emotionalTotal)} of your {money(totalSpend)} discretionary spend was tagged <strong>stress</strong>, <strong>bored</strong>, or <strong>impulse</strong>. Late-night stress orders are your #1 trigger.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Tag inbox */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <p className="mb-1 text-sm font-bold text-text">Why did you buy these?</p>
          <p className="mb-3 text-[11px] text-text-muted">Tap a reason — patterns build over time.</p>
          <div className="space-y-3">
            {INITIAL.map((t) => (
              <div key={t.id} className="rounded-[var(--radius-sm)] border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-text">{t.merchant}</p>
                      <p className="text-[11px] text-text-muted">{t.date}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-text">{money(t.amount)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REASONS.map((r) => {
                    const active = tags[t.id] === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setTag(t.id, r.id)}
                        style={active ? { background: r.color, borderColor: r.color, color: "white" } : undefined}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                          active ? "" : "border-border text-text-muted hover:text-text"
                        }`}
                      >
                        <span>{r.emoji}</span>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-bold text-text">Spend by reason (30 days)</p>
            <div className="space-y-2.5">
              {breakdown.map((b) => (
                <div key={b.id}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-text-muted">{b.emoji} {b.label}</span>
                    <span className="font-semibold text-text tabular-nums">{money(b.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full" style={{ width: `${(b.total / maxReason) * 100}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm font-bold text-text">🔍 Pattern detected</p>
            <p className="mt-1 text-sm text-text-muted">
              Your stress spending happens 78% of the time between 9pm–1am. A 10-minute &ldquo;cool-off&rdquo; reminder on late-night checkouts could save an estimated <strong>$310/mo</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
