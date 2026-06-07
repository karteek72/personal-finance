"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useBehavioral } from "@/hooks/use-features";
import { api } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";

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

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export function BehavioralPanel() {
  const gate = useFeaturePanelGate("behavioral insights");
  const queryClient = useQueryClient();
  const { data, isLoading } = useBehavioral();
  const [tags, setTags] = useState<Record<string, ReasonId>>({});
  const [pendingTxnId, setPendingTxnId] = useState<string | null>(null);

  const reasonTotals: Record<string, number> = useMemo(
    () =>
      Object.fromEntries(
        (data?.reasons ?? []).map((r) => [r.id, Number.parseFloat(r.total)]),
      ),
    [data?.reasons],
  );

  const breakdown = useMemo(
    () =>
      REASONS.map((r) => ({ ...r, total: reasonTotals[r.id] ?? 0 })).sort(
        (a, b) => b.total - a.total,
      ),
    [reasonTotals],
  );

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const tagInbox: Txn[] = (data?.taggedTransactions ?? []).map((t) => ({
    id: t.id,
    merchant: t.merchant,
    amount: Number.parseFloat(t.amount),
    date: t.date,
    emoji: "💳",
    defaultReason: t.reasonId ? (t.reasonId as ReasonId) : undefined,
  }));

  const activeReason = (txn: Txn): ReasonId | undefined =>
    tags[txn.id] ?? txn.defaultReason;

  async function handleTag(txn: Txn, reason: ReasonId): Promise<void> {
    const current = activeReason(txn);
    const clearing = current === reason;
    setPendingTxnId(txn.id);
    try {
      if (USE_MOCKS) {
        setTags((prev) => {
          const next = { ...prev };
          if (clearing) {
            delete next[txn.id];
          } else {
            next[txn.id] = reason;
          }
          return next;
        });
      } else if (clearing) {
        await api.clearTransactionReason(txn.id);
        setTags((prev) => {
          const next = { ...prev };
          delete next[txn.id];
          return next;
        });
        await queryClient.invalidateQueries({ queryKey: ["behavioral"] });
      } else {
        await api.setTransactionReason(txn.id, reason);
        setTags((prev) => ({ ...prev, [txn.id]: reason }));
        await queryClient.invalidateQueries({ queryKey: ["behavioral"] });
      }
    } catch (err) {
      notifications.push(
        "error",
        "Could not save reason",
        err instanceof Error ? err.message : "Try again in a moment.",
        "system",
      );
    } finally {
      setPendingTxnId(null);
    }
  }

  const archetype = data?.archetype ?? "—";
  const creepMonths = data?.creep.months ?? [];
  const income = (data?.creep.income ?? []).map((v) => Number.parseFloat(v));
  const spending = (data?.creep.spending ?? []).map((v) => Number.parseFloat(v));

  const challenges = (data?.challenges ?? []).map((c) => ({
    title: c.title,
    goal: c.goal,
    progress: c.progressPercent,
    days: c.daysRemaining,
    color: c.color ?? "#3b82f6",
    complete: c.complete,
  }));

  const streaks = (data?.streaks ?? []).map((s) => ({
    label: s.label,
    days: s.currentDays,
    max: s.maxDays,
    color: s.color ?? "#22c55e",
  }));

  const hasCreep = creepMonths.length > 0;
  const maxVal = Math.max(...income, ...spending, 1);
  const emotionalTotal =
    (reasonTotals.stress ?? 0) + (reasonTotals.bored ?? 0) + (reasonTotals.impulse ?? 0);
  const totalSpend = Object.values(reasonTotals).reduce((a, b) => a + b, 0);
  const emotionalPct = totalSpend > 0 ? Math.round((emotionalTotal / totalSpend) * 100) : 0;
  const topReasons = breakdown.filter((b) => b.total > 0).slice(0, 3);
  const hasReasonSpend = totalSpend > 0;

  return (
    <div className="space-y-5">
      {/* Spending personality */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Your spending archetype</p>
        <p className="mt-1 text-3xl font-extrabold text-white">{archetype}</p>
        {topReasons.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {topReasons.map((r) => (
              <span key={r.id} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                {r.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/70">
            Tag transactions with reasons to refine your spending personality.
          </p>
        )}
      </div>

      {/* Lifestyle creep chart */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Lifestyle creep detector</p>
            <p className="text-xs text-text-muted">Income vs. spending over 10 months</p>
          </div>
          {hasCreep && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">Creep detected</span>
          )}
        </div>
        {!hasCreep ? (
          <p className="mt-3 text-xs text-text-muted">Need more months of income and spending history.</p>
        ) : (
        <div className="mt-3 flex h-20 items-end gap-1">
          {creepMonths.map((m, i) => {
            const incPct = ((income[i] ?? 0) / maxVal) * 72;
            const spndPct = ((spending[i] ?? 0) / maxVal) * 72;
            return (
              <div key={m} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                <div className="relative flex w-full items-end justify-center" style={{ height: 72 }}>
                  <div className="w-full rounded-sm" style={{ height: `${incPct}px`, background: "var(--color-success)", opacity: 0.3 }} />
                  <div className="absolute bottom-0 w-1/2 rounded-sm" style={{ height: `${spndPct}px`, background: "var(--color-primary)" }} />
                </div>
                <span className="text-[8px] text-text-muted">{m}</span>
              </div>
            );
          })}
        </div>
        )}
        <div className="mt-2 flex gap-4 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-success/40" />Income
          </span>
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ background: "var(--color-primary)" }} />Spending
          </span>
        </div>
        {hasCreep && (
          <p className="mt-2 rounded-[var(--radius-sm)] bg-warning/10 p-2 text-xs text-warning">
            Compare income vs spending month over month to spot lifestyle creep.
          </p>
        )}
      </div>

      {/* Why tagging — emotional spending */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Emotional spending this month</p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{emotionalPct}%</p>
        <p className="mt-1 text-sm text-white/70">
          {totalSpend > 0 ? (
            <>
              {money(emotionalTotal)} of your {money(totalSpend)} discretionary spend was tagged{" "}
              <strong>stress</strong>, <strong>bored</strong>, or <strong>impulse</strong>.
            </>
          ) : (
            "Tag recent purchases to see how much of your spend is emotional."
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Tag inbox */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <p className="mb-1 text-sm font-bold text-text">Why did you buy these?</p>
          <p className="mb-3 text-[11px] text-text-muted">Tap a reason — patterns build over time.</p>
          <div className="space-y-3">
            {tagInbox.length === 0 && (
              <p className="text-xs text-text-muted">Tag recent transactions to build reason patterns.</p>
            )}
            {tagInbox.map((t) => (
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
                    const active = activeReason(t) === r.id;
                    const disabled = pendingTxnId === t.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => void handleTag(t, r.id)}
                        style={active ? { background: r.color, borderColor: r.color, color: "white" } : undefined}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-60 ${
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
            {!hasReasonSpend ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-border bg-bg px-3 py-4 text-center">
                <p className="text-sm font-semibold text-text">No tagged spend yet</p>
                <p className="mt-1 text-xs text-text-muted">
                  Tag purchases with why you bought them to see spend-by-reason. Bank data alone
                  cannot infer intent.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {breakdown.filter((b) => b.total > 0).map((b) => {
                  const maxReason = Math.max(...breakdown.map((row) => row.total), 1);
                  return (
                    <div key={b.id}>
                      <div className="mb-0.5 flex justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-text-muted">{b.emoji} {b.label}</span>
                        <span className="font-semibold text-text tabular-nums">{money(b.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full" style={{ width: `${(b.total / maxReason) * 100}%`, background: b.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Habit streaks */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text">Habit streaks</p>
        {streaks.length === 0 ? (
          <div className="rounded-[var(--radius-sm)] border border-dashed border-border bg-bg px-3 py-4 text-center">
            <p className="text-sm font-semibold text-text">No streaks yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Link accounts and wait for transactions to sync. Streaks track no-spend days,
              positive savings months, and time since dining spend.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {streaks.map((s) => (
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
        )}
      </div>

      {/* 30-day challenges */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Active challenges</p>
        {challenges.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface px-4 py-5 text-center">
            <p className="text-sm font-semibold text-text">No challenges yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Personalized challenges appear once there is enough spending history to suggest a
              realistic goal.
            </p>
          </div>
        ) : (
          challenges.map((c) => (
            <div key={c.title} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
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
          ))
        )}
        <button type="button" className="w-full rounded-[var(--radius-md)] border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary">
          + Start a new challenge
        </button>
      </div>
    </div>
  );
}
