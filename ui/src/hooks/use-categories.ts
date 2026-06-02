"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

function defaultDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year - 1}-01-01`, to: `${year}-12-31` };
}

export function useCategories(from?: string, to?: string) {
  const range = defaultDateRange();
  const fromDate = from ?? range.from;
  const toDate = to ?? range.to;

  return useQuery({
    queryKey: ["categories", fromDate, toDate],
    queryFn: () => api.getCategories(fromDate, toDate),
  });
}
