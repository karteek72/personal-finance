"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { IconButton, SyncIcon, TrashIcon } from "@/components/ui/icon-button";
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
      setStatusMessage("Bank account linked successfully.");
      invalidateFinancialQueries(queryClient);
      void refetch();
    }

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [queryClient, refetch]);

  function handleConnected() {
    setErrorMessage(null);
    setStatusMessage("Account connected. Syncing latest transactions…");
    invalidateFinancialQueries(queryClient);
    void refetch().then(() => {
      setStatusMessage("Account connected and transactions synced.");
    });
  }

  async function handleSyncAll() {
    setErrorMessage(null);
    setStatusMessage(null);
    setSyncingAll(true);

    try {
      const result = await api.syncAllPlaid();
      setStatusMessage(
        `Synced ${result.itemsSynced} institution(s): ${result.added} new, ${result.modified} updated transactions.`,
      );
      invalidateFinancialQueries(queryClient);
      await refetch();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sync accounts",
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
        `${accountName} synced — ${result.added} new, ${result.modified} updated.`,
      );
      invalidateFinancialQueries(queryClient);
      await refetch();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sync account",
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
      `Delete ${label} and all of its transactions? This cannot be undone.`,
    );
    if (!confirmed) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setDeletingId(accountId);

    try {
      const result = await api.deleteAccount(accountId);
      setStatusMessage(
        `Removed ${result.name} and ${result.transactionsDeleted} transactions.`,
      );
      invalidateFinancialQueries(queryClient);
      await refetch();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to delete account",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Connected</h2>
          <p className="text-sm text-text-muted">
            Link banks via Plaid or view imported statement accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPlaidAccounts ? (
            <button
              type="button"
              disabled={syncingAll}
              onClick={() => void handleSyncAll()}
              className="inline-flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SyncIcon className={syncingAll ? "animate-spin" : undefined} />
              {syncingAll ? "Syncing…" : "Sync all"}
            </button>
          ) : null}
          <PlaidLinkButton
            onSuccess={handleConnected}
            onError={(message) => {
              setStatusMessage(null);
              setErrorMessage(message);
            }}
          />
        </div>
      </header>

      {statusMessage ? (
        <p className="rounded-[var(--radius-card)] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading accounts…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-danger">Failed to load accounts.</p>
      ) : null}

      {!isLoading && !error && accounts.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-base font-medium text-text">No accounts connected</p>
          <p className="mt-1 text-sm text-text-muted">
            Connect your first bank or credit card through Plaid to pull live
            transactions.
          </p>
          <div className="mt-4 flex justify-center">
            <PlaidLinkButton onSuccess={handleConnected} />
          </div>
        </div>
      ) : null}

      {!isLoading && !error && accounts.length > 0 ? (
        <section
          aria-label="Connected accounts"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-text">
                    {account.name}
                  </h3>
                  <p className="truncate text-sm text-text-muted">
                    {account.institutionName}
                    {account.mask ? ` · •••• ${account.mask}` : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {account.source === "plaid" ? (
                    <IconButton
                      label={`Sync ${account.name}`}
                      disabled={syncingId === account.id || syncingAll}
                      onClick={() =>
                        void handleSyncAccount(account.id, account.name)
                      }
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
                    variant="danger"
                    disabled={deletingId === account.id}
                    onClick={() =>
                      void handleDeleteAccount(
                        account.id,
                        account.name,
                        account.mask,
                      )
                    }
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>

              <div className="mt-2">
                <span
                  className={`inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium capitalize ${
                    account.status === "active"
                      ? "bg-success/15 text-success"
                      : account.status === "reauth_required"
                        ? "bg-warning/15 text-warning"
                        : "bg-danger/15 text-danger"
                  }`}
                >
                  {account.source === "plaid" ? "Plaid" : "Import"}
                </span>
              </div>

              <p
                className="mt-4 font-mono text-xl font-medium tabular-nums text-text"
                data-money
              >
                {formatMoney(account.balanceCurrent)}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div>
                  <dt>Type</dt>
                  <dd className="mt-0.5 capitalize text-text">
                    {account.subtype ?? account.type}
                  </dd>
                </div>
                <div>
                  <dt>Last synced</dt>
                  <dd className="mt-0.5 text-text">
                    {account.lastSyncedAt
                      ? new Date(account.lastSyncedAt).toLocaleString()
                      : account.source === "import"
                        ? "Statement import"
                        : "Never"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
