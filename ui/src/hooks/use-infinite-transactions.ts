"use client";

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import type {
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
} from "@/types/api";

const DEFAULT_PAGE_SIZE = 50;

export type InfiniteTransactionFilters = Omit<
  TransactionFilters,
  "cursor" | "limit"
>;

export function useInfiniteTransactions(
  filters: InfiniteTransactionFilters = {},
  pageSize: number = DEFAULT_PAGE_SIZE,
) {
  return useInfiniteQuery({
    queryKey: ["transactions", "infinite", filters, pageSize],
    queryFn: ({ pageParam }) =>
      api.getTransactions({
        ...filters,
        limit: pageSize,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function flattenTransactionPages(
  pages: { items: Transaction[] }[] | undefined,
): Transaction[] {
  if (!pages) {
    return [];
  }
  return pages.flatMap((page) => page.items);
}

/** Fetches every remaining page until `nextCursor` is exhausted. */
export async function fetchAllTransactionPages(
  fetchNextPage: UseInfiniteQueryResult<
    InfiniteData<PaginatedTransactions>,
    Error
  >["fetchNextPage"],
  hasNextPage: boolean,
): Promise<number> {
  let pagesFetched = 0;
  let hasMore = hasNextPage;

  while (hasMore) {
    const result = await fetchNextPage();
    pagesFetched += 1;
    hasMore = result.hasNextPage ?? false;
  }

  return pagesFetched;
}
