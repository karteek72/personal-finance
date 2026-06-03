"use client";

import { usePatterns } from "@/hooks/use-features";

const FALLBACK_DAY_OF_WEEK = [
  { day: "Mon", value: 42 },
  { day: "Tue", value: 38 },
  { day: "Wed", value: 51 },
  { day: "Thu", value: 64 },
  { day: "Fri", value: 98 },
  { day: "Sat", value: 134 },
  { day: "Sun", value: 112 },
];

const FALLBACK_PATTERNS = [
  { label: "Weekend spending", value: "+43%", description: "You spend 43% more on Saturdays and Sundays vs. weekdays", severity: "warning" },
  { label: "Post-payday splurge", value: "+67%", description: "In the 3 days after your paycheck, spending spikes 67%", severity: "warning" },
  { label: "Late-night orders", value: "$189/mo", description: "38% of your food delivery orders happen between 10pm–2am", severity: "neutral" },
  { label: "Stress spending", value: "+28%", description: "Shopping and dining surge on high-workload weeks", severity: "neutral" },
];

export function PatternsPanel() {
  const { data } = usePatterns();

  const dayOfWeek = data?.dayOfWeek.length
    ? data.dayOfWeek.map((d) => ({ day: d.day, value: Number.parseFloat(d.value) }))
    : FALLBACK_DAY_OF_WEEK;
  const patterns = data?.patterns.length ? data.patterns : FALLBACK_PATTERNS;
  const maxDay = Math.max(...dayOfWeek.map((d) => d.value));

  return (
    <div className="space-y-5">

      {/* Day-of-week spending */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text">Average spend by day of week</p>
        <p className="text-xs text-text-muted">When your money tends to move</p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {dayOfWeek.map((d) => {
            const heightPct = (d.value / maxDay) * 100;
            const isWeekend = d.day === "Sat" || d.day === "Sun";
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-text-muted">${d.value}</span>
                <div
                  className="w-full rounded-t-[var(--radius-xs)] transition-all"
                  style={{ height: `${heightPct}%`, background: isWeekend ? "var(--color-primary)" : "var(--color-border)" }}
                />
                <span className="text-[10px] text-text-muted">{d.day}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 rounded-[var(--radius-sm)] bg-primary/5 p-2 text-xs text-primary">
          Weekends account for ~46% of your discretionary spending despite being 28% of the week.
        </p>
      </div>

      {/* Detected patterns */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Spending patterns detected</p>
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
