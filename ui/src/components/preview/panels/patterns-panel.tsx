"use client";

const PREVIEW_BANNER = (
  <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Spending patterns are a planned feature. Data shown is illustrative.</span>
  </div>
);

const DAY_OF_WEEK = [
  { day: "Mon", value: 42 },
  { day: "Tue", value: 38 },
  { day: "Wed", value: 51 },
  { day: "Thu", value: 64 },
  { day: "Fri", value: 98 },
  { day: "Sat", value: 134 },
  { day: "Sun", value: 112 },
];

const PATTERNS = [
  { label: "Weekend spending", value: "+43%", description: "You spend 43% more on Saturdays and Sundays vs. weekdays", severity: "warning" },
  { label: "Post-payday splurge", value: "+67%", description: "In the 3 days after your paycheck, spending spikes 67%", severity: "warning" },
  { label: "Late-night orders", value: "$189/mo", description: "38% of your food delivery orders happen between 10pm–2am", severity: "neutral" },
  { label: "Stress spending", value: "+28%", description: "Shopping and dining surge on high-workload weeks", severity: "neutral" },
];

export function PatternsPanel() {
  const maxDay = Math.max(...DAY_OF_WEEK.map((d) => d.value));

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* Day-of-week spending */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text">Average spend by day of week</p>
        <p className="text-xs text-text-muted">When your money tends to move</p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {DAY_OF_WEEK.map((d) => {
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
        {PATTERNS.map((p) => (
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
