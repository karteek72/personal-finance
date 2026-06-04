"use client";

import Link from "next/link";

interface FeatureEmptyStateProps {
  /** Short label for the feature tab, e.g. "wellness score". */
  feature?: string;
  /** When accounts exist but derived metrics are not ready yet. */
  variant?: "no-accounts" | "insufficient-data";
}

export function FeatureEmptyState({
  feature,
  variant = "no-accounts",
}: FeatureEmptyStateProps) {
  const isInsufficient = variant === "insufficient-data";

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-sm font-semibold text-text">
        {isInsufficient ? "Not enough data yet" : "No accounts connected"}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {isInsufficient
          ? feature
            ? `Sync more transactions to calculate ${feature}.`
            : "Sync more transactions to populate this view."
          : feature
            ? `Connect a bank, card, or brokerage to see ${feature}.`
            : "Connect a bank, card, or brokerage to unlock this view."}
      </p>
      {!isInsufficient && (
        <Link
          href="/accounts"
          className="mt-4 inline-block rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--gradient-hero)" }}
        >
          Connect an account
        </Link>
      )}
    </div>
  );
}

export function FeaturePanelLoading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-border/30"
        />
      ))}
    </div>
  );
}
