"use client";

import { useMemo } from "react";

import { FilterSelect } from "@/components/ui/filter-select";
import { buildRecentMonthFilterOptions } from "@/lib/month-filter-options";

interface MonthFilterSelectProps {
  /** `YYYY-MM` or null for all months */
  selectedMonth: string | null;
  onChange: (month: string | null) => void;
  monthsBack?: number;
  className?: string;
  /** When false, hide the "All months" option (e.g. dashboard month view). */
  allowAll?: boolean;
}

export function MonthFilterSelect({
  selectedMonth,
  onChange,
  monthsBack = 12,
  className,
  allowAll = true,
}: MonthFilterSelectProps) {
  const options = useMemo(
    () => buildRecentMonthFilterOptions(monthsBack, allowAll),
    [monthsBack, allowAll],
  );

  return (
    <FilterSelect
      id="transaction-month-filter"
      label="Month"
      value={selectedMonth ?? ""}
      onChange={(value) => onChange(value || null)}
      options={options}
      className={className}
    />
  );
}
