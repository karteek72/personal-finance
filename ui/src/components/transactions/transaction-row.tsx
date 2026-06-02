import clsx from "clsx";

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
}: TransactionRowProps) {
  const displayName = merchantName ?? name;
  const isHighlightedTransfer = isTransfer || transactionType === "transfer";
  const initial = displayName.charAt(0).toUpperCase();
  const categoryColor = getCategoryColor(category);
  const prefix =
    transactionType === "income" ? "+" : transactionType === "expense" ? "−" : "";

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
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {category}
          {accountMask ? ` · ••${accountMask}` : ""}
          {" · "}
          {formatDate(date)}
        </p>
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
