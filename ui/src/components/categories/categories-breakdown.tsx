"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CategoryRow } from "@/components/categories/category-row";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Card } from "@/components/ui/card";
import { getCategoryColor, getSubCategoryColor } from "@/lib/category-colors";
import { formatMoney } from "@/lib/format-money";
import { formatPercent } from "@/lib/money-format";
import type { CategoryTotal } from "@/types/api";

interface CategoriesBreakdownProps {
  categories: CategoryTotal[];
  selectedCategory?: string | null;
  selectedSubCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
  onSelectSubCategory?: (subCategory: string | null) => void;
}

function formatDeltaPercent(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

export function CategoriesBreakdown({
  categories,
  selectedCategory: controlledCategory,
  selectedSubCategory: controlledSubCategory,
  onSelectCategory,
  onSelectSubCategory,
}: CategoriesBreakdownProps) {
  const [internalCategory, setInternalCategory] = useState<string | null>(null);
  const [internalSubCategory, setInternalSubCategory] = useState<string | null>(
    null,
  );

  const selectedCategory = controlledCategory ?? internalCategory;
  const selectedSubCategory = controlledSubCategory ?? internalSubCategory;

  function setSelectedCategory(category: string | null) {
    if (onSelectSubCategory) {
      onSelectSubCategory(null);
    } else {
      setInternalSubCategory(null);
    }
    if (onSelectCategory) {
      onSelectCategory(category);
    } else {
      setInternalCategory(category);
    }
  }

  function handleSubCategoryClick(sub: string) {
    const next = selectedSubCategory === sub ? null : sub;
    if (onSelectSubCategory) {
      onSelectSubCategory(next);
    } else {
      setInternalSubCategory(next);
    }
  }

  const activeCategoryData = useMemo(
    () => categories.find((c) => c.name === selectedCategory) ?? null,
    [categories, selectedCategory],
  );

  const subcategories = activeCategoryData?.subcategories ?? [];

  const transactionFilters = useMemo(
    () =>
      selectedCategory
        ? {
            category: selectedCategory,
            ...(selectedSubCategory ? { subCategory: selectedSubCategory } : {}),
            sort: "date_desc" as const,
          }
        : {},
    [selectedCategory, selectedSubCategory],
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
              title={`${category.name}: ${formatPercent(category.percentage)}`}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-text">{selectedCategory}</h3>
              <p className="text-xs text-text-muted">
                {formatMoney(activeCategoryData?.amount ?? "0")} total
                {subcategories.length > 0
                  ? ` · ${subcategories.length} subcategor${subcategories.length === 1 ? "y" : "ies"}`
                  : " · subcategories loading…"}
              </p>
            </div>
            {selectedSubCategory ? (
              <button
                type="button"
                onClick={() =>
                  onSelectSubCategory
                    ? onSelectSubCategory(null)
                    : setInternalSubCategory(null)
                }
                className="rounded-[var(--radius-pill)] border border-border/60 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-border/40"
              >
                Clear subcategory filter
              </button>
            ) : null}
          </div>

          {subcategories.length > 0 ? (
            <>
              <div
                className="flex h-1.5 w-full"
                role="img"
                aria-label={`Subcategory breakdown for ${selectedCategory}`}
              >
                {subcategories.map((sub, i) => (
                  <div
                    key={sub.name}
                    className="h-full transition-all"
                    style={{
                      width: `${sub.percentage}%`,
                      backgroundColor: getSubCategoryColor(selectedCategory, i),
                    }}
                    title={`${sub.name}: ${formatPercent(sub.percentage)}`}
                  />
                ))}
              </div>

              <ul className="space-y-0.5 p-2">
                {subcategories.map((sub, i) => (
                  <li key={sub.name}>
                    <CategoryRow
                      name={sub.name}
                      percentage={sub.percentage}
                      amount={formatMoney(sub.amount)}
                      barColor={getSubCategoryColor(selectedCategory, i)}
                      selected={selectedSubCategory === sub.name}
                      onClick={() => handleSubCategoryClick(sub.name)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              No subcategory breakdown yet for this category.
            </p>
          )}
        </Card>
      ) : null}

      {selectedCategory ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
            <div>
              <h3 className="text-base font-bold text-text">
                {selectedSubCategory
                  ? `${selectedCategory} · ${selectedSubCategory}`
                  : selectedCategory}
              </h3>
              <p className="text-sm text-text-muted">
                {selectedSubCategory
                  ? `Showing only ${selectedSubCategory} transactions`
                  : "All transactions in this category · tap a subcategory above to filter"}
              </p>
            </div>
            <Link
              href={`/transactions?category=${encodeURIComponent(selectedCategory)}${selectedSubCategory ? `&subCategory=${encodeURIComponent(selectedSubCategory)}` : ""}`}
              className="rounded-[var(--radius-pill)] bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              See all in Activity →
            </Link>
          </div>

          <TransactionList
            key={`${selectedCategory}::${selectedSubCategory ?? ""}`}
            filters={transactionFilters}
            pageSize={50}
            emptyMessage={
              selectedSubCategory
                ? `No transactions in ${selectedSubCategory} yet.`
                : `No transactions in ${selectedCategory} yet.`
            }
            loadingMessage={`Loading ${selectedSubCategory ?? selectedCategory}…`}
          />
        </Card>
      ) : null}
    </section>
  );
}
