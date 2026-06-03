"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useFire } from "@/hooks/use-features";

const FALLBACK_AGE = 29;
const FALLBACK_NET_WORTH = 84000;

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

// Years to FIRE given monthly investment, current savings, target, and real return
function yearsToTarget(start: number, monthly: number, target: number, annualReturn: number): number {
  let balance = start;
  const monthlyReturn = annualReturn / 12;
  let months = 0;
  while (balance < target && months < 1200) {
    balance = balance * (1 + monthlyReturn) + monthly;
    months++;
  }
  return months / 12;
}

export function FirePanel() {
  const { data: fire } = useFire();

  const CURRENT_AGE = fire?.currentAge ?? FALLBACK_AGE;
  const CURRENT_NET_WORTH = fire ? Number.parseFloat(fire.currentNetWorth) : FALLBACK_NET_WORTH;

  const [monthlySpend, setMonthlySpend] = useState(4200);
  const [monthlyInvest, setMonthlyInvest] = useState(2100);
  const [withdrawalRate, setWithdrawalRate] = useState(4); // %
  const [realReturn, setRealReturn] = useState(6); // %

  const seeded = useRef(false);
  useEffect(() => {
    if (fire && !seeded.current) {
      seeded.current = true;
      setMonthlySpend(Math.round(Number.parseFloat(fire.monthlySpend)));
      setMonthlyInvest(Math.round(Number.parseFloat(fire.monthlyInvest)));
      setWithdrawalRate(fire.withdrawalRate);
      setRealReturn(fire.realReturn);
    }
  }, [fire]);

  const fireNumber = (monthlySpend * 12) / (withdrawalRate / 100);
  const years = yearsToTarget(CURRENT_NET_WORTH, monthlyInvest, fireNumber, realReturn / 100);
  const fireAge = CURRENT_AGE + years;
  const savingsRate = Math.round((monthlyInvest / (monthlyInvest + monthlySpend)) * 100);

  // Projection curve points (yearly balances up to FIRE or 40y)
  const curve = useMemo(() => {
    const pts: number[] = [];
    let balance = CURRENT_NET_WORTH;
    const cap = Math.min(Math.ceil(years) + 2, 45);
    for (let y = 0; y <= cap; y++) {
      pts.push(balance);
      for (let m = 0; m < 12; m++) balance = balance * (1 + realReturn / 100 / 12) + monthlyInvest;
    }
    return pts;
  }, [monthlyInvest, realReturn, years]);

  const maxVal = Math.max(...curve, fireNumber);

  return (
    <div className="space-y-5">
      {/* Hero result */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">You can reach financial independence at</p>
        <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">age {fireAge.toFixed(0)}</p>
        <p className="mt-1 text-sm text-white/70">
          That&apos;s <strong>{years.toFixed(1)} years</strong> from now. Your FIRE number is <strong>{money(fireNumber)}</strong> — the portfolio that funds {money(monthlySpend)}/mo at a {withdrawalRate}% safe withdrawal rate.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Savings rate {savingsRate}%</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">FIRE number {money(fireNumber)}</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">{years.toFixed(0)} yrs to go</span>
        </div>
      </div>

      {/* Projection chart */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-bold text-text">Projected portfolio growth</p>
        <div className="relative flex h-40 items-end gap-1">
          {curve.map((v, i) => {
            const reached = v >= fireNumber;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-[var(--radius-xs)] transition-all"
                  style={{ height: `${Math.max((v / maxVal) * 140, 2)}px`, background: reached ? "#22c55e" : "var(--color-primary)" }}
                  title={`Year ${i}: ${money(v)}`}
                />
              </div>
            );
          })}
          {/* FIRE target line */}
          <div
            className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-success/70"
            style={{ bottom: `${(fireNumber / maxVal) * 140}px` }}
          >
            <span className="absolute -top-4 right-0 rounded bg-success/10 px-1.5 text-[10px] font-semibold text-success">
              FIRE {money(fireNumber)}
            </span>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-text-muted">
          <span>Now (age {CURRENT_AGE})</span>
          <span>Age {fireAge.toFixed(0)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { label: "Monthly spending in retirement", value: monthlySpend, set: setMonthlySpend, min: 2000, max: 9000, step: 100, fmt: money },
          { label: "Monthly investing now", value: monthlyInvest, set: setMonthlyInvest, min: 200, max: 6000, step: 100, fmt: money },
          { label: "Safe withdrawal rate", value: withdrawalRate, set: setWithdrawalRate, min: 3, max: 6, step: 0.5, fmt: (n: number) => `${n}%` },
          { label: "Expected real return", value: realReturn, set: setRealReturn, min: 3, max: 9, step: 0.5, fmt: (n: number) => `${n}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-text">{c.label}</label>
              <span className="text-sm font-bold tabular-nums text-primary">{c.fmt(c.value)}</span>
            </div>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={c.value}
              onChange={(e) => c.set(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
          </div>
        ))}
      </div>

      {/* What-if nudges */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-bold text-text">Accelerators</p>
        <div className="space-y-2 text-sm">
          {[
            { label: "Invest $300/mo more", delta: yearsToTarget(CURRENT_NET_WORTH, monthlyInvest + 300, fireNumber, realReturn / 100) },
            { label: "Cut $400/mo of spending (lowers FIRE number too)", delta: yearsToTarget(CURRENT_NET_WORTH, monthlyInvest + 400, ((monthlySpend - 400) * 12) / (withdrawalRate / 100), realReturn / 100) },
          ].map((row) => {
            const saved = years - row.delta;
            return (
              <div key={row.label} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-3 py-2">
                <span className="text-text">{row.label}</span>
                <span className="font-semibold text-success">−{saved.toFixed(1)} yrs → age {(CURRENT_AGE + row.delta).toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
