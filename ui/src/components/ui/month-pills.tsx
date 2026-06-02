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
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {MONTHS.map((label, index) => {
        const month = index + 1;
        const isActive = selectedMonth === month;

        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(month)}
            className={clsx(
              "shrink-0 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition-all",
              isActive
                ? "bg-primary text-text-inverse shadow-sm"
                : "bg-surface text-text-muted hover:text-text card-shadow",
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
          "shrink-0 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition-all",
          selectedMonth === null
            ? "bg-primary text-text-inverse shadow-sm"
            : "bg-surface text-text-muted hover:text-text card-shadow",
        )}
      >
        All
      </button>
    </div>
  );
}
