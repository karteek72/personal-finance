"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useAlerts(month?: string) {
  return useQuery({
    queryKey: ["alerts", month],
    queryFn: () => api.getAlerts(month),
  });
}
