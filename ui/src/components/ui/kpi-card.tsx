"use client";

import clsx from "clsx";

type KpiTone = "default" | "danger" | "success" | "warning" | "primary";

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  tone?: KpiTone;
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
}: KpiCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p
        className={clsx(
          "mt-1 font-mono text-[22px] leading-7 tabular-nums",
          toneClasses[tone],
        )}
      >
        {value}
      </p>
      {subtext ? (
        <p className="mt-1 text-xs text-text-muted">{subtext}</p>
      ) : null}
    </div>
  );
}
