"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { TransactionList } from "@/components/transactions/transaction-list";
import { Card } from "@/components/ui/card";
import { SectionLoader } from "@/components/ui/section-loader";
import { FilterSelect } from "@/components/ui/filter-select";
import { MonthFilterSelect } from "@/components/ui/month-filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import type { InfiniteTransactionFilters } from "@/hooks/use-infinite-transactions";
import { useHousehold } from "@/hooks/use-household";
import { api } from "@/lib/api-client";
import type { TransactionFilters } from "@/types/api";
import { useViewModeStore } from "@/stores/view-mode-store";

type TransactionFilter = "all" | "expense" | "income" | "transfer";

const FILTER_OPTIONS: { id: TransactionFilter; label: string; emoji: string }[] =
  [
    { id: "all", label: "All", emoji: "✨" },
    { id: "expense", label: "Spent", emoji: "💸" },
    { id: "income", label: "In", emoji: "💰" },
    { id: "transfer", label: "Moves", emoji: "↔️" },
  ];

const SORT_OPTIONS: { value: NonNullable<TransactionFilters["sort"]>; label: string }[] =
  [
    { value: "date_desc", label: "Newest" },
    { value: "date_asc", label: "Oldest" },
    { value: "amount_desc", label: "Biggest first" },
    { value: "amount_asc", label: "Smallest first" },
    { value: "name_asc", label: "Name A–Z" },
    { value: "category_asc", label: "Category A–Z" },
  ];

function monthQueryValue(selectedMonth: string | null): string | undefined {
  return selectedMonth ?? undefined;
}

const SORT_VALUES = new Set(
  SORT_OPTIONS.map((option) => option.value),
);

function readSortFromUrl(value: string | null): NonNullable<TransactionFilters["sort"]> {
  if (value && SORT_VALUES.has(value as NonNullable<TransactionFilters["sort"]>)) {
    return value as NonNullable<TransactionFilters["sort"]>;
  }
  return "date_desc";
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(
    () => searchParams.get("accountId") ?? "",
  );
  const [category, setCategory] = useState(
    () => searchParams.get("category") ?? "",
  );
  const [subCategory, setSubCategory] = useState(
    () => searchParams.get("subCategory") ?? "",
  );
  const [sort, setSort] = useState<NonNullable<TransactionFilters["sort"]>>(() =>
    readSortFromUrl(searchParams.get("sort")),
  );
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const scope = useViewModeStore((state) => state.scope);

  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data: householdData } = useHousehold();

  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const transactionFilters: InfiniteTransactionFilters = {
    type: filter === "all" ? undefined : filter,
    q: search || undefined,
    month: monthQueryValue(selectedMonth),
    accountId: accountId || undefined,
    category: category || undefined,
    subCategory: subCategory || undefined,
    memberId: selectedMemberId || undefined,
    scope: selectedMemberId ? undefined : scope,
    sort,
  };

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

  function updateUrlFilters(patch: {
    accountId?: string;
    category?: string;
    sort?: string;
    q?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextAccountId = patch.accountId ?? accountId;
    const nextCategory = patch.category ?? category;
    const nextSort = patch.sort ?? sort;
    const nextQ = patch.q ?? search;

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
    if (nextSort && nextSort !== "date_desc") {
      params.set("sort", nextSort);
    } else {
      params.delete("sort");
    }
    if (nextQ.trim()) {
      params.set("q", nextQ.trim());
    } else {
      params.delete("q");
    }
    const query = params.toString();
    router.replace(query ? `/transactions?${query}` : "/transactions", {
      scroll: false,
    });
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      const urlQ = searchParams.get("q") ?? "";
      if (search.trim() !== urlQ.trim()) {
        updateUrlFilters({ q: search });
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleExportCsv() {
    setExporting(true);
    setCategoryFeedback(null);
    try {
      await api.exportTransactionsCsv(transactionFilters);
    } catch (error) {
      setCategoryFeedback(
        error instanceof Error ? error.message : "Export failed",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title="Recent activity"
        subtitle="Everything you've spent, earned, or moved"
        action={
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="rounded-[var(--radius-pill)] bg-surface px-3 py-2 text-xs font-semibold text-text card-shadow transition-colors hover:text-primary disabled:opacity-60 sm:px-4 sm:text-sm"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        }
      />

      {householdData && householdData.members.length > 0 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <button
            type="button"
            onClick={() => setSelectedMemberId("")}
            className={`shrink-0 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold ${
              !selectedMemberId
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow"
            }`}
          >
            All family
          </button>
          {householdData.members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() =>
                setSelectedMemberId(
                  selectedMemberId === member.id ? "" : member.id,
                )
              }
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold ${
                selectedMemberId === member.id
                  ? "bg-primary text-text-inverse"
                  : "bg-surface text-text-muted card-shadow"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: member.avatarColor }}
              />
              {member.displayName}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
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
            className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition-all sm:px-4 ${
              filter === option.id
                ? "bg-primary text-text-inverse shadow-sm"
                : "bg-surface text-text-muted card-shadow hover:text-text"
            }`}
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          id="transaction-search"
          type="search"
          placeholder="Search merchants…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-[var(--radius-card)] border-0 bg-surface py-3 pl-4 pr-4 text-sm text-text card-shadow outline-none placeholder:text-text-muted focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MonthFilterSelect
          selectedMonth={selectedMonth}
          onChange={setSelectedMonth}
        />
        <FilterSelect
          id="transaction-account-filter"
          label="Account"
          value={accountId}
          onChange={(value) => {
            setAccountId(value);
            updateUrlFilters({ accountId: value });
          }}
          options={accountOptions}
        />
        <FilterSelect
          id="transaction-category-filter"
          label="Category"
          value={category}
          onChange={(value) => {
            setCategory(value);
            updateUrlFilters({ category: value });
          }}
          options={categoryOptions}
        />
        <FilterSelect
          id="transaction-sort"
          label="Sort"
          value={sort}
          onChange={(value) => {
            const next = value as NonNullable<TransactionFilters["sort"]>;
            setSort(next);
            updateUrlFilters({ sort: next });
          }}
          options={SORT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </div>

      {categoryFeedback ? (
        <p className="rounded-[var(--radius-sm)] bg-primary-soft/60 px-3 py-2 text-sm text-primary">
          {categoryFeedback}
        </p>
      ) : null}

      <Card padding="none" className="min-w-0 overflow-x-auto">
        <TransactionList
          filters={transactionFilters}
          pageSize={50}
          emptyMessage="Nothing here — try changing your filters"
          loadingMessage="Loading activity…"
          onCategoryUpdated={setCategoryFeedback}
        />
      </Card>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={<SectionLoader message="Loading activity…" />}
    >
      <TransactionsContent />
    </Suspense>
  );
}
