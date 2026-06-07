"use client";

import { useState } from "react";

import {
  FeatureEmptyState,
  FeaturePanelLoading,
} from "@/components/preview/feature-empty-state";
import { useFeaturePanelGate } from "@/components/preview/use-feature-panel-gate";
import { useCalendar } from "@/hooks/use-features";

type EventType = "bill" | "income" | "subscription" | "goal";

interface DayEvent {
  type: EventType;
  label: string;
  amount: number;
}

function asEventType(t: string): EventType {
  return t === "bill" || t === "income" || t === "subscription" || t === "goal" ? t : "bill";
}

const TYPE_META: Record<EventType, { color: string; dot: string; label: string }> = {
  bill: { color: "#ef4444", dot: "bg-danger", label: "Bill due" },
  income: { color: "#22c55e", dot: "bg-success", label: "Income" },
  subscription: { color: "#a855f7", dot: "bg-[#a855f7]", label: "Subscription" },
  goal: { color: "#3b82f6", dot: "bg-[#3b82f6]", label: "Goal transfer" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function heatColor(level: number): string {
  switch (level) {
    case 3: return "rgba(239,68,68,0.28)";
    case 2: return "rgba(245,158,11,0.24)";
    case 1: return "rgba(34,197,94,0.16)";
    default: return "transparent";
  }
}

export function CalendarPanel() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const gate = useFeaturePanelGate("cash-flow calendar");
  const { data, isLoading } = useCalendar();

  if (!gate.ready) return gate.node;
  if (isLoading) return <FeaturePanelLoading />;

  const monthIso = data?.month ?? new Date().toISOString().slice(0, 7);
  const year = Number.parseInt(monthIso.split("-")[0] ?? "2026", 10);
  const monthIdx = Number.parseInt(monthIso.split("-")[1] ?? "6", 10) - 1;
  const monthLabel = `${MONTH_NAMES[monthIdx] ?? "June"} ${year}`;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  // Monday-based offset (JS getDay: 0=Sun..6=Sat)
  const jsStart = new Date(year, monthIdx, 1).getDay();
  const startOffset = (jsStart + 6) % 7;

  const EVENTS: Record<number, DayEvent[]> = (data?.events ?? []).reduce<
    Record<number, DayEvent[]>
  >((acc, e) => {
    const item: DayEvent = {
      type: asEventType(e.type),
      label: e.label,
      amount: Number.parseFloat(e.amount),
    };
    (acc[e.day] = acc[e.day] ?? []).push(item);
    return acc;
  }, {});

  const HEAT: Record<number, number> = (data?.heat ?? []).reduce<Record<number, number>>(
    (acc, h) => {
      acc[h.day] = h.level;
      return acc;
    },
    {},
  );

  const totalBills = Number.parseFloat(data?.totals.bills ?? "0");
  const totalIncome = Number.parseFloat(data?.totals.income ?? "0");
  const safeToSpend = Number.parseFloat(data?.safeToSpendToday ?? "0");

  const selectedEvents = selectedDay ? EVENTS[selectedDay] ?? [] : [];

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Income this month", value: `$${Math.round(totalIncome).toLocaleString()}`, color: "text-success" },
          { label: "Bills & subs due", value: `$${Math.round(totalBills).toLocaleString()}`, color: "text-danger" },
          { label: "Events tracked", value: `${Object.values(EVENTS).flat().length}`, color: "text-text" },
          { label: "Safe-to-spend today", value: `$${Math.round(safeToSpend).toLocaleString()}`, color: "text-warning" },
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
            <p className="text-sm font-bold text-text">{monthLabel}</p>
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
            {selectedDay ? `${MONTH_NAMES[monthIdx] ?? "June"} ${selectedDay}, ${year}` : "Select a day"}
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
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-text">${Math.round(safeToSpend).toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-text-muted">
              After upcoming bills and your savings target, this is what&apos;s free to spend without going negative before payday.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
