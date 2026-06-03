"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { AsyncPanel } from "@/components/ui/async-panel";
import { Card } from "@/components/ui/card";
import { IconButton, SyncIcon, TrashIcon } from "@/components/ui/icon-button";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useAccounts } from "@/hooks/use-accounts";
import { useBackgroundSyncHelpers } from "@/hooks/use-background-sync";
import { useCreditDebtSummary } from "@/hooks/use-credit-debt";
import { api } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";
import { formatMoney } from "@/lib/format-money";
import type { Account } from "@/types/api";

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
];

const FALLBACK_GRADIENT = CARD_GRADIENTS[0] ?? "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)";

function formatDueLabel(daysUntilDue: number | null | undefined): string {
  if (daysUntilDue == null) return "Due date unknown";
  if (daysUntilDue < 0) {
    const n = Math.abs(daysUntilDue);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (daysUntilDue === 0) return "Due today";
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}

const STATUS_ICON_WRAP = "flex h-8 w-8 items-center justify-center";

/** Compact status glyph rendered on the colored card header (tooltip via title). */
function AccountStatusIcon({ account }: { account: Account }) {
  if (account.status === "error") {
    return (
      <span title="Sync error — reconnect needed" className={`${STATUS_ICON_WRAP} text-red-200`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 7.3a1 1 0 011.4 0L10 7.6l-.1-.1 1.4 1.4L11.4 10l1.4 1.4-1.4 1.4L10 11.4 8.6 12.8 7.2 11.4 8.6 10 7.2 8.6l1.4-1.3z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (account.status === "reauth_required") {
    return (
      <span title="Reconnect required" className={`${STATUS_ICON_WRAP} text-amber-200`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (account.source === "plaid") {
    return (
      <span title="Live — synced from your bank" className={STATUS_ICON_WRAP}>
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 ring-2 ring-white/40" />
      </span>
    );
  }
  return (
    <span title="Imported from statement" className={`${STATUS_ICON_WRAP} opacity-80`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M4 3.5A1.5 1.5 0 015.5 2h5.6a1.5 1.5 0 011.06.44l2.9 2.9c.28.28.44.66.44 1.06V16.5A1.5 1.5 0 0114 18H5.5A1.5 1.5 0 014 16.5v-13zM11 3.5V6h2.5L11 3.5z" />
      </svg>
    </span>
  );
}

interface AccountGroup {
  key: string;
  label: string;
  emoji: string;
  accounts: Account[];
}

function groupAccounts(accounts: Account[]): AccountGroup[] {
  const sub = (a: Account) => (a.subtype ?? "").toLowerCase();
  const SAVINGS_SUBTYPES = ["savings", "money market", "cd", "hsa", "prepaid"];
  const defs: { key: string; label: string; emoji: string; match: (a: Account) => boolean }[] = [
    { key: "checking", label: "Checking", emoji: "🏦", match: (a) => a.type === "depository" && sub(a) === "checking" },
    { key: "savings", label: "Savings", emoji: "💰", match: (a) => a.type === "depository" && SAVINGS_SUBTYPES.includes(sub(a)) },
    { key: "cash", label: "Cash & Other", emoji: "👛", match: (a) => a.type === "depository" && sub(a) !== "checking" && !SAVINGS_SUBTYPES.includes(sub(a)) },
    { key: "credit", label: "Credit Cards", emoji: "💳", match: (a) => a.type === "credit" },
    { key: "investment", label: "Trading & Investments", emoji: "📈", match: (a) => a.type === "investment" },
  ];
  return defs
    .map((d) => ({ key: d.key, label: d.label, emoji: d.emoji, accounts: accounts.filter(d.match) }))
    .filter((g) => g.accounts.length > 0);
}

function formatTotal(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface AccountTileProps {
  account: Account;
  gradient: string;
  syncing: boolean;
  deleting: boolean;
  onSync: (account: Account) => void;
  onDelete: (account: Account) => void;
}

function AccountTile({ account, gradient, syncing, deleting, onSync, onDelete }: AccountTileProps) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] card-shadow">
      <div className="relative p-5 text-text-inverse" style={{ background: gradient }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              {account.institutionName}
            </p>
            <h3 className="mt-1 truncate text-lg font-bold">{account.name}</h3>
            {account.mask ? (
              <p className="mt-0.5 text-sm opacity-80">•••• {account.mask}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {account.type === "credit" && account.liability?.isOverdue ? (
              <span title="Payment overdue" className={`${STATUS_ICON_WRAP} text-red-200`}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12a.75.75 0 00-1.5 0v4c0 .2.08.39.22.53l2.5 2.5a.75.75 0 101.06-1.06l-2.28-2.28V6z" clipRule="evenodd" />
                </svg>
              </span>
            ) : null}
            <AccountStatusIcon account={account} />
            {account.source === "plaid" ? (
              <IconButton
                label={`Sync ${account.name}`}
                onClick={() => onSync(account)}
                disabled={syncing}
              >
                <SyncIcon className={syncing ? "animate-spin" : undefined} />
              </IconButton>
            ) : null}
            <IconButton
              label={`Remove ${account.name}`}
              onClick={() => onDelete(account)}
              disabled={deleting}
              variant="danger"
            >
              <TrashIcon />
            </IconButton>
          </div>
        </div>
        <p className="mt-4 text-2xl font-bold tabular-nums" data-money>
          {formatMoney(account.balanceCurrent)}
        </p>

        {account.type === "credit" && account.liability ? (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-3 text-xs">
            {account.liability.minimumPaymentAmount ? (
              <div>
                <p className="opacity-70">Min due</p>
                <p className="font-semibold tabular-nums" data-money>
                  {formatMoney(account.liability.minimumPaymentAmount)}
                  <span className="ml-1 font-normal opacity-80">
                    · {formatDueLabel(account.liability.daysUntilDue)}
                  </span>
                </p>
              </div>
            ) : null}
            {account.liability.lastPaymentAmount && account.liability.lastPaymentDate ? (
              <div>
                <p className="opacity-70">Last payment</p>
                <p className="font-semibold tabular-nums" data-money>
                  {formatMoney(account.liability.lastPaymentAmount)}
                  <span className="ml-1 font-normal opacity-80">
                    · {new Date(`${account.liability.lastPaymentDate}T00:00:00`).toLocaleDateString()}
                  </span>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {account.lastSyncedAt ? (
          <p className="mt-3 text-[11px] opacity-70">
            Synced {new Date(account.lastSyncedAt).toLocaleDateString()}
          </p>
        ) : account.source === "plaid" ? (
          <p className="mt-3 text-[11px] opacity-70">Not synced yet</p>
        ) : null}
      </div>

      {(() => {
        if (account.type !== "credit") return null;
        const liability = account.liability;
        if (!liability) {
          return (
            <div className="bg-surface px-4 py-3 text-xs">
              <p className="text-text-muted">
                Statement details sync shortly after linking. Enable Plaid Liabilities to see balance,
                due date, and APR here.
              </p>
            </div>
          );
        }
        const delta = liability.statementVsCurrentDelta
          ? Number.parseFloat(liability.statementVsCurrentDelta)
          : 0;
        const hasRateRow = Boolean(liability.purchaseApr) || Boolean(liability.estimatedMonthlyInterest);
        if (!hasRateRow && delta === 0) return null;
        return (
          <div className="flex flex-col gap-2 bg-surface px-4 py-3 text-xs">
            {hasRateRow ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-text-muted">
                {liability.purchaseApr ? (
                  <span>
                    APR <span className="font-semibold text-text">{liability.purchaseApr}%</span>
                  </span>
                ) : null}
                {liability.estimatedMonthlyInterest ? (
                  <span>
                    Est. interest{" "}
                    <span className="font-semibold text-text" data-money>
                      ~{formatMoney(liability.estimatedMonthlyInterest)}/mo
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {delta !== 0 ? (
              <p className="rounded-[var(--radius-sm)] bg-primary-soft/40 px-2.5 py-1.5 text-text-muted">
                {delta > 0
                  ? `${formatMoney(liability.statementVsCurrentDelta as string)} above last statement — new charges since close`
                  : `${formatMoney(String(Math.abs(delta)))} below last statement — payments or credits applied`}
              </p>
            ) : null}
          </div>
        );
      })()}
    </article>
  );
}

export function AccountsView() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useAccounts();
  const { data: debtSummary } = useCreditDebtSummary();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const refetchAccounts = useCallback(() => refetch(), [refetch]);
  const syncHelpers = useBackgroundSyncHelpers(refetchAccounts);

  const accounts = data?.accounts ?? [];
  const hasPlaidAccounts = accounts.some((account) => account.source === "plaid");
  const gradientById = new Map<string, string>(
    accounts.map((a, i) => [a.id, CARD_GRADIENTS[i % CARD_GRADIENTS.length] ?? FALLBACK_GRADIENT]),
  );

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
        subtitle="Balances, statements, and due dates — every account in one place"
        action={
          <>
            <Link
              href="/categories"
              title="Cash flow"
              aria-label="Cash flow"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-text-muted transition-all hover:bg-primary-soft hover:text-primary card-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />
              </svg>
            </Link>
            {hasPlaidAccounts ? (
              <IconButton
                label={syncingAll ? "Syncing all accounts…" : "Refresh all accounts"}
                disabled={syncingAll}
                onClick={() => void handleSyncAll()}
              >
                <SyncIcon className={syncingAll ? "animate-spin" : undefined} />
              </IconButton>
            ) : null}
            <PlaidLinkButton
              variant="icon"
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

      {debtSummary && debtSummary.cards.length > 0 ? (
        <section aria-label="Credit & debt overview" className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Credit balance"
              value={formatMoney(debtSummary.totalCurrentBalance)}
              tone="danger"
              compact
            />
            <KpiCard
              label="Statement total"
              value={formatMoney(debtSummary.totalStatementBalance)}
              compact
            />
            <KpiCard
              label="Minimum due"
              value={formatMoney(debtSummary.totalMinimumDue)}
              tone="warning"
              compact
            />
            <KpiCard
              label="Est. monthly interest"
              value={formatMoney(debtSummary.totalEstimatedMonthlyInterest)}
              compact
            />
          </div>
          <p className="px-1 text-xs text-text-muted">{debtSummary.coverageLabel}</p>
        </section>
      ) : null}

      {accounts.length > 0 ? (
        <div className="flex flex-col gap-6">
          {groupAccounts(accounts).map((group) => {
            const total = group.accounts.reduce(
              (s, a) => s + Number.parseFloat(a.balanceCurrent ?? "0"),
              0,
            );
            return (
              <section key={group.key} aria-label={group.label} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-text">
                    <span aria-hidden="true">{group.emoji}</span>
                    {group.label}
                    <span className="text-xs font-normal text-text-muted">
                      ({group.accounts.length})
                    </span>
                  </h3>
                  <span className="text-sm font-bold tabular-nums text-text" data-money>
                    {formatTotal(total)}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.accounts.map((account) => (
                    <AccountTile
                      key={account.id}
                      account={account}
                      gradient={gradientById.get(account.id) ?? FALLBACK_GRADIENT}
                      syncing={syncingId === account.id}
                      deleting={deletingId === account.id}
                      onSync={(a) => void handleSyncAccount(a.id, a.name)}
                      onDelete={(a) => void handleDeleteAccount(a.id, a.name, a.mask)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <PlaidLinkButton
            label="Add another account"
            variant="dashed"
            onSuccess={handleConnected}
          />
        </div>
      ) : null}
      </AsyncPanel>
    </div>
  );
}
