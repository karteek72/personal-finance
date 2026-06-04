"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { sliceLastMonthlyPoints, yearToDateRange } from "@/lib/chart-utils";
import type { ChartDataFilters } from "@/types/api";

export function useChartData(filters: ChartDataFilters = {}) {
  const range = yearToDateRange();
  const from = filters.from ?? range.from;
  const to = filters.to ?? range.to;
  const accountId = filters.accountId ?? "";
  const category = filters.category ?? "";
  const memberId = filters.memberId ?? "";
  const scope = filters.scope ?? "all";

  return useQuery({
    queryKey: ["chart-data", from, to, accountId, category, memberId, scope],
    queryFn: () =>
      api.getChartData({
        from,
        to,
        accountId: accountId || undefined,
        category: category || undefined,
        memberId: memberId || undefined,
        scope: scope === "all" ? undefined : scope,
      }),
    select: (response) => ({
      ...response,
      monthly: sliceLastMonthlyPoints(response.monthly),
    }),
  });
}
