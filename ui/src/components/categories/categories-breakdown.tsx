"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CategoryRow } from "@/components/categories/category-row";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Card } from "@/components/ui/card";
import { getCategoryColor } from "@/lib/category-colors";
import { formatMoney } from "@/lib/format-money";
import type { CategoryTotal } from "@/types/api";

interface CategoriesBreakdownProps {
  categories: CategoryTotal[];
  selectedCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
}

function formatDeltaPercent(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

export function CategoriesBreakdown({
  categories,
  selectedCategory: controlledCategory,
  onSelectCategory,
}: CategoriesBreakdownProps) {
  const [internalCategory, setInternalCategory] = useState<string | null>(null);
  const selectedCategory = controlledCategory ?? internalCategory;

  function setSelectedCategory(category: string | null) {
    if (onSelectCategory) {
      onSelectCategory(category);
    } else {
      setInternalCategory(category);
    }
  }

  const transactionFilters = useMemo(
    () =>
      selectedCategory
        ? { category: selectedCategory, sort: "date_desc" as const }
        : {},
    [selectedCategory],
  );

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
                  setSelectedCategory(
                    selectedCategory === category.name ? null : category.name,
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
                Scroll or use Load all to see every transaction · tap again to close
              </p>
            </div>
            <Link
              href={`/transactions?category=${encodeURIComponent(selectedCategory)}`}
              className="rounded-[var(--radius-pill)] bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              See all in Activity →
            </Link>
          </div>

          <TransactionList
            filters={transactionFilters}
            pageSize={50}
            emptyMessage="No transactions in this category yet."
            loadingMessage={`Loading ${selectedCategory}…`}
          />
        </Card>
      ) : null}
    </section>
  );
}
