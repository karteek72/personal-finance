"use client";

import clsx from "clsx";

type KpiTone = "default" | "danger" | "success" | "warning" | "primary";

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  tone?: KpiTone;
  compact?: boolean;
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
}: KpiCardProps) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-card)] border border-border/60 bg-surface card-shadow",
        compact ? "p-3" : "p-4",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
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
