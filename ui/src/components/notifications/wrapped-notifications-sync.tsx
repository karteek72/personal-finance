"use client";

import { useEffect } from "react";

import { useHasActiveAccounts } from "@/hooks/use-has-active-accounts";
import { useWrapped } from "@/hooks/use-features";
import { useNotificationStore } from "@/stores/notification-store";

/** Adds a year-in-review notification when wrapped data is available. */
export function WrappedNotificationsSync() {
  const { hasAccounts, isLoading: accountsLoading } = useHasActiveAccounts();
  const { data, isError, isLoading } = useWrapped();
  const syncWrappedNotification = useNotificationStore(
    (state) => state.syncWrappedNotification,
  );

  useEffect(() => {
    if (accountsLoading || isLoading) return;

    const available =
      hasAccounts && !isError && !!data && data.transactionCount > 0;

    syncWrappedNotification(
      available ? { year: data!.year } : null,
    );
  }, [
    accountsLoading,
    data,
    hasAccounts,
    isError,
    isLoading,
    syncWrappedNotification,
  ]);

  return null;
}
