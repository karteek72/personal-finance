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
}

export function MonthFilterSelect({
  selectedMonth,
  onChange,
  monthsBack = 24,
  className,
}: MonthFilterSelectProps) {
  const options = useMemo(
    () => buildRecentMonthFilterOptions(monthsBack),
    [monthsBack],
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
