"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { yearToDateRange } from "@/lib/chart-utils";
import type { ChartDataFilters } from "@/types/api";

export function useChartData(filters: ChartDataFilters = {}) {
  const range = yearToDateRange();
  const from = filters.from ?? range.from;
  const to = filters.to ?? range.to;
  const accountId = filters.accountId ?? "";
  const category = filters.category ?? "";

  return useQuery({
    queryKey: ["chart-data", from, to, accountId, category],
    queryFn: () =>
      api.getChartData({
        from,
        to,
        accountId: accountId || undefined,
        category: category || undefined,
      }),
  });
}
