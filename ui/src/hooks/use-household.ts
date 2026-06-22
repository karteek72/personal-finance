"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { invalidateFinancialQueries } from "@/lib/invalidate-financial-queries";

export function useHousehold() {
  return useQuery({
    queryKey: ["household"],
    queryFn: () => api.getHousehold(),
  });
}

export function useHouseholdInsights(from?: string, to?: string) {
  return useQuery({
    queryKey: ["household-insights", from, to],
    queryFn: () => api.getHouseholdInsights(from, to),
  });
}

export function useHouseholdMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    invalidateFinancialQueries(queryClient);
    void queryClient.invalidateQueries({ queryKey: ["household"] });
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
    async inviteMember(memberId: string, email: string) {
      const result = await api.inviteHouseholdMember(memberId, email);
      invalidate();
      return result;
    },
    async revokeInvite(memberId: string) {
      await api.revokeHouseholdInvite(memberId);
      invalidate();
    },
  };
}
