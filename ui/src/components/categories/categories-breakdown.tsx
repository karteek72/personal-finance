"use client";

import Link from "next/link";
import { useState } from "react";

import { CategoryRow } from "@/components/categories/category-row";
import { TransactionListHeader } from "@/components/transactions/transaction-list-header";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { useTransactions } from "@/hooks/use-transactions";
import { getCategoryColor } from "@/lib/category-colors";
import { formatMoney } from "@/lib/format-money";
import type { CategoryTotal } from "@/types/api";

interface CategoriesBreakdownProps {
  categories: CategoryTotal[];
}

function formatDeltaPercent(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

export function CategoriesBreakdown({ categories }: CategoriesBreakdownProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading, error } = useTransactions({
    category: selectedCategory ?? undefined,
    limit: 25,
    sort: "date_desc",
  });

  return (
    <section aria-label="Category usage" className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        <div
          className="flex h-3 w-full"
          role="img"
          aria-label="Proportional spend by category"
        >
          {categories.map((category) => (
            <div
              key={category.name}
              className="h-full"
              style={{
                width: `${category.percentage}%`,
                backgroundColor: getCategoryColor(category.name),
              }}
              title={`${category.name}: ${category.percentage.toFixed(1)}%`}
            />
          ))}
        </div>
        <ul className="divide-y divide-border p-2">
          {categories.map((category) => (
            <li key={category.name}>
              <CategoryRow
                name={category.name}
                percentage={category.percentage}
                amount={formatMoney(category.amount)}
                delta={formatDeltaPercent(category.deltaVsPriorMonth)}
                barColor={getCategoryColor(category.name)}
                selected={selectedCategory === category.name}
                onClick={() =>
                  setSelectedCategory((current) =>
                    current === category.name ? null : category.name,
                  )
                }
              />
            </li>
          ))}
        </ul>
      </div>

      {selectedCategory ? (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-text">
                {selectedCategory}
              </h3>
              <p className="text-sm text-text-muted">
                Recent transactions in this category
              </p>
            </div>
            <Link
              href={`/transactions?category=${encodeURIComponent(selectedCategory)}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View all in Activity →
            </Link>
          </div>

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
              No transactions in this category.
            </p>
          ) : null}

          {!isLoading && !error && data && data.items.length > 0 ? (
            <div>
              {data.items.map((transaction) => (
                <TransactionRow key={transaction.id} {...transaction} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
