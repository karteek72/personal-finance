"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

function yearToDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function useMoneyFlow(from?: string, to?: string) {
  const range = yearToDateRange();
  const fromDate = from ?? range.from;
  const toDate = to ?? range.to;

  return useQuery({
    queryKey: ["money-flow", fromDate, toDate],
    queryFn: () => api.getMoneyFlow(fromDate, toDate),
  });
}
