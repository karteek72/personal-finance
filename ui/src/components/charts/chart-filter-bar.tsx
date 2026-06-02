"use client";

import clsx from "clsx";

import type { Account } from "@/types/api";

interface ChartFilterBarProps {
  accounts: Account[];
  categories: string[];
  selectedAccountId: string;
  selectedCategory: string;
  onAccountChange: (accountId: string) => void;
  onCategoryChange: (category: string) => void;
  onClear: () => void;
}

export function ChartFilterBar({
  accounts,
  categories,
  selectedAccountId,
  selectedCategory,
  onAccountChange,
  onCategoryChange,
  onClear,
}: ChartFilterBarProps) {
  const hasFilters = Boolean(selectedAccountId || selectedCategory);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Account
        </span>
        <button
          type="button"
          onClick={() => onAccountChange("")}
          className={clsx(
            "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
            !selectedAccountId
              ? "bg-primary text-text-inverse"
              : "bg-surface text-text-muted card-shadow hover:text-text",
          )}
        >
          All
        </button>
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() =>
              onAccountChange(
                selectedAccountId === account.id ? "" : account.id,
              )
            }
            className={clsx(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
              selectedAccountId === account.id
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow hover:text-text",
            )}
          >
            {account.mask ? `••${account.mask}` : account.name}
          </button>
        ))}
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Category
          </span>
          <button
            type="button"
            onClick={() => onCategoryChange("")}
            className={clsx(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
              !selectedCategory
                ? "bg-primary text-text-inverse"
                : "bg-surface text-text-muted card-shadow hover:text-text",
            )}
          >
            All
          </button>
          {categories.slice(0, 8).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                onCategoryChange(
                  selectedCategory === category ? "" : category,
                )
              }
              className={clsx(
                "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-all",
                selectedCategory === category
                  ? "bg-primary text-text-inverse"
                  : "bg-surface text-text-muted card-shadow hover:text-text",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="self-start text-xs font-semibold text-primary hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
