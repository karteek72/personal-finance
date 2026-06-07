"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { api } from "@/lib/api-client";
import { invalidateFinancialQueries } from "@/lib/invalidate-financial-queries";
import { notifications } from "@/lib/notifications";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export function RecalculateAnalyticsButton() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  if (USE_MOCKS) {
    return null;
  }

  async function handleRecalculate(): Promise<void> {
    if (running) return;
    setRunning(true);
    try {
      const result = await api.recomputeAnalytics();
      invalidateFinancialQueries(queryClient);
      notifications.push(
        "success",
        "Analytics recalculated",
        result.message ?? "All metrics have been refreshed.",
        "system",
      );
    } catch (err) {
      notifications.push(
        "error",
        "Recalculate failed",
        err instanceof Error ? err.message : "Could not refresh analytics.",
        "system",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleRecalculate()}
      disabled={running}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-xs font-semibold text-text-muted transition-colors hover:bg-primary-soft/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Recalculate all analytics"
      title="Recalculate all analytics from your latest transactions"
    >
      {running ? (
        <LoadingSpinner size="sm" label="Recalculating analytics" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M21 12a9 9 0 0 0-9-9 7.5 7.5 0 0 0-5.65 2.6M3 12a9 9 0 0 0 9 9 7.5 7.5 0 0 0 5.65-2.6M3 3v5h5M21 21v-5h-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="hidden sm:inline">{running ? "Recalculating…" : "Recalculate"}</span>
    </button>
  );
}
