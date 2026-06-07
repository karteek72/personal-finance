"use client";

import { useState } from "react";

import { useRecurring } from "@/hooks/use-features";

interface Sub {
  name: string;
  amount: number;
  category: string;
  nextDate: string;
  logo: string;
  color: string;
  changed: boolean;
  oldAmount: number;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SubscriptionsPanel() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { data, isLoading } = useRecurring();

  const subs: Sub[] = (data?.subscriptions ?? []).map((s) => ({
    name: s.merchantName,
    amount: Number.parseFloat(s.amount),
    category: s.category,
    nextDate: shortDate(s.nextChargeDate),
    logo: s.merchantName.slice(0, 1).toUpperCase(),
    color: s.brandColor ?? "#6366f1",
    changed: s.priceChanged,
    oldAmount: s.previousAmount ? Number.parseFloat(s.previousAmount) : 0,
  }));

  const active = subs.filter((s) => !dismissed.has(s.name));
  const monthly = active.reduce((sum, s) => sum + s.amount, 0);
  const annual = monthly * 12;
  const priceChanges = active.filter((s) => s.changed);

  if (!isLoading && subs.length === 0) {
    return <p className="text-xs text-text-muted">No recurring subscriptions detected yet.</p>;
  }

  return (
    <div className="space-y-5">

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Monthly total</p>
          <p className="mt-0.5 text-2xl font-extrabold text-text">
            ${monthly.toFixed(2)}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Annual cost</p>
          <p className="mt-0.5 text-2xl font-extrabold text-text">
            ${annual.toFixed(0)}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Active subs</p>
          <p className="mt-0.5 text-2xl font-extrabold text-text">{active.length}</p>
        </div>
      </div>

      {/* Price change alerts */}
      {priceChanges.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Price increases detected</p>
          {priceChanges.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-3"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-xs font-bold text-white"
                style={{ background: s.color }}
              >
                {s.logo}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">
                  {s.name} raised its price
                </p>
                <p className="text-xs text-text-muted">
                  ${s.oldAmount.toFixed(2)} → ${s.amount.toFixed(2)}/mo (+${(s.amount - s.oldAmount).toFixed(2)})
                </p>
              </div>
              <span className="text-xs font-semibold text-danger">+${((s.amount - s.oldAmount) * 12).toFixed(0)}/yr</span>
            </div>
          ))}
        </div>
      )}

      {/* Subscription list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">All subscriptions</p>
        {active.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3.5"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-xs font-bold text-white"
              style={{ background: s.color }}
            >
              {s.logo}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">{s.name}</p>
              <p className="text-xs text-text-muted">
                {s.category} · next charge {s.nextDate}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-text">${s.amount.toFixed(2)}/mo</span>
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(s.name))}
                className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[11px] font-semibold text-text-muted transition hover:border-danger hover:text-danger"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
