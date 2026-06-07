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
import type {
  CreateGoalInput,
  ListQuery,
  PatchBudgetInput,
  PatchGoalInput,
  UpsertBudgetInput,
} from "@/types/api";

/**
 * Hooks for the demo-dataset feature endpoints (wealth, planning, insights,
 * protect, coach & wrapped). Each maps 1:1 to an `api.*` method that resolves
 * from the live backend or the bundled UI mocks depending on NEXT_PUBLIC_USE_MOCKS.
 */

export function useNetWorth() {
  return useQuery({ queryKey: ["net-worth"], queryFn: () => api.getNetWorth() });
}

export function useInvestments(params: ListQuery & { accountId?: string } = {}) {
  return useQuery({
    queryKey: ["investments", params],
    queryFn: () => api.getInvestments(params),
    placeholderData: keepPreviousData,
  });
}

export function useRecurring(params: ListQuery = {}) {
  return useQuery({
    queryKey: ["recurring", params],
    queryFn: () => api.getRecurring(params),
    placeholderData: keepPreviousData,
  });
}

import type { FireQueryOverrides } from "@/types/api";

export function useFire(overrides: FireQueryOverrides = {}) {
  return useQuery({
    queryKey: ["fire", overrides],
    queryFn: () => api.getFire(overrides),
  });
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

function invalidateBudgets(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["budgets"] });
  void queryClient.invalidateQueries({ queryKey: ["calendar"] });
  void queryClient.invalidateQueries({ queryKey: ["forecast"] });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertBudgetInput) => api.upsertBudget(body),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function usePatchBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      budgetId,
      body,
    }: {
      budgetId: string;
      body: PatchBudgetInput;
    }) => api.patchBudget(budgetId, body),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (budgetId: string) => api.deleteBudget(budgetId),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGoalInput) => api.createGoal(body),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function usePatchGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      goalId,
      body,
    }: {
      goalId: string;
      body: PatchGoalInput;
    }) => api.patchGoal(goalId, body),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => api.deleteGoal(goalId),
    onSuccess: () => invalidateBudgets(queryClient),
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

export function useInflation(params: ListQuery = {}) {
  return useQuery({
    queryKey: ["inflation", params],
    queryFn: () => api.getInflation(params),
    placeholderData: keepPreviousData,
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
