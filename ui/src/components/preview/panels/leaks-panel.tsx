"use client";

import { useState } from "react";

import { useRecurring } from "@/hooks/use-features";

interface Fee {
  id: string;
  label: string;
  source: string;
  count: number;
  total: number; // last 12 months
  fixable: boolean;
}

interface Habit {
  id: string;
  emoji: string;
  label: string;
  monthly: number;
}

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

// Future value of a recurring monthly amount over `years` at 7% annual
function fv(monthly: number, years: number, rate = 0.07): number {
  const r = rate / 12;
  const n = years * 12;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}

export function LeaksPanel() {
  const [tab, setTab] = useState<"fees" | "audit">("fees");
  const { data } = useRecurring();

  const fees: Fee[] = (data?.leaks.fees ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    source: f.source,
    count: f.count,
    total: Number.parseFloat(f.total),
    fixable: f.fixable,
  }));

  const habits: Habit[] = (data?.leaks.habits ?? []).map((h) => ({
    id: h.id,
    emoji: h.emoji ?? "💸",
    label: h.label,
    monthly: Number.parseFloat(h.monthly),
  }));

  const feeTotal = fees.reduce((s, f) => s + f.total, 0);
  const recoverable = fees.filter((f) => f.fixable).reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-5">

      {/* Hero */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Silently draining your accounts</p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{money(feeTotal)}</p>
        <p className="mt-1 text-sm text-white/70">
          In fees over the last 12 months. <strong>{money(recoverable)}</strong> of that is avoidable with a few account changes.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "fees" as const, label: "Hidden fees" },
          { id: "audit" as const, label: "Lifestyle cost audit" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === t.id ? "border-primary bg-primary-soft text-primary" : "border-border text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fees" ? (
        <div className="space-y-2">
          {fees.map((f) => (
            <div key={f.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">{f.label}</p>
                  <p className="text-[11px] text-text-muted">{f.source} · {f.count}× this year</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold tabular-nums text-danger">{money(f.total)}</p>
                  {f.fixable ? (
                    <span className="text-[10px] font-semibold text-success">Avoidable</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-text-muted">Reduce balance</span>
                  )}
                </div>
              </div>
              {f.fixable && (
                <div className="mt-2 rounded-[var(--radius-sm)] bg-success/5 px-3 py-1.5 text-[12px] text-text">
                  {f.id === "atm" && "💡 Switch to a fee-free online bank or use in-network ATMs."}
                  {f.id === "overdraft" && "💡 Enable balance alerts at $100 + link a savings buffer."}
                  {f.id === "maint" && "💡 You qualify for a no-fee account with direct deposit."}
                  {f.id === "late" && "💡 Set autopay for the statement minimum to never miss again."}
                  {f.id === "fx" && "💡 Use a no-FX-fee travel card abroad."}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="px-1 text-[11px] text-text-muted">
            The real cost of a habit isn&apos;t the monthly bill — it&apos;s what that money becomes if invested. Below: annual cost and 10-year opportunity cost at 7%.
          </p>
          {habits.map((h) => (
            <div key={h.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{h.emoji} {h.label}</span>
                <span className="text-sm font-bold tabular-nums text-text">{money(h.monthly)}/mo</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[var(--radius-sm)] bg-bg p-2">
                  <p className="text-[10px] text-text-muted">Per year</p>
                  <p className="text-sm font-bold tabular-nums text-text">{money(h.monthly * 12)}</p>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-bg p-2">
                  <p className="text-[10px] text-text-muted">10y invested</p>
                  <p className="text-sm font-bold tabular-nums text-warning">{money(Math.round(fv(h.monthly, 10)))}</p>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-bg p-2">
                  <p className="text-[10px] text-text-muted">30y invested</p>
                  <p className="text-sm font-bold tabular-nums text-danger">{money(Math.round(fv(h.monthly, 30)))}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft/40 p-4">
            <p className="text-sm font-bold text-text">If you redirected just your coffee habit…</p>
            <p className="mt-1 text-sm text-text-muted">
              {money(132)}/mo invested for 30 years becomes <strong className="text-primary">{money(Math.round(fv(132, 30)))}</strong>. Small leaks, big ocean.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
