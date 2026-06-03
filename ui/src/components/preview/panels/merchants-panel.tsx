"use client";

import { useState } from "react";

import { useMerchants } from "@/hooks/use-features";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Income stability projections are illustrative.</span>
  </div>
);

interface Merchant {
  name: string;
  emoji: string;
  visits: number;
  total: number;
  trend: number; // % MoM
  trail: number[]; // 6-month spend trail
}

const FALLBACK_MERCHANTS: Merchant[] = [
  { name: "Amazon", emoji: "📦", visits: 41, total: 1284.5, trend: 12, trail: [180, 210, 240, 260, 300, 320] },
  { name: "Whole Foods", emoji: "🛒", visits: 28, total: 1102.0, trend: -4, trail: [210, 200, 190, 195, 185, 180] },
  { name: "DoorDash", emoji: "🍔", visits: 34, total: 968.3, trend: 23, trail: [110, 130, 140, 170, 190, 228] },
  { name: "Shell", emoji: "⛽", visits: 19, total: 642.1, trend: 2, trail: [100, 105, 108, 110, 108, 111] },
  { name: "Starbucks", emoji: "☕", visits: 47, total: 416.8, trend: 8, trail: [58, 62, 66, 70, 74, 80] },
  { name: "Uber", emoji: "🚕", visits: 22, total: 388.0, trend: -11, trail: [80, 78, 70, 64, 60, 56] },
];

const FALLBACK_INCOME_MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
const FALLBACK_INCOME = [6520, 6520, 6520, 7100, 6520, 7340];
const FALLBACK_SIDE_INCOME = [0, 240, 0, 420, 180, 610];
const FALLBACK_SOURCES = 3;

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 60},${20 - ((v - min) / range) * 18}`)
    .join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MerchantsPanel() {
  const [tab, setTab] = useState<"merchants" | "income">("merchants");
  const { data } = useMerchants();

  const MERCHANTS: Merchant[] = data?.merchants.length
    ? data.merchants.map((m) => ({
        name: m.name,
        emoji: m.emoji,
        visits: m.visits,
        total: Number.parseFloat(m.total),
        trend: m.trend,
        trail: m.trail,
      }))
    : FALLBACK_MERCHANTS;

  const INCOME_MONTHS = data?.income.months.length ? data.income.months : FALLBACK_INCOME_MONTHS;
  const INCOME = data?.income.primary.length ? data.income.primary : FALLBACK_INCOME;
  const SIDE_INCOME = data?.income.side.length ? data.income.side : FALLBACK_SIDE_INCOME;
  const sources = data?.incomeSources ?? FALLBACK_SOURCES;
  const merchantCount = data?.merchantCount ?? 63;

  const topMerchant = [...MERCHANTS].sort((a, b) => b.total - a.total)[0];
  const mostVisited = [...MERCHANTS].sort((a, b) => b.visits - a.visits)[0];
  const fastestGrowing = [...MERCHANTS].sort((a, b) => b.trend - a.trend)[0];

  const totalIncome = INCOME.reduce((a, b) => a + b, 0) + SIDE_INCOME.reduce((a, b) => a + b, 0);
  const avgIncome = totalIncome / (INCOME_MONTHS.length || 1);
  const incomeMean = INCOME.reduce((a, b) => a + b, 0) / (INCOME.length || 1);
  const variance = incomeMean
    ? Math.round(
        (Math.sqrt(INCOME.reduce((s, v) => s + Math.pow(v - incomeMean, 2), 0) / INCOME.length) /
          incomeMean) *
          100,
      )
    : 0;
  const maxIncomeBar = Math.max(...INCOME.map((v, i) => v + (SIDE_INCOME[i] ?? 0)), 1);
  const lastSide = SIDE_INCOME[SIDE_INCOME.length - 1] ?? 0;
  const lastMonth = INCOME_MONTHS[INCOME_MONTHS.length - 1] ?? "this month";

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      <div className="flex gap-2">
        {[
          { id: "merchants" as const, label: "Merchant analytics" },
          { id: "income" as const, label: "Income analytics" },
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

      {tab === "merchants" ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Top merchant", value: topMerchant?.name ?? "—", sub: topMerchant ? money(topMerchant.total) : "" },
              { label: "Most visited", value: mostVisited?.name ?? "—", sub: mostVisited ? `${mostVisited.visits} visits` : "" },
              { label: "Fastest growing", value: fastestGrowing?.name ?? "—", sub: fastestGrowing ? `${fastestGrowing.trend > 0 ? "+" : ""}${fastestGrowing.trend}% MoM` : "" },
              { label: "Merchants tracked", value: `${merchantCount}`, sub: `${MERCHANTS.length} active monthly` },
            ].map((k) => (
              <div key={k.label} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
                <p className="text-[11px] font-medium text-text-muted">{k.label}</p>
                <p className="mt-1 text-base font-bold text-text">{k.value}</p>
                <p className="text-[11px] text-text-muted">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <div className="grid grid-cols-[1.4fr_0.6fr_0.8fr_0.7fr_0.8fr] gap-2 border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <span>Merchant</span>
              <span className="text-right">Visits</span>
              <span className="text-right">Total</span>
              <span className="text-right">Trend</span>
              <span className="text-right">6-mo</span>
            </div>
            {MERCHANTS.map((m) => (
              <div key={m.name} className="grid grid-cols-[1.4fr_0.6fr_0.8fr_0.7fr_0.8fr] items-center gap-2 border-b border-border/60 px-4 py-3 last:border-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-text">
                  <span>{m.emoji}</span> {m.name}
                </span>
                <span className="text-right text-sm tabular-nums text-text-muted">{m.visits}</span>
                <span className="text-right text-sm font-semibold tabular-nums text-text">{money(m.total)}</span>
                <span className={`text-right text-sm font-semibold tabular-nums ${m.trend > 0 ? "text-danger" : "text-success"}`}>
                  {m.trend > 0 ? "+" : ""}{m.trend}%
                </span>
                <span className="flex justify-end">
                  <Sparkline data={m.trail} color={m.trend > 0 ? "#ef4444" : "#22c55e"} />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Avg monthly income", value: money(Math.round(avgIncome)), color: "text-text" },
              { label: "Income stability", value: `${100 - variance}%`, color: variance < 10 ? "text-success" : "text-warning" },
              { label: "Side income (6mo)", value: money(SIDE_INCOME.reduce((a, b) => a + b, 0)), color: "text-success" },
              { label: "Sources", value: `${sources}`, color: "text-text" },
            ].map((k) => (
              <div key={k.label} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
                <p className="text-[11px] font-medium text-text-muted">{k.label}</p>
                <p className={`mt-1 text-lg font-bold tabular-nums ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-bold text-text">Income by month (primary + side)</p>
            <div className="flex h-44 items-end gap-3">
              {INCOME_MONTHS.map((mo, i) => {
                const primary = INCOME[i] ?? 0;
                const side = SIDE_INCOME[i] ?? 0;
                return (
                  <div key={mo} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[var(--radius-xs)]" style={{ height: `${((primary + side) / maxIncomeBar) * 150}px` }}>
                      <div className="w-full bg-primary" style={{ height: `${(primary / (primary + side)) * 100}%` }} />
                      {side > 0 && <div className="w-full bg-success" style={{ height: `${(side / (primary + side)) * 100}%` }} />}
                    </div>
                    <span className="text-[10px] text-text-muted">{mo}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Salary</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Side income</span>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-sm font-bold text-text">💡 Income insight</p>
            <p className="mt-1 text-sm text-text-muted">
              Your income is <strong>{100 - variance}% stable</strong> month-to-month. Side income reached {money(lastSide)} in {lastMonth} — at this pace it could cover a recurring bill within a couple quarters.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
