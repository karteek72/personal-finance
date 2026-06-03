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

/** Slightly muted shade of the parent category color for subcategory bars. */
function subCategoryColor(parentColor: string, index: number): string {
  const opacities = [1, 0.72, 0.52, 0.38, 0.28, 0.22];
  const opacity = opacities[Math.min(index, opacities.length - 1)] ?? 0.2;
  if (parentColor.startsWith("#")) {
    const r = parseInt(parentColor.slice(1, 3), 16);
    const g = parseInt(parentColor.slice(3, 5), 16);
    const b = parseInt(parentColor.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return parentColor;
}

export function CategoriesBreakdown({
  categories,
  selectedCategory: controlledCategory,
  onSelectCategory,
}: CategoriesBreakdownProps) {
  const [internalCategory, setInternalCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  const selectedCategory = controlledCategory ?? internalCategory;

  function setSelectedCategory(category: string | null) {
    setSelectedSubCategory(null); // reset sub when parent changes
    if (onSelectCategory) {
      onSelectCategory(category);
    } else {
      setInternalCategory(category);
    }
  }

  function handleSubCategoryClick(sub: string) {
    setSelectedSubCategory((prev) => (prev === sub ? null : sub));
  }

  const activeCategoryData = useMemo(
    () => categories.find((c) => c.name === selectedCategory) ?? null,
    [categories, selectedCategory],
  );

  const parentColor = selectedCategory
    ? getCategoryColor(selectedCategory)
    : "var(--color-primary)";

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
      {/* ── Category list card ── */}
      <Card padding="none" className="overflow-hidden">
        {/* Proportional rainbow bar */}
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

      {/* ── Subcategory drill-down (only when a category with subs is selected) ── */}
      {selectedCategory && subcategories.length > 0 ? (
        <Card padding="none" className="overflow-hidden">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-text">{selectedCategory}</h3>
              <p className="text-xs text-text-muted">
                {formatMoney(activeCategoryData?.amount ?? "0")} total ·{" "}
                {subcategories.length} subcategor{subcategories.length === 1 ? "y" : "ies"}
              </p>
            </div>
            {selectedSubCategory && (
              <button
                type="button"
                onClick={() => setSelectedSubCategory(null)}
                className="rounded-[var(--radius-pill)] border border-border/60 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-border/40"
              >
                Clear subcategory filter
              </button>
            )}
          </div>

          {/* Subcategory proportional bar */}
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
                  backgroundColor: subCategoryColor(parentColor, i),
                }}
                title={`${sub.name}: ${sub.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Subcategory rows */}
          <ul className="space-y-0.5 p-2">
            {subcategories.map((sub, i) => (
              <li key={sub.name}>
                <CategoryRow
                  name={sub.name}
                  percentage={sub.percentage}
                  amount={formatMoney(sub.amount)}
                  barColor={subCategoryColor(parentColor, i)}
                  selected={selectedSubCategory === sub.name}
                  onClick={() => handleSubCategoryClick(sub.name)}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── Transaction list (filtered by category + optional subcat) ── */}
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
