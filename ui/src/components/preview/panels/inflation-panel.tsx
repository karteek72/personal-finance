"use client";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useInflation } from "@/hooks/use-features";

interface InflationCategory {
  name: string;
  share: number;
  inflation: number;
  severity: string;
}

function severityColor(s: string) {
  if (s === "high") return "#ef4444";
  if (s === "medium") return "#f59e0b";
  return "#22c55e";
}

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function InflationPanel() {
  const gate = useFeaturePanelGate("personal inflation");
  const { data, isLoading, isError } = useInflation();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;
  if (isError || !data) {
    return (
      <FeatureEmptyState feature="personal inflation" variant="insufficient-data" />
    );
  }

  const PERSONAL_RATE = data.personalRate;
  const NATIONAL_CPI = data.nationalCpi;
  const SALARY_RAISE = data.salaryRaise;
  const realSavingsRate = data.realSavingsRate;
  const realRaise = data.realRaise;
  const powerLoss = `−${usd(Number.parseFloat(data.powerLoss))}`;
  const salary = Number.parseFloat(data.salary);
  const breakEvenSalary = Number.parseFloat(data.breakEvenSalary);
  const targetSalary = Number.parseFloat(data.targetSalary);
  const raiseNeeded = breakEvenSalary - salary;
  const categories: InflationCategory[] = data.categories;

  return (
    <div className="space-y-5">

      {/* Personal inflation hero */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className="md:col-span-1 rounded-[var(--radius-lg)] p-5"
          style={{ background: "var(--gradient-hero)" }}
        >
          <p className="text-sm font-medium text-white/70">Your personal inflation rate</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight text-white">{PERSONAL_RATE}%</p>
          <p className="mt-2 text-sm text-white/70">
            vs. national CPI {NATIONAL_CPI}% — your lifestyle inflates faster than average
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Your raise this year</p>
            <p className="mt-0.5 text-2xl font-extrabold text-text">{SALARY_RAISE}%</p>
            <p className={`mt-1 text-xs font-semibold ${realRaise < 0 ? "text-danger" : "text-success"}`}>
              Real raise: {realRaise >= 0 ? "+" : ""}{realRaise.toFixed(1)}%
              {realRaise < 0 ? " (you took a pay cut)" : ""}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Real savings rate</p>
            <p className="mt-0.5 text-2xl font-extrabold text-text">{realSavingsRate.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-text-muted">after {PERSONAL_RATE}% inflation</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Purchasing power loss</p>
            <p className="mt-0.5 text-2xl font-extrabold text-danger">{powerLoss}</p>
            <p className="mt-1 text-xs text-text-muted">over the past year on a {usd(salary)} salary</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Raise needed to break even</p>
            <p className="mt-0.5 text-2xl font-extrabold text-text">{usd(raiseNeeded)}</p>
            <p className="mt-1 text-xs text-text-muted">at your personal inflation rate</p>
          </div>
        </div>
      </div>

      {/* Salary negotiation brief */}
      <div className="rounded-[var(--radius-md)] border border-primary/30 bg-primary/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-primary">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12.75a.75.75 0 00-1.5 0v.316a2.5 2.5 0 00-1.05.43C7.62 6.36 7.25 6.97 7.25 7.64c0 .67.37 1.28.95 1.66.43.28.99.46 1.55.57v2.2a1.6 1.6 0 01-.62-.3.75.75 0 00-.93 1.18c.42.33.97.55 1.55.64v.36a.75.75 0 001.5 0v-.37a2.5 2.5 0 001.05-.43c.58-.38.95-.99.95-1.66 0-.67-.37-1.28-.95-1.66-.43-.28-.99-.46-1.55-.57v-2.2c.23.06.44.16.62.3a.75.75 0 00.93-1.18 2.7 2.7 0 00-1.55-.64v-.36z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm font-bold text-primary">Salary Negotiation Brief</p>
        </div>
        <div className="space-y-1 text-sm text-text">
          <p>Your personal inflation rate this year: <strong>{PERSONAL_RATE}%</strong></p>
          <p>
            Your raise: <strong>{SALARY_RAISE}%</strong> — that is a{" "}
            <strong className={realRaise < 0 ? "text-danger" : "text-success"}>
              {realRaise >= 0 ? "+" : ""}{realRaise.toFixed(1)}% real {realRaise < 0 ? "pay cut" : "raise"}
            </strong>
          </p>
          <p>To maintain purchasing power at {usd(salary)}, you need: <strong className="text-primary">{usd(breakEvenSalary)}</strong></p>
          <p>To actually advance financially: <strong className="text-primary">{usd(targetSalary)}+</strong></p>
        </div>
        <button className="mt-3 rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 text-xs font-semibold text-white">
          Export this brief as PDF
        </button>
      </div>

      {/* Category inflation heatmap */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Category inflation heatmap — your spending × inflation rate
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {[...categories].sort((a, b) => b.inflation - a.inflation).map((c) => (
            <div
              key={c.name}
              className="rounded-[var(--radius-md)] border bg-surface p-3"
              style={{ borderColor: severityColor(c.severity) + "40" }}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-text">{c.name}</p>
                <span
                  className="text-xs font-bold"
                  style={{ color: severityColor(c.severity) }}
                >
                  {c.inflation}%
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-text-muted">{c.share}% of budget</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.inflation / 6) * 100}%`, background: severityColor(c.severity) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
