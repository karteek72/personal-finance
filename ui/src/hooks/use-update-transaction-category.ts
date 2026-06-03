"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      transactionId: string;
      category: string;
      subCategory?: string | null;
      rememberForMerchant?: boolean;
    }) =>
      api.updateTransactionCategory(
        input.transactionId,
        input.category,
        input.subCategory ?? null,
        input.rememberForMerchant ?? true,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["summary"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["chart-data"] });
      void queryClient.invalidateQueries({ queryKey: ["household-insights"] });
    },
  });
}
