"use client";

import { useAccounts } from "@/hooks/use-accounts";

/** True when the user has at least one connected financial account. */
export function useHasActiveAccounts(): {
  hasAccounts: boolean;
  isLoading: boolean;
} {
  const { data, isLoading, isFetching } = useAccounts();
  const count = data?.accounts?.length ?? 0;
  return {
    hasAccounts: count > 0,
    isLoading: isLoading || (isFetching && count === 0),
  };
}
