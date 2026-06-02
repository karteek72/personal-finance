"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useSummary(from?: string, to?: string) {
  const month = from?.slice(0, 7) ?? to?.slice(0, 7);

  return useQuery({
    queryKey: ["summary", month, from, to],
    queryFn: () => api.getSummary(from, to),
  });
}
