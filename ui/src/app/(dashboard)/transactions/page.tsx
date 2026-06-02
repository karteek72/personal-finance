"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { TransactionListHeader } from "@/components/transactions/transaction-list-header";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { FilterSelect } from "@/components/ui/filter-select";
import { MonthPills } from "@/components/ui/month-pills";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import type { TransactionFilters } from "@/types/api";

type TransactionFilter = "all" | "expense" | "income" | "transfer";

const FILTER_OPTIONS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfers" },
];

const SORT_OPTIONS: { value: NonNullable<TransactionFilters["sort"]>; label: string }[] =
  [
    { value: "date_desc", label: "Newest first" },
    { value: "date_asc", label: "Oldest first" },
    { value: "amount_desc", label: "Amount high → low" },
    { value: "amount_asc", label: "Amount low → high" },
    { value: "name_asc", label: "Name A → Z" },
    { value: "category_asc", label: "Category A → Z" },
  ];

function monthQueryValue(selectedMonth: number | null): string | undefined {
  if (selectedMonth === null) {
    return undefined;
  }
  const year = new Date().getFullYear();
  return `${year}-${String(selectedMonth).padStart(2, "0")}`;
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [accountId, setAccountId] = useState(
    () => searchParams.get("accountId") ?? "",
  );
  const [category, setCategory] = useState(
    () => searchParams.get("category") ?? "",
  );
  const [sort, setSort] = useState<NonNullable<TransactionFilters["sort"]>>(
    "date_desc",
  );

  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();

  const { data, isLoading, error } = useTransactions({
    type: filter === "all" ? undefined : filter,
    q: search || undefined,
    month: monthQueryValue(selectedMonth),
    accountId: accountId || undefined,
    category: category || undefined,
    sort,
    limit: 100,
  });

  const accountOptions = useMemo(
    () => [
      { value: "", label: "All accounts" },
      ...(accountsData?.accounts.map((account) => ({
        value: account.id,
        label: account.mask
          ? `${account.name} •${account.mask}`
          : account.name,
      })) ?? []),
    ],
    [accountsData],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...(categoriesData?.categories.map((item) => ({
        value: item.name,
        label: item.name,
      })) ?? []),
    ],
    [categoriesData],
  );

  function updateUrlFilters(nextAccountId: string, nextCategory: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextAccountId) {
      params.set("accountId", nextAccountId);
    } else {
      params.delete("accountId");
    }
    if (nextCategory) {
      params.set("category", nextCategory);
    } else {
      params.delete("category");
    }
    const query = params.toString();
    router.replace(query ? `/transactions?${query}` : "/transactions", {
      scroll: false,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Activity</h2>
          <p className="text-sm text-text-muted">
            Search, filter, and sort your transactions
          </p>
        </div>
        <MonthPills selectedMonth={selectedMonth} onSelect={setSelectedMonth} />
      </header>

      <div className="flex flex-col gap-3">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Transaction type"
        >
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={`rounded-[var(--radius-pill)] border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                filter === option.id
                  ? "border-primary bg-primary text-text-inverse"
                  : "border-border bg-surface text-text-muted hover:border-primary/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            id="transaction-account-filter"
            label="Account"
            value={accountId}
            onChange={(value) => {
              setAccountId(value);
              updateUrlFilters(value, category);
            }}
            options={accountOptions}
          />
          <FilterSelect
            id="transaction-category-filter"
            label="Category"
            value={category}
            onChange={(value) => {
              setCategory(value);
              updateUrlFilters(accountId, value);
            }}
            options={categoryOptions}
          />
          <FilterSelect
            id="transaction-sort"
            label="Sort by"
            value={sort}
            onChange={(value) =>
              setSort(value as NonNullable<TransactionFilters["sort"]>)
            }
            options={SORT_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="transaction-search"
              className="text-xs font-medium text-text-muted"
            >
              Search
            </label>
            <input
              id="transaction-search"
              type="search"
              placeholder="Merchant or description…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <section
        aria-label="Transaction list"
        className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
      >
        <TransactionListHeader />

        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Loading transactions…
          </p>
        ) : null}

        {error ? (
          <p className="px-4 py-8 text-center text-sm text-danger">
            Failed to load transactions.
          </p>
        ) : null}

        {!isLoading && !error && data?.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            No transactions match your filters.
          </p>
        ) : null}

        {!isLoading && !error && data && data.items.length > 0 ? (
          <div>
            {data.items.map((transaction) => (
              <TransactionRow key={transaction.id} {...transaction} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-text-muted">Loading transactions…</p>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
