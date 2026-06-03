"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export function useCreditDebtSummary() {
  return useQuery({
    queryKey: ["credit-debt"],
    queryFn: () => api.getCreditDebtSummary(),
  });
}
