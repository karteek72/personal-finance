"use client";

import { useState } from "react";

const PREVIEW_BANNER = (
  <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
    <span><strong>Preview</strong> — Money Calendar is a planned feature. Data shown is illustrative.</span>
  </div>
);

type EventType = "bill" | "income" | "subscription" | "goal";

interface DayEvent {
  type: EventType;
  label: string;
  amount: number;
}

// Mapped by day-of-month for the demo month (June 2026, starts on Monday)
const EVENTS: Record<number, DayEvent[]> = {
  1: [{ type: "bill", label: "Rent", amount: 1850 }],
  3: [{ type: "subscription", label: "Spotify", amount: 11.99 }],
  5: [{ type: "subscription", label: "iCloud+", amount: 9.99 }],
  7: [{ type: "bill", label: "Electricity", amount: 124 }],
  12: [{ type: "subscription", label: "Netflix", amount: 22.99 }],
  14: [{ type: "income", label: "Paycheck", amount: 3260 }],
  15: [{ type: "bill", label: "Car insurance", amount: 188 }],
  18: [{ type: "subscription", label: "Gym", amount: 49 }],
  20: [
    { type: "bill", label: "Internet", amount: 70 },
    { type: "subscription", label: "ChatGPT", amount: 20 },
  ],
  22: [{ type: "goal", label: "Auto-save → Emergency", amount: 400 }],
  25: [{ type: "bill", label: "Phone", amount: 85 }],
  28: [{ type: "income", label: "Paycheck", amount: 3260 }],
  30: [{ type: "bill", label: "Credit card min", amount: 240 }],
};

// Spend heatmap intensity (0-3) by day-of-month
const HEAT: Record<number, number> = {
  1: 3, 2: 1, 3: 2, 4: 0, 5: 1, 6: 3, 7: 2, 8: 1, 9: 0, 10: 1,
  11: 2, 12: 3, 13: 3, 14: 1, 15: 2, 16: 0, 17: 1, 18: 2, 19: 1, 20: 3,
  21: 2, 22: 0, 23: 1, 24: 1, 25: 2, 26: 3, 27: 3, 28: 1, 29: 0, 30: 2,
};

const TYPE_META: Record<EventType, { color: string; dot: string; label: string }> = {
  bill: { color: "#ef4444", dot: "bg-danger", label: "Bill due" },
  income: { color: "#22c55e", dot: "bg-success", label: "Income" },
  subscription: { color: "#a855f7", dot: "bg-[#a855f7]", label: "Subscription" },
  goal: { color: "#3b82f6", dot: "bg-[#3b82f6]", label: "Goal transfer" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_IN_MONTH = 30;
const START_OFFSET = 0; // June 1, 2026 is a Monday

function heatColor(level: number): string {
  switch (level) {
    case 3: return "rgba(239,68,68,0.28)";
    case 2: return "rgba(245,158,11,0.24)";
    case 1: return "rgba(34,197,94,0.16)";
    default: return "transparent";
  }
}

export function CalendarPanel() {
  const [selectedDay, setSelectedDay] = useState<number | null>(14);

  const totalBills = Object.values(EVENTS)
    .flat()
    .filter((e) => e.type === "bill" || e.type === "subscription")
    .reduce((s, e) => s + e.amount, 0);
  const totalIncome = Object.values(EVENTS)
    .flat()
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);

  const selectedEvents = selectedDay ? EVENTS[selectedDay] ?? [] : [];

  const cells: (number | null)[] = [
    ...Array(START_OFFSET).fill(null),
    ...Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-5">
      {PREVIEW_BANNER}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Income this month", value: `$${totalIncome.toLocaleString()}`, color: "text-success" },
          { label: "Bills & subs due", value: `$${Math.round(totalBills).toLocaleString()}`, color: "text-danger" },
          { label: "Next bill", value: "Jun 1 · Rent", color: "text-text" },
          { label: "Tightest day", value: "Jun 30", color: "text-warning" },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <p className="text-[11px] font-medium text-text-muted">{k.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Calendar grid */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-text">June 2026</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-muted">
              {(Object.keys(TYPE_META) as EventType[]).map((t) => (
                <span key={t} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${TYPE_META[t].dot}`} />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase text-text-muted">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e${idx}`} />;
              const dayEvents = EVENTS[day] ?? [];
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{ background: isSelected ? undefined : heatColor(HEAT[day] ?? 0) }}
                  className={`flex aspect-square flex-col items-start rounded-[var(--radius-xs)] border p-1 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary-soft"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-text"}`}>
                    {day}
                  </span>
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: TYPE_META[e.type].color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-text-muted">
            Cell shading reflects historical spending intensity for that day. Dots mark scheduled events.
          </p>
        </div>

        {/* Selected day detail */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <p className="text-sm font-bold text-text">
            {selectedDay ? `June ${selectedDay}, 2026` : "Select a day"}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No scheduled events on this day.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {selectedEvents.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_META[e.type].color }} />
                    <div>
                      <p className="text-sm font-semibold text-text">{e.label}</p>
                      <p className="text-[11px] text-text-muted">{TYPE_META[e.type].label}</p>
                    </div>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: e.type === "income" ? "#22c55e" : "var(--color-text)" }}
                  >
                    {e.type === "income" ? "+" : "−"}${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-[var(--radius-sm)] bg-primary-soft/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Safe-to-spend today</p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-text">$74</p>
            <p className="mt-1 text-[11px] text-text-muted">
              After upcoming bills and your savings target, this is what&apos;s free to spend without going negative before payday.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
