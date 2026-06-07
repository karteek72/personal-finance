import clsx from "clsx";

interface MetricLiveBadgeProps {
  isLive: boolean;
  /** Reserved for metric-envelope confidence (0–1) when backend exposes it. */
  confidence?: number;
  className?: string;
}

export function MetricLiveBadge({
  isLive,
  confidence,
  className,
}: MetricLiveBadgeProps) {
  const label = isLive ? "Live" : "Preview";
  const title = isLive
    ? confidence !== undefined
      ? `Computed from your data (${Math.round(confidence * 100)}% confidence)`
      : "Computed from your linked accounts and transactions"
    : "Illustrative or placeholder data — not yet computed from your accounts";

  return (
    <span
      title={title}
      aria-label={title}
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        isLive
          ? "bg-success/15 text-success"
          : "bg-border/60 text-text-muted",
        className,
      )}
    >
      {label}
    </span>
  );
}
