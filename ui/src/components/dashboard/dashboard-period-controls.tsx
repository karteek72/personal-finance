"use client";

import clsx from "clsx";

import { MonthFilterSelect } from "@/components/ui/month-filter-select";
import type { DashboardPeriodMode } from "@/lib/date-ranges";

interface DashboardPeriodControlsProps {
  mode: DashboardPeriodMode;
  selectedMonth: string;
  onModeChange: (mode: DashboardPeriodMode) => void;
  onMonthChange: (month: string) => void;
}

const MODE_OPTIONS: { id: DashboardPeriodMode; label: string }[] = [
  { id: "rolling", label: "12 months" },
  { id: "month", label: "Month" },
];

export function DashboardPeriodControls({
  mode,
  selectedMonth,
  onModeChange,
  onMonthChange,
}: DashboardPeriodControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Period
      </span>
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onModeChange(option.id)}
          className={clsx(
            "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
            mode === option.id
              ? "bg-primary text-text-inverse"
              : "bg-surface text-text-muted card-shadow hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
      {mode === "month" ? (
        <MonthFilterSelect
          selectedMonth={selectedMonth}
          onChange={(month) => {
            if (month) onMonthChange(month);
          }}
          monthsBack={24}
          allowAll={false}
          className="min-w-[10rem]"
        />
      ) : null}
    </div>
  );
}
