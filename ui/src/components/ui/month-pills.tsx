"use client";

import clsx from "clsx";
import { useMemo } from "react";

/** Last 24 calendar months (newest first), for filtering Plaid-scale history. */
function buildRecentMonthOptions(): { key: string; label: string }[] {
  const options: { key: string; label: string }[] = [];
  const now = new Date();

  for (let offset = 0; offset < 24; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    options.push({ key, label });
  }

  return options;
}

interface MonthPillsProps {
  /** `YYYY-MM` or null for all months */
  selectedMonth: string | null;
  onSelect: (month: string | null) => void;
}

export function MonthPills({ selectedMonth, onSelect }: MonthPillsProps) {
  const months = useMemo(() => buildRecentMonthOptions(), []);

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {months.map(({ key, label }) => {
        const isActive = selectedMonth === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isActive ? null : key)}
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
