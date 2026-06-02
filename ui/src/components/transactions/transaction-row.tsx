import clsx from "clsx";

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
}

function formatAmount(amount: string, currencyCode: string): string {
  const numeric = Number.parseFloat(amount);
  if (Number.isNaN(numeric)) {
    return amount;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(numeric);
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

function formatAccountMask(mask: string | null): string {
  if (!mask) {
    return "—";
  }
  return `•${mask}`;
}

const typeStyles = {
  expense: "text-danger",
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
}: TransactionRowProps) {
  const displayName = merchantName ?? name;
  const isHighlightedTransfer = isTransfer || transactionType === "transfer";

  return (
    <div
      className={clsx(
        "flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:grid sm:grid-cols-[4rem_1fr_8rem_5rem_6rem] sm:items-center sm:gap-4",
        isHighlightedTransfer && "bg-primary/5",
      )}
    >
      <div className="text-xs text-text-muted tabular-nums sm:w-14">
        {formatDate(date)}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{displayName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 sm:hidden">
          <span className="truncate text-xs text-text-muted">{category}</span>
          <span className="text-xs text-text-muted">
            {formatAccountMask(accountMask)}
          </span>
          {pending ? (
            <span className="rounded-[var(--radius-pill)] border border-warning/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
              Pending
            </span>
          ) : null}
          {isHighlightedTransfer ? (
            <span className="rounded-[var(--radius-pill)] border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Transfer
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 hidden flex-wrap items-center gap-2 sm:flex">
          {pending ? (
            <span className="rounded-[var(--radius-pill)] border border-warning/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
              Pending
            </span>
          ) : null}
          {isHighlightedTransfer ? (
            <span className="rounded-[var(--radius-pill)] border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Transfer
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden truncate text-sm text-text-muted sm:block">
        {category}
      </div>

      <div className="hidden text-sm tabular-nums text-text-muted sm:block">
        {formatAccountMask(accountMask)}
      </div>

      <div className="flex items-center justify-between sm:block sm:text-right">
        <span className="text-xs text-text-muted sm:hidden">
          {formatAccountMask(accountMask)} · {category}
        </span>
        <span
          className={clsx(
            "font-mono text-sm tabular-nums",
            typeStyles[transactionType],
          )}
        >
          {formatAmount(amount, currencyCode)}
        </span>
      </div>
    </div>
  );
}
