"use client";

import { useState } from "react";

import { useResilience } from "@/hooks/use-features";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Scenario modeling assumptions are illustrative.</span>
  </div>
);

interface Scenario {
  id: string;
  name: string;
  emoji: string;
  shock: number; // one-time or income loss magnitude in $
  recurring: boolean;
  detail: string;
  monthsCovered: number;
  recommendedMonths: number;
}

const FALLBACK_LIQUID_CASH = 21400;
const FALLBACK_MONTHLY_BURN = 5080;

const FALLBACK_SCENARIOS: Scenario[] = [
  { id: "job", name: "Job loss", emoji: "💼", shock: 5080, recurring: true, detail: "Income stops; you live off reserves at current burn rate.", monthsCovered: 4.2, recommendedMonths: 6 },
  { id: "car", name: "$5K car repair", emoji: "🚗", shock: 5000, recurring: false, detail: "Sudden transmission failure, paid out of pocket.", monthsCovered: 99, recommendedMonths: 1 },
  { id: "medical", name: "$8K medical bill", emoji: "🏥", shock: 8000, recurring: false, detail: "ER visit + deductible after insurance.", monthsCovered: 99, recommendedMonths: 1 },
  { id: "rate", name: "Rate spike +2%", emoji: "📈", shock: 180, recurring: true, detail: "Variable debt payments rise $180/mo.", monthsCovered: 99, recommendedMonths: 1 },
  { id: "rent", name: "Rent +15%", emoji: "🏠", shock: 278, recurring: true, detail: "Lease renewal adds $278/mo to fixed costs.", monthsCovered: 99, recommendedMonths: 1 },
];

function scenarioScore(s: Scenario): number {
  if (s.recommendedMonths <= 0) return 100;
  return Math.min(100, Math.round((s.monthsCovered / s.recommendedMonths) * 100));
}

function scoreColor(s: number) {
  if (s >= 80) return "#22c55e";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreVerdict(s: number) {
  if (s >= 80) return "Protected";
  if (s >= 50) return "Exposed";
  return "Vulnerable";
}

export function ResiliencePanel() {
  const { data } = useResilience();

  const LIQUID_CASH = data ? Number.parseFloat(data.liquidCash) : FALLBACK_LIQUID_CASH;
  const MONTHLY_BURN = data ? Number.parseFloat(data.monthlyBurn) : FALLBACK_MONTHLY_BURN;
  const RUNWAY_MONTHS = data?.runwayMonths ?? LIQUID_CASH / MONTHLY_BURN;

  const SCENARIOS: Scenario[] = data?.scenarios.length
    ? data.scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji ?? "⚠️",
        shock: Number.parseFloat(s.shockAmount),
        recurring: s.shockType !== "one_time",
        detail: s.detail ?? "",
        monthsCovered: s.monthsCovered,
        recommendedMonths: s.recommendedMonths,
      }))
    : FALLBACK_SCENARIOS;

  const [active, setActive] = useState<string>(SCENARIOS[0]?.id ?? "job");
  const scenario = SCENARIOS.find((s) => s.id === active) ?? SCENARIOS[0]!;
  const overall =
    data?.immunityScore ??
    Math.round(SCENARIOS.reduce((sum, s) => sum + scenarioScore(s), 0) / SCENARIOS.length);

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Runway hero */}
      <div className="rounded-[var(--radius-lg)] p-5" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Day-Zero runway</p>
            <p className="mt-1 text-5xl font-extrabold text-white tabular-nums">{RUNWAY_MONTHS.toFixed(1)}<span className="text-2xl"> months</span></p>
            <p className="mt-1 text-sm text-white/70">
              At your current burn of <strong>${MONTHLY_BURN.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</strong>, your ${LIQUID_CASH.toLocaleString(undefined, { maximumFractionDigits: 0 })} in liquid cash lasts about <strong>{RUNWAY_MONTHS.toFixed(1)} months</strong> if income stopped today.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`} strokeDashoffset={`${2 * Math.PI * 50 * (1 - overall / 100)}`} />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-extrabold text-white">{overall}</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">Immunity score</p>
          </div>
        </div>
      </div>

      {/* Scenario simulator */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-bold text-text">Stress-test your finances</p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => {
            const sc = scenarioScore(s);
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${
                  isActive ? "border-primary bg-primary-soft text-primary" : "border-border text-text-muted hover:text-text"
                }`}
              >
                <span>{s.emoji}</span>
                {s.name}
                <span className="h-2 w-2 rounded-full" style={{ background: scoreColor(sc) }} />
              </button>
            );
          })}
        </div>

        {/* Active scenario detail */}
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-border p-4">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor(scenarioScore(scenario))} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`} strokeDashoffset={`${2 * Math.PI * 50 * (1 - scenarioScore(scenario) / 100)}`} />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold" style={{ color: scoreColor(scenarioScore(scenario)) }}>{scenarioScore(scenario)}</span>
                <span className="text-[10px] font-semibold uppercase text-text-muted">{scoreVerdict(scenarioScore(scenario))}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-border p-4">
            <p className="text-base font-bold text-text">{scenario.emoji} {scenario.name}</p>
            <p className="mt-1 text-sm text-text-muted">{scenario.detail}</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Shock size</span>
                <span className="font-semibold text-text tabular-nums">${scenario.shock.toLocaleString(undefined, { maximumFractionDigits: 0 })}{scenario.recurring ? "/mo" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Liquid reserves</span>
                <span className="font-semibold text-text tabular-nums">${LIQUID_CASH.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Survives for</span>
                <span className="font-semibold text-text tabular-nums">{scenario.monthsCovered.toFixed(1)} months (target {scenario.recommendedMonths})</span>
              </div>
            </div>
            <div className="mt-3 rounded-[var(--radius-sm)] bg-primary-soft/40 p-3 text-[13px] text-text">
              {scenarioScore(scenario) >= 80
                ? "✅ You're well-prepared for this shock without touching investments or taking on debt."
                : `⚠️ Building ${Math.max(0, scenario.recommendedMonths - scenario.monthsCovered).toFixed(1)} more months of expenses (${(Math.max(0, scenario.recommendedMonths - scenario.monthsCovered) * MONTHLY_BURN).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}) into your emergency fund would close this gap.`}
            </div>
          </div>
        </div>
      </div>

      {/* All scenarios overview */}
      <div className="space-y-2">
        <h3 className="px-1 text-sm font-semibold uppercase tracking-wide text-text-muted">Preparedness across all shocks</h3>
        {SCENARIOS.map((s) => {
          const sc = scenarioScore(s);
          return (
            <div key={s.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{s.emoji} {s.name}</span>
                <span className="text-sm font-bold" style={{ color: scoreColor(sc) }}>{scoreVerdict(sc)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full" style={{ width: `${sc}%`, background: scoreColor(sc) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
