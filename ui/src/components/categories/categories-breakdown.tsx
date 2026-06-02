"use client";

import Link from "next/link";
import { useState } from "react";

import { CategoryRow } from "@/components/categories/category-row";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { Card } from "@/components/ui/card";
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
      <Card padding="none" className="overflow-hidden">
        <div
          className="flex h-2 w-full"
          role="img"
          aria-label="Proportional spend by category"
        >
          {categories.map((category) => (
            <div
              key={category.name}
              className="h-full transition-all"
              style={{
                width: `${category.percentage}%`,
                backgroundColor: getCategoryColor(category.name),
              }}
              title={`${category.name}: ${category.percentage.toFixed(1)}%`}
            />
          ))}
        </div>
        <ul className="space-y-1 p-2">
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
      </Card>

      {selectedCategory ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
            <div>
              <h3 className="text-base font-bold text-text">
                {selectedCategory}
              </h3>
              <p className="text-sm text-text-muted">
                Tap a category to explore · tap again to close
              </p>
            </div>
            <Link
              href={`/transactions?category=${encodeURIComponent(selectedCategory)}`}
              className="rounded-[var(--radius-pill)] bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              See all →
            </Link>
          </div>

          {isLoading ? (
            <p className="px-4 py-12 text-center text-sm text-text-muted">
              Loading…
            </p>
          ) : null}

          {error ? (
            <p className="px-4 py-12 text-center text-sm text-danger">
              Couldn't load transactions.
            </p>
          ) : null}

          {!isLoading && !error && data?.items.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-text-muted">
              No transactions in this category yet.
            </p>
          ) : null}

          {!isLoading && !error && data && data.items.length > 0 ? (
            <div className="divide-y divide-border/60">
              {data.items.map((transaction) => (
                <TransactionRow key={transaction.id} {...transaction} />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
