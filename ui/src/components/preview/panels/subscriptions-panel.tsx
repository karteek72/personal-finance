"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Subscription Manager is a planned feature. Data shown is illustrative.</span>
  </div>
);

const SUBS = [
  { name: "Netflix", amount: 17.99, category: "Entertainment", nextDate: "Jun 12", logo: "N", color: "#e50914", changed: true, oldAmount: 15.99 },
  { name: "Spotify", amount: 11.99, category: "Entertainment", nextDate: "Jun 15", logo: "S", color: "#1db954", changed: false, oldAmount: 0 },
  { name: "Amazon Prime", amount: 14.99, category: "Shopping", nextDate: "Jun 22", logo: "A", color: "#ff9900", changed: false, oldAmount: 0 },
  { name: "ChatGPT Plus", amount: 20.00, category: "Productivity", nextDate: "Jun 8", logo: "C", color: "#74aa9c", changed: false, oldAmount: 0 },
  { name: "Adobe Creative Cloud", amount: 54.99, category: "Software", nextDate: "Jun 18", logo: "Ai", color: "#ff0000", changed: false, oldAmount: 0 },
  { name: "Apple iCloud+", amount: 2.99, category: "Storage", nextDate: "Jun 5", logo: "☁", color: "#555", changed: false, oldAmount: 0 },
  { name: "Hulu", amount: 17.99, category: "Entertainment", nextDate: "Jun 28", logo: "H", color: "#1ce783", changed: false, oldAmount: 0 },
  { name: "New York Times", amount: 4.00, category: "News", nextDate: "Jun 30", logo: "T", color: "#000", changed: false, oldAmount: 0 },
  { name: "Notion", amount: 16.00, category: "Productivity", nextDate: "Jun 10", logo: "N", color: "#333", changed: false, oldAmount: 0 },
  { name: "Duolingo Plus", amount: 6.99, category: "Education", nextDate: "Jul 3", logo: "D", color: "#58cc02", changed: false, oldAmount: 0 },
];

export function SubscriptionsPanel() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const active = SUBS.filter((s) => !dismissed.has(s.name));
  const monthly = active.reduce((sum, s) => sum + s.amount, 0);
  const annual = monthly * 12;
  const priceChanges = active.filter((s) => s.changed);

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

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
