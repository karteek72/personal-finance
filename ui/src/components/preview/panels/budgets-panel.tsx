"use client";

import { useState } from "react";

import { useBudgets } from "@/hooks/use-features";

const FALLBACK_BUDGETS = [
  { category: "Food & Dining", emoji: "🍔", spent: 487, limit: 600, color: "#f97316" },
  { category: "Transport", emoji: "🚗", spent: 210, limit: 250, color: "#3b82f6" },
  { category: "Shopping", emoji: "🛍️", spent: 340, limit: 300, color: "#ef4444" },
  { category: "Entertainment", emoji: "🎬", spent: 89, limit: 150, color: "#a855f7" },
  { category: "Health & Fitness", emoji: "💪", spent: 55, limit: 80, color: "#22c55e" },
  { category: "Travel", emoji: "✈️", spent: 0, limit: 400, color: "#06b6d4" },
  { category: "Personal Care", emoji: "🧴", spent: 62, limit: 100, color: "#ec4899" },
];

const FALLBACK_GOALS = [
  { name: "Emergency Fund", target: 10000, current: 6420, deadline: "Dec 2026", color: "#22c55e", emoji: "🛡️" },
  { name: "Japan Trip", target: 4500, current: 1800, deadline: "Aug 2026", color: "#3b82f6", emoji: "✈️" },
  { name: "New MacBook", target: 2500, current: 2200, deadline: "Jul 2026", color: "#a855f7", emoji: "💻" },
];

const DEFAULT_BUDGET_COLOR = "#3b82f6";
const DEFAULT_GOAL_COLOR = "#22c55e";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function BudgetsPanel() {
  const [activeTab, setActiveTab] = useState<"budgets" | "goals">("budgets");
  const { data, isLoading } = useBudgets();

  const budgets = data?.budgets.length
    ? data.budgets.map((b) => ({
        category: b.category,
        emoji: b.emoji ?? "💸",
        spent: Number.parseFloat(b.spent),
        limit: Number.parseFloat(b.limit),
        color: b.color ?? DEFAULT_BUDGET_COLOR,
      }))
    : isLoading
      ? []
      : FALLBACK_BUDGETS;

  const goals = data?.goals.length
    ? data.goals.map((g) => ({
        name: g.name,
        emoji: g.emoji ?? "🎯",
        target: Number.parseFloat(g.target),
        current: Number.parseFloat(g.current),
        deadline: g.deadline ?? "—",
        color: g.color ?? DEFAULT_GOAL_COLOR,
      }))
    : isLoading
      ? []
      : FALLBACK_GOALS;

  const safeToSpend = data ? Number.parseFloat(data.safeToSpend) : 47;
  const daysRemaining = data?.daysRemaining ?? 27;
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-5">

      {/* Hero: Safe-to-Spend */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/70">Safe to spend today</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{formatMoney(safeToSpend)}</p>
          <p className="mt-1.5 text-sm text-white/70">
            After bills, goals & commitments — resets Friday
          </p>
          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-xs text-white/60">Monthly budget</p>
              <p className="text-base font-bold text-white">{formatMoney(totalBudget)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Spent so far</p>
              <p className="text-base font-bold text-white">{formatMoney(totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Days remaining</p>
              <p className="text-base font-bold text-white">{daysRemaining}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-1">
        {(["budgets", "goals"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-semibold capitalize transition-all ${
              activeTab === tab
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab === "budgets" ? "Category Budgets" : "Savings Goals"}
          </button>
        ))}
      </div>

      {activeTab === "budgets" && (
        <div className="space-y-3">
          {budgets.map((b) => {
            const pct = Math.min((b.spent / b.limit) * 100, 100);
            const over = b.spent > b.limit;
            return (
              <div
                key={b.category}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{b.emoji}</span>
                    <span className="text-sm font-semibold text-text">{b.category}</span>
                    {over && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        Over budget
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${over ? "text-danger" : "text-text"}`}>
                      {formatMoney(b.spent)}
                    </span>
                    <span className="text-xs text-text-muted"> / {formatMoney(b.limit)}</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: over ? "#ef4444" : b.color,
                    }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] text-text-muted">
                  {over
                    ? `${formatMoney(b.spent - b.limit)} over`
                    : `${formatMoney(b.limit - b.spent)} left`}
                </p>
              </div>
            );
          })}
          <button
            className="w-full rounded-[var(--radius-md)] border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary"
          >
            + Add category budget
          </button>
        </div>
      )}

      {activeTab === "goals" && (
        <div className="space-y-3">
          {goals.map((g) => {
            const pct = Math.min((g.current / g.target) * 100, 100);
            return (
              <div
                key={g.name}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
              >
                <div className="mb-1 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{g.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-text">{g.name}</p>
                      <p className="text-xs text-text-muted">Target: {g.deadline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-text">{formatMoney(g.current)}</p>
                    <p className="text-xs text-text-muted">of {formatMoney(g.target)}</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: g.color }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-text-muted">
                  <span>{pct.toFixed(0)}% complete</span>
                  <span>{formatMoney(g.target - g.current)} to go</span>
                </div>
              </div>
            );
          })}
          <button
            className="w-full rounded-[var(--radius-md)] border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary"
          >
            + Add savings goal
          </button>
        </div>
      )}
    </div>
  );
}
