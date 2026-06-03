"use client";

import clsx from "clsx";

import { SPEND_CATEGORIES } from "@/lib/categories";
import { getCategoryColor } from "@/lib/category-colors";

interface TransactionRowProps {
  id: string;
  accountId: string;
  accountMask: string | null;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  currencyCode: string;
  category: string;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
  memberName?: string | null;
  memberColor?: string | null;
  onCategoryChange?: (category: string) => void;
  categoryUpdating?: boolean;
}

function formatAmount(amount: string, currencyCode: string): string {
  const numeric = Number.parseFloat(amount);
  if (Number.isNaN(numeric)) {
    return amount;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(Math.abs(numeric));
}

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const typeStyles = {
  expense: "text-text",
  income: "text-success",
  transfer: "text-primary",
} as const;

export function TransactionRow({
  date,
  name,
  merchantName,
  amount,
  currencyCode,
  category,
  accountMask,
  transactionType,
  isTransfer,
  pending,
  memberName,
  memberColor,
  onCategoryChange,
  categoryUpdating = false,
}: TransactionRowProps) {
  const displayName = merchantName ?? name;
  const isHighlightedTransfer = isTransfer || transactionType === "transfer";
  const initial = displayName.charAt(0).toUpperCase();
  const categoryColor = getCategoryColor(category);
  const prefix =
    transactionType === "income" ? "+" : transactionType === "expense" ? "−" : "";
  const canEditCategory = Boolean(onCategoryChange) && !isHighlightedTransfer;

  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-primary-soft/30",
        isHighlightedTransfer && "bg-primary-soft/20",
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-text-inverse"
        style={{ backgroundColor: categoryColor }}
        aria-hidden="true"
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-text">
            {displayName}
          </p>
          {memberName ? (
            <span
              className="shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold text-text-inverse"
              style={{ backgroundColor: memberColor ?? "var(--color-primary)" }}
            >
              {memberName}
            </span>
          ) : null}
          {pending ? (
            <span className="shrink-0 rounded-[var(--radius-pill)] bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
              Pending
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          {canEditCategory ? (
            <select
              value={
                SPEND_CATEGORIES.includes(category as (typeof SPEND_CATEGORIES)[number])
                  ? category
                  : "Uncategorized"
              }
              disabled={categoryUpdating}
              onChange={(event) => onCategoryChange?.(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              title="Change category — saved for this merchant going forward"
              aria-label={`Category for ${displayName}`}
              className="max-w-[11rem] truncate rounded-[var(--radius-sm)] border-0 bg-bg py-0.5 pl-1 pr-6 text-xs font-medium text-text outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              {SPEND_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <span>{category}</span>
          )}
          {accountMask ? <span>· ••{accountMask}</span> : null}
          <span>· {formatDate(date)}</span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={clsx(
            "text-sm font-bold tabular-nums",
            typeStyles[transactionType],
          )}
          data-money
        >
          {prefix}
          {formatAmount(amount, currencyCode)}
        </p>
        {isHighlightedTransfer ? (
          <p className="text-[10px] font-semibold text-primary">Transfer</p>
        ) : null}
      </div>
    </div>
  );
}
