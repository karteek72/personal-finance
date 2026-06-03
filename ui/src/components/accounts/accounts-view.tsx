"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { AsyncPanel } from "@/components/ui/async-panel";
import { Card } from "@/components/ui/card";
import { IconButton, SyncIcon, TrashIcon } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { useAccounts } from "@/hooks/use-accounts";
import { useBackgroundSyncHelpers } from "@/hooks/use-background-sync";
import { api } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";
import { formatMoney } from "@/lib/format-money";

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
];

export function AccountsView() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useAccounts();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const refetchAccounts = useCallback(() => refetch(), [refetch]);
  const syncHelpers = useBackgroundSyncHelpers(refetchAccounts);

  const accounts = data?.accounts ?? [];
  const hasPlaidAccounts = accounts.some((account) => account.source === "plaid");

  useEffect(() => {
    function handleOAuthMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "spendflow:plaid-oauth-success") return;

      notifications.push(
        "success",
        "Bank linked",
        "Your account is connected. Transactions will sync shortly.",
        "plaid-link",
      );
      syncHelpers.invalidateFinancialQueries();
      void refetch();
    }

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [queryClient, refetch]);

  function handleConnected() {
    notifications.push(
      "progress",
      "Connecting account",
      "Syncing your latest transactions…",
      "plaid-link",
    );
    syncHelpers.invalidateFinancialQueries();
    void refetch().then(() => {
      notifications.push(
        "success",
        "Account connected",
        "Your bank is linked and transactions are syncing.",
        "plaid-link",
      );
    });
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    const taskId = syncHelpers.startPlaidSyncAllTask();

    try {
      const result = await api.syncAllPlaid();
      syncHelpers.invalidateFinancialQueries();

      if (result.status === "started") {
        await syncHelpers.pollPlaidSyncBackground(taskId);
        return;
      }

      syncHelpers.completePlaidSyncImmediate(
        taskId,
        result.added,
        result.modified,
      );
      await refetch();
    } catch (err) {
      syncHelpers.failPlaidSync(
        taskId,
        err instanceof Error ? err.message : "Sync failed — try again",
      );
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleSyncAccount(accountId: string, accountName: string) {
    setSyncingId(accountId);
    const taskId = syncHelpers.startPlaidSyncAccountTask(accountName);

    try {
      const result = await api.syncAccount(accountId);
      syncHelpers.invalidateFinancialQueries();

      if (result.status === "started") {
        await syncHelpers.pollPlaidSyncBackground(taskId);
        return;
      }

      syncHelpers.completePlaidSyncImmediate(
        taskId,
        result.added,
        result.modified,
      );
      await refetch();
    } catch (err) {
      syncHelpers.failPlaidSync(
        taskId,
        err instanceof Error ? err.message : "Sync failed — try again",
      );
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDeleteAccount(
    accountId: string,
    accountName: string,
    mask: string | null,
  ) {
    const label = mask ? `${accountName} (•••• ${mask})` : accountName;
    const confirmed = window.confirm(
      `Remove ${label} and all its transactions? Can't undo this.`,
    );
    if (!confirmed) return;

    setDeletingId(accountId);

    try {
      const result = await api.deleteAccount(accountId);
      notifications.push(
        "success",
        "Account removed",
        `Removed ${result.name} (${result.transactionsDeleted} transactions).`,
        "system",
      );
      syncHelpers.invalidateFinancialQueries();
      await refetch();
    } catch (err) {
      notifications.push(
        "error",
        "Could not remove account",
        err instanceof Error ? err.message : "Please try again.",
        "system",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Your accounts"
        subtitle="Connect banks or manage imported statements"
        action={
          <>
            <Link
              href="/categories"
              className="inline-flex items-center rounded-[var(--radius-pill)] bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-opacity hover:opacity-80 card-shadow"
            >
              Cash flow
            </Link>
            <Link
              href="/debt"
              className="inline-flex items-center rounded-[var(--radius-pill)] bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-opacity hover:opacity-80 card-shadow"
            >
              Credit & debt
            </Link>
            {hasPlaidAccounts ? (
              <button
                type="button"
                disabled={syncingAll}
                onClick={() => void handleSyncAll()}
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-opacity hover:opacity-80 disabled:opacity-50 card-shadow"
              >
                <SyncIcon className={syncingAll ? "animate-spin" : undefined} />
                {syncingAll ? "Syncing…" : "Refresh all"}
              </button>
            ) : null}
            <PlaidLinkButton
              label="Add account"
              onSuccess={handleConnected}
              onError={(message) => {
                notifications.push(
                  "error",
                  "Could not link account",
                  message,
                  "plaid-link",
                );
              }}
            />
          </>
        }
      />

      <AsyncPanel
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        loadingMessage="Loading your accounts…"
        errorMessage="Couldn't load accounts."
        className="contents"
      >
      {accounts.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-2xl">
            💳
          </div>
          <p className="mt-4 text-lg font-bold text-text">No accounts yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Link your bank or card to see balances and transactions here.
          </p>
          <div className="mt-5 flex justify-center">
            <PlaidLinkButton label="Connect your first account" onSuccess={handleConnected} />
          </div>
        </Card>
      ) : null}

      {accounts.length > 0 ? (
        <section
          aria-label="Connected accounts"
          className="grid gap-4 sm:grid-cols-2"
        >
          {accounts.map((account, index) => (
            <article
              key={account.id}
              className="overflow-hidden rounded-[var(--radius-card)] card-shadow"
            >
              <div
                className="relative p-5 text-text-inverse"
                style={{
                  background:
                    CARD_GRADIENTS[index % CARD_GRADIENTS.length],
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                      {account.institutionName}
                    </p>
                    <h3 className="mt-1 truncate text-lg font-bold">
                      {account.name}
                    </h3>
                    {account.mask ? (
                      <p className="mt-0.5 text-sm opacity-80">
                        •••• {account.mask}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {account.source === "plaid" ? (
                      <IconButton
                        label={`Sync ${account.name}`}
                        onClick={() =>
                          void handleSyncAccount(account.id, account.name)
                        }
                        disabled={syncingId === account.id}
                      >
                        <SyncIcon
                          className={
                            syncingId === account.id ? "animate-spin" : undefined
                          }
                        />
                      </IconButton>
                    ) : null}
                    <IconButton
                      label={`Remove ${account.name}`}
                      onClick={() =>
                        void handleDeleteAccount(
                          account.id,
                          account.name,
                          account.mask,
                        )
                      }
                      disabled={deletingId === account.id}
                      variant="danger"
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-bold tabular-nums" data-money>
                  {formatMoney(account.balanceCurrent)}
                </p>
              </div>
              <div className="flex flex-col gap-1 bg-surface px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-[var(--radius-pill)] px-2 py-0.5 font-semibold ${
                      account.status === "active"
                        ? "bg-success/15 text-success"
                        : account.status === "reauth_required"
                          ? "bg-warning/15 text-warning"
                          : "bg-danger/15 text-danger"
                    }`}
                  >
                    {account.source === "plaid" ? "Live" : "Imported"}
                  </span>
                  <span className="text-text-muted">
                    {account.lastSyncedAt
                      ? new Date(account.lastSyncedAt).toLocaleDateString()
                      : account.source === "import"
                        ? "From statement"
                        : "Not synced yet"}
                  </span>
                </div>
                {account.type === "credit" && account.liability ? (
                  <p className="text-text-muted">
                    Min due{" "}
                    {account.liability.minimumPaymentAmount
                      ? formatMoney(account.liability.minimumPaymentAmount)
                      : "—"}
                    {account.liability.nextPaymentDueDate
                      ? ` · due ${new Date(`${account.liability.nextPaymentDueDate}T00:00:00`).toLocaleDateString()}`
                      : ""}
                    {account.liability.isOverdue ? (
                      <span className="ml-1 font-semibold text-danger">· Overdue</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </article>
          ))}

          <PlaidLinkButton
            label="Add another account"
            variant="dashed"
            onSuccess={handleConnected}
          />
        </section>
      ) : null}
      </AsyncPanel>
    </div>
  );
}
