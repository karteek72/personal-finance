"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { Card } from "@/components/ui/card";
import { IconButton, SyncIcon, TrashIcon } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { useAccounts } from "@/hooks/use-accounts";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";

function invalidateFinancialQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: ["accounts"] });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: ["categories"] });
}

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
];

function StatusToast({
  message,
  variant,
}: {
  message: string;
  variant: "success" | "error";
}) {
  return (
    <p
      className={`rounded-[var(--radius-card)] px-4 py-3 text-sm font-medium card-shadow ${
        variant === "success"
          ? "bg-success/10 text-success"
          : "bg-danger/10 text-danger"
      }`}
    >
      {message}
    </p>
  );
}

export function AccountsView() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useAccounts();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const accounts = data?.accounts ?? [];
  const hasPlaidAccounts = accounts.some((account) => account.source === "plaid");

  useEffect(() => {
    function handleOAuthMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "spendflow:plaid-oauth-success") return;

      setErrorMessage(null);
      setStatusMessage("Bank linked — you're all set ✓");
      invalidateFinancialQueries(queryClient);
      void refetch();
    }

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [queryClient, refetch]);

  function handleConnected() {
    setErrorMessage(null);
    setStatusMessage("Syncing your latest transactions…");
    invalidateFinancialQueries(queryClient);
    void refetch().then(() => {
      setStatusMessage("Account connected and synced ✓");
    });
  }

  async function handleSyncAll() {
    setErrorMessage(null);
    setStatusMessage(null);
    setSyncingAll(true);

    try {
      const result = await api.syncAllPlaid();
      setStatusMessage(
        `Updated — ${result.added} new, ${result.modified} changed`,
      );
      invalidateFinancialQueries(queryClient);
      await refetch();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Sync failed — try again",
      );
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleSyncAccount(accountId: string, accountName: string) {
    setErrorMessage(null);
    setStatusMessage(null);
    setSyncingId(accountId);

    try {
      const result = await api.syncAccount(accountId);
      setStatusMessage(
        `${accountName} — ${result.added} new transactions`,
      );
      invalidateFinancialQueries(queryClient);
      await refetch();
    } catch (err) {
      setErrorMessage(
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

    setErrorMessage(null);
    setStatusMessage(null);
    setDeletingId(accountId);

    try {
      const result = await api.deleteAccount(accountId);
      setStatusMessage(
        `Removed ${result.name} (${result.transactionsDeleted} transactions)`,
      );
      invalidateFinancialQueries(queryClient);
      await refetch();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Couldn't delete account",
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
                setStatusMessage(null);
                setErrorMessage(message);
              }}
            />
          </>
        }
      />

      {statusMessage ? (
        <StatusToast message={statusMessage} variant="success" />
      ) : null}
      {errorMessage ? (
        <StatusToast message={errorMessage} variant="error" />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading your accounts…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-danger">Couldn't load accounts.</p>
      ) : null}

      {!isLoading && !error && accounts.length === 0 ? (
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

      {!isLoading && !error && accounts.length > 0 ? (
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
                  <div className="flex shrink-0 items-center gap-0.5">
                    {account.source === "plaid" ? (
                      <IconButton
                        label={`Sync ${account.name}`}
                        variant="ghost"
                        disabled={syncingId === account.id || syncingAll}
                        onClick={() =>
                          void handleSyncAccount(account.id, account.name)
                        }
                        className="text-white/90 hover:bg-white/20 hover:text-white"
                      >
                        <SyncIcon
                          className={
                            syncingId === account.id ? "animate-spin" : undefined
                          }
                        />
                      </IconButton>
                    ) : null}
                    <IconButton
                      label={`Delete ${account.name}`}
                      variant="ghost"
                      disabled={deletingId === account.id}
                      onClick={() =>
                        void handleDeleteAccount(
                          account.id,
                          account.name,
                          account.mask,
                        )
                      }
                      className="text-white/90 hover:bg-white/20 hover:text-white"
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>

                <p
                  className="mt-6 text-3xl font-extrabold tracking-tight tabular-nums"
                  data-money
                >
                  {formatMoney(account.balanceCurrent)}
                </p>
              </div>

              <div className="flex items-center justify-between bg-surface px-5 py-3 text-xs">
                <span
                  className={`rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold capitalize ${
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
            </article>
          ))}

          <PlaidLinkButton
            label="Add another account"
            variant="dashed"
            onSuccess={handleConnected}
          />
        </section>
      ) : null}
    </div>
  );
}
