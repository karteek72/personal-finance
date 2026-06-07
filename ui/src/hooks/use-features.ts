"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";
import { useAuthStore } from "@/stores/auth-store";
import type { ListQuery } from "@/types/api";

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

export function usePatchFire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.patchFire,
    onSuccess: (data) => {
      queryClient.setQueryData(["fire"], data);
      queryClient.invalidateQueries({ queryKey: ["analytics-profile"] });
    },
  });
}

export function useAnalyticsProfile() {
  return useQuery({
    queryKey: ["analytics-profile"],
    queryFn: () => api.getAnalyticsProfile(),
  });
}

export function useUserProfile() {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.getUserProfile(),
    retry: 1,
  });
}

export function usePatchUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.patchUserProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["user-profile"], data);
      const { user, ...analytics } = data;
      queryClient.setQueryData(["analytics-profile"], analytics);
      queryClient.invalidateQueries({ queryKey: ["fire"] });
      queryClient.setQueryData(["auth", "me"], { user });
      const session = readAuthSession();
      if (session) {
        useAuthStore.getState().setSession({ ...session, user: data.user });
      }
    },
  });
}

export function usePatchAnalyticsProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.patchAnalyticsProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["analytics-profile"], data);
      queryClient.invalidateQueries({ queryKey: ["fire"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
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

/** Paginated/sortable/filterable merchant report (server-computed). */
export function useMerchantsTable(params: ListQuery) {
  return useQuery({
    queryKey: ["merchants-table", params],
    queryFn: () => api.getMerchantsTable(params),
    placeholderData: keepPreviousData,
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
