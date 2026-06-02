"use client";

import clsx from "clsx";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

interface MonthPillsProps {
  selectedMonth: number | null;
  onSelect: (month: number | null) => void;
}

export function MonthPills({ selectedMonth, onSelect }: MonthPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MONTHS.map((label, index) => {
        const month = index + 1;
        const isActive = selectedMonth === month;

        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(month)}
            className={clsx(
              "rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive
                ? "border-primary bg-primary text-text-inverse"
                : "border-border bg-surface text-text-muted hover:border-primary/50 hover:text-text",
            )}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={clsx(
          "rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          selectedMonth === null
            ? "border-primary bg-primary text-text-inverse"
            : "border-border bg-surface text-text-muted hover:border-primary/50 hover:text-text",
        )}
      >
        All Year
      </button>
    </div>
  );
}
