"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { analyticsDateRange } from "@/lib/date-ranges";

export function useCategories(from?: string, to?: string) {
  const range = analyticsDateRange();
  const fromDate = from ?? range.from;
  const toDate = to ?? range.to;

  return useQuery({
    queryKey: ["categories", fromDate, toDate],
    queryFn: () => api.getCategories(fromDate, toDate),
  });
}
