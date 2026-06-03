"use client";

import clsx from "clsx";

type KpiTone = "default" | "danger" | "success" | "warning" | "primary";

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  tone?: KpiTone;
  compact?: boolean;
  onClick?: () => void;
}

const toneClasses: Record<KpiTone, string> = {
  default: "text-text",
  danger: "text-danger",
  success: "text-success",
  warning: "text-warning",
  primary: "text-primary",
};

export function KpiCard({
  label,
  value,
  subtext,
  tone = "default",
  compact = false,
  onClick,
}: KpiCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      className={clsx(
        "rounded-[var(--radius-card)] border border-border/60 bg-surface card-shadow",
        compact ? "p-3" : "p-4",
        isClickable &&
          "cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </p>
        {isClickable ? (
          <svg
            aria-hidden
            className="mt-0.5 h-3 w-3 shrink-0 text-text-muted/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : null}
      </div>
      <p
        className={clsx(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight",
          toneClasses[tone],
        )}
        data-money
      >
        {value}
      </p>
      {subtext ? (
        <p className="mt-0.5 truncate text-xs text-text-muted">{subtext}</p>
      ) : null}
    </div>
  );
}
