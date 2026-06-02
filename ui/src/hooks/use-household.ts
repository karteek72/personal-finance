"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export function useHousehold() {
  return useQuery({
    queryKey: ["household"],
    queryFn: () => api.getHousehold(),
  });
}

export function useHouseholdInsights() {
  return useQuery({
    queryKey: ["household-insights"],
    queryFn: () => api.getHouseholdInsights(),
  });
}

export function useHouseholdMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["household"] });
    void queryClient.invalidateQueries({ queryKey: ["household-insights"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["chart-data"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }

  return {
    invalidate,
    async createMember(input: {
      displayName: string;
      role: "partner" | "child" | "other";
    }) {
      const member = await api.createHouseholdMember(input);
      invalidate();
      return member;
    },
    async updateMember(
      memberId: string,
      input: { displayName?: string; role?: "owner" | "partner" | "child" | "other" },
    ) {
      const member = await api.updateHouseholdMember(memberId, input);
      invalidate();
      return member;
    },
    async deleteMember(memberId: string) {
      await api.deleteHouseholdMember(memberId);
      invalidate();
    },
    async assignAccount(accountId: string, memberId: string) {
      await api.assignAccountToMember(accountId, memberId);
      invalidate();
    },
    async renameHousehold(name: string) {
      await api.updateHouseholdName(name);
      invalidate();
    },
  };
}
