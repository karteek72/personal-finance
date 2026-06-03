"use client";

import clsx from "clsx";
import { useCallback, useState } from "react";

import { TransactionRow } from "@/components/transactions/transaction-row";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AsyncPanel } from "@/components/ui/async-panel";
import {
  fetchAllTransactionPages,
  flattenTransactionPages,
  useInfiniteTransactions,
  type InfiniteTransactionFilters,
} from "@/hooks/use-infinite-transactions";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";
import { useUpdateTransactionCategory } from "@/hooks/use-update-transaction-category";

interface TransactionListProps {
  filters: InfiniteTransactionFilters;
  pageSize?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  onCategoryUpdated?: (message: string) => void;
  /** Auto-fetch the next page when the user scrolls near the end */
  infiniteScroll?: boolean;
  /** Show a control to fetch every remaining page in one action */
  showLoadAll?: boolean;
}

export function TransactionList({
  filters,
  pageSize = 50,
  emptyMessage = "No transactions found.",
  loadingMessage = "Loading transactions…",
  className,
  onCategoryUpdated,
  infiniteScroll = true,
  showLoadAll = true,
}: TransactionListProps) {
  const {
    data,
    isLoading,
    isFetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactions(filters, pageSize);

  const updateCategory = useUpdateTransactionCategory();
  const items = flattenTransactionPages(data?.pages);
  const loadedCount = items.length;
  const [loadingAll, setLoadingAll] = useState(false);

  const loadNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || loadingAll) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, loadingAll]);

  const sentinelRef = useInfiniteScrollSentinel(loadNextPage, {
    enabled: infiniteScroll && loadedCount > 0 && Boolean(hasNextPage),
  });

  async function handleLoadAll(): Promise<void> {
    if (!hasNextPage || loadingAll) {
      return;
    }
    setLoadingAll(true);
    try {
      await fetchAllTransactionPages(fetchNextPage, hasNextPage);
    } finally {
      setLoadingAll(false);
    }
  }

  const busyLoadingMore = isFetchingNextPage || loadingAll;

  return (
    <AsyncPanel
      isLoading={isLoading}
      isFetching={isFetching && !busyLoadingMore}
      error={error}
      loadingMessage={loadingMessage}
      className={className}
    >
      {loadedCount === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-text-muted">
          {emptyMessage}
        </p>
      ) : (
        <>
          <p className="border-b border-border/60 px-4 py-2 text-xs text-text-muted">
            {hasNextPage
              ? `Showing ${loadedCount} — scroll for more or load all`
              : `Showing all ${loadedCount} transaction${loadedCount === 1 ? "" : "s"}`}
          </p>
          <div className="divide-y divide-border/60">
            {items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                {...transaction}
                categoryUpdating={
                  updateCategory.isPending &&
                  updateCategory.variables?.transactionId === transaction.id
                }
                onCategoryChange={(nextCategory) => {
                  if (nextCategory === transaction.category) return;
                  updateCategory.mutate(
                    {
                      transactionId: transaction.id,
                      category: nextCategory,
                    },
                    {
                      onSuccess: (result) => {
                        const count = result.merchantTransactionsUpdated;
                        const merchant =
                          transaction.merchantName ?? transaction.name;
                        onCategoryUpdated?.(
                          count > 1
                            ? `Updated ${count} transactions for ${merchant} to ${nextCategory}.`
                            : `Saved ${nextCategory} for ${merchant} on future transactions.`,
                        );
                      },
                      onError: (err) => {
                        onCategoryUpdated?.(
                          err instanceof Error
                            ? err.message
                            : "Could not update category",
                        );
                      },
                    },
                  );
                }}
              />
            ))}
          </div>

          {hasNextPage ? (
            <div className="border-t border-border/60 px-4 py-4">
              <div
                ref={sentinelRef}
                className="flex min-h-8 flex-col items-center justify-center gap-3"
                aria-hidden={!infiniteScroll}
              >
                {busyLoadingMore ? (
                  <div
                    className="flex items-center gap-2 text-sm text-text-muted"
                    aria-live="polite"
                  >
                    <LoadingSpinner size="sm" label="Loading more transactions" />
                    {loadingAll ? "Loading all transactions…" : "Loading more…"}
                  </div>
                ) : infiniteScroll ? (
                  <p className="text-xs text-text-muted">
                    Scroll down to load more
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  disabled={busyLoadingMore}
                  onClick={() => void loadNextPage()}
                  className={clsx(
                    "flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-border/40 disabled:cursor-not-allowed disabled:opacity-60 card-shadow sm:flex-initial",
                  )}
                >
                  Load more
                </button>
                {showLoadAll ? (
                  <button
                    type="button"
                    disabled={busyLoadingMore}
                    onClick={() => void handleLoadAll()}
                    className={clsx(
                      "flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial",
                    )}
                  >
                    Load all
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="border-t border-border/60 px-4 py-3 text-center text-xs text-text-muted">
              All matching transactions loaded
            </p>
          )}
        </>
      )}
    </AsyncPanel>
  );
}
