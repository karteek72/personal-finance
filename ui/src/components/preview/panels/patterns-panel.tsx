"use client";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { usePatterns } from "@/hooks/use-features";

const DOW_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function sortByDayOfWeek<T extends { day: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => DOW_ORDER.indexOf(a.day as (typeof DOW_ORDER)[number]) - DOW_ORDER.indexOf(b.day as (typeof DOW_ORDER)[number]),
  );
}

export function PatternsPanel() {
  const gate = useFeaturePanelGate("spending patterns");
  const { data, isLoading } = usePatterns();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const dayOfWeek = sortByDayOfWeek(
    (data?.dayOfWeek ?? []).map((d) => ({
      day: d.day,
      value: Number.parseFloat(d.value),
    })),
  );
  const patterns = data?.patterns ?? [];

  if (dayOfWeek.every((d) => d.value === 0) && patterns.length === 0) {
    return (
      <FeatureEmptyState feature="spending patterns" variant="insufficient-data" />
    );
  }
  const maxDay = Math.max(...dayOfWeek.map((d) => d.value), 1);
  const barMaxPx = 96;

  const weekdayTotal = dayOfWeek
    .filter((d) => d.day !== "Sat" && d.day !== "Sun")
    .reduce((sum, d) => sum + d.value, 0);
  const weekendTotal = dayOfWeek
    .filter((d) => d.day === "Sat" || d.day === "Sun")
    .reduce((sum, d) => sum + d.value, 0);
  const weekdayAvg = weekdayTotal / 5;
  const weekendAvg = weekendTotal / 2;
  const weekendLift =
    weekdayAvg > 0 ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100) : 0;

  return (
    <div className="space-y-5">

      {/* Day-of-week spending */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text">Average spend by day of week</p>
        <p className="text-xs text-text-muted">When your money tends to move</p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {dayOfWeek.map((d) => {
            const barHeight = Math.max((d.value / maxDay) * barMaxPx, d.value > 0 ? 4 : 0);
            const isWeekend = d.day === "Sat" || d.day === "Sun";
            return (
              <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-text-muted">
                  ${Math.round(d.value)}
                </span>
                <div
                  className={`w-full rounded-t-[var(--radius-xs)] transition-all ${isWeekend ? "bg-primary" : "bg-primary/35"}`}
                  style={{ height: `${barHeight}px` }}
                />
                <span className="text-[10px] text-text-muted">{d.day}</span>
              </div>
            );
          })}
        </div>
        {weekdayAvg + weekendAvg > 0 && (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-primary/5 p-2 text-xs text-primary">
            Weekends average ${Math.round(weekendAvg)}/day vs ${Math.round(weekdayAvg)}/day on weekdays
            {weekendLift !== 0
              ? ` (${weekendLift > 0 ? "+" : ""}${weekendLift}% vs weekdays).`
              : "."}
          </p>
        )}
      </div>

      {/* Detected patterns */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Spending patterns detected</p>
        {patterns.length === 0 && (
          <p className="px-1 text-xs text-text-muted">No notable patterns detected yet.</p>
        )}
        {patterns.map((p) => (
          <div key={p.label} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
            <div className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.severity === "warning" ? "bg-warning/10 text-warning" : "bg-border text-text-muted"}`}>
              {p.value}
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{p.label}</p>
              <p className="text-xs text-text-muted">{p.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
