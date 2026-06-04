"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { invalidateFinancialQueries } from "@/lib/invalidate-financial-queries";
import { createTaskId, notifications } from "@/lib/notifications";

export function useBackgroundSyncHelpers(
  refetchAccounts: () => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMemo(() => {
    async function pollUntilDeadline(
      taskId: string,
      deadlineMs = 120_000,
    ): Promise<void> {
      const deadline = Date.now() + deadlineMs;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await refetchAccounts();
      }
      notifications.completeTask(
        taskId,
        "Refresh complete",
        "Your accounts and transactions are up to date.",
        "plaid-sync",
      );
    }

    return {
      invalidateFinancialQueries: () =>
        invalidateFinancialQueries(queryClient),
      startPlaidSyncAllTask(): string {
        const taskId = createTaskId("plaid-sync-all");
        notifications.startTask(
          taskId,
          "Refreshing all accounts",
          "Syncing linked banks in the background. You can keep using the app.",
          "plaid-sync",
        );
        return taskId;
      },
      startPlaidSyncAccountTask(accountName: string): string {
        const taskId = createTaskId("plaid-sync-account");
        notifications.startTask(
          taskId,
          `Refreshing ${accountName}`,
          "Syncing this account in the background.",
          "plaid-sync",
        );
        return taskId;
      },
      completePlaidSyncImmediate(
        taskId: string,
        added: number,
        modified: number,
      ): void {
        notifications.completeTask(
          taskId,
          "Refresh complete",
          `${added} new and ${modified} updated transactions.`,
          "plaid-sync",
        );
      },
      failPlaidSync(taskId: string, message: string): void {
        notifications.failTask(
          taskId,
          "Refresh failed",
          message,
          "plaid-sync",
        );
      },
      pollPlaidSyncBackground: pollUntilDeadline,
    };
  }, [queryClient, refetchAccounts]);
}
