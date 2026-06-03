"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

/**
 * Hooks for the demo-dataset feature endpoints (wealth, planning, insights,
 * protect, coach & wrapped). Each maps 1:1 to an `api.*` method that resolves
 * from the live backend or the bundled UI mocks depending on NEXT_PUBLIC_USE_MOCKS.
 */

export function useNetWorth() {
  return useQuery({ queryKey: ["net-worth"], queryFn: () => api.getNetWorth() });
}

export function useInvestments() {
  return useQuery({
    queryKey: ["investments"],
    queryFn: () => api.getInvestments(),
  });
}

export function useFire() {
  return useQuery({ queryKey: ["fire"], queryFn: () => api.getFire() });
}

export function useBudgets() {
  return useQuery({ queryKey: ["budgets"], queryFn: () => api.getBudgets() });
}

export function useRecurring() {
  return useQuery({
    queryKey: ["recurring"],
    queryFn: () => api.getRecurring(),
  });
}

export function useCalendar() {
  return useQuery({ queryKey: ["calendar"], queryFn: () => api.getCalendar() });
}

export function useForecast() {
  return useQuery({ queryKey: ["forecast"], queryFn: () => api.getForecast() });
}

export function useWellness() {
  return useQuery({ queryKey: ["wellness"], queryFn: () => api.getWellness() });
}

export function useDna() {
  return useQuery({ queryKey: ["dna"], queryFn: () => api.getDna() });
}

export function usePatterns() {
  return useQuery({ queryKey: ["patterns"], queryFn: () => api.getPatterns() });
}

export function useBehavioral() {
  return useQuery({
    queryKey: ["behavioral"],
    queryFn: () => api.getBehavioral(),
  });
}

export function useMerchants() {
  return useQuery({
    queryKey: ["merchants"],
    queryFn: () => api.getMerchants(),
  });
}

export function useInflation() {
  return useQuery({
    queryKey: ["inflation"],
    queryFn: () => api.getInflation(),
  });
}

export function useResilience() {
  return useQuery({
    queryKey: ["resilience"],
    queryFn: () => api.getResilience(),
  });
}

export function useCoach() {
  return useQuery({ queryKey: ["coach"], queryFn: () => api.getCoach() });
}

export function useWrapped() {
  return useQuery({ queryKey: ["wrapped"], queryFn: () => api.getWrapped() });
}
