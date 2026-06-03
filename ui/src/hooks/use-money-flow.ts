"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { plaidHistoryDateRange } from "@/lib/date-ranges";

export function useMoneyFlow(from?: string, to?: string) {
  const range = plaidHistoryDateRange();
  const fromDate = from ?? range.from;
  const toDate = to ?? range.to;

  return useQuery({
    queryKey: ["money-flow", fromDate, toDate],
    queryFn: () => api.getMoneyFlow(fromDate, toDate),
  });
}
