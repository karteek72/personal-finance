"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SectionLoader } from "@/components/ui/section-loader";

interface AsyncPanelProps {
  isLoading: boolean;
  isFetching?: boolean;
  error?: Error | null;
  children: ReactNode;
  loadingMessage?: string;
  errorMessage?: string;
  className?: string;
  /** Show a slim bar + spinner when refetching with existing content */
  showRefetchIndicator?: boolean;
}

export function AsyncPanel({
  isLoading,
  isFetching = false,
  error,
  children,
  loadingMessage = "Loading…",
  errorMessage = "Something went wrong. Try again.",
  className,
  showRefetchIndicator = true,
}: AsyncPanelProps) {
  const showRefetch =
    showRefetchIndicator && isFetching && !isLoading && !error;

  if (isLoading) {
    return <SectionLoader message={loadingMessage} className={className} />;
  }

  if (error) {
    return (
      <p className={clsx("py-12 text-center text-sm text-danger", className)}>
        {error instanceof Error ? error.message : errorMessage}
      </p>
    );
  }

  return (
    <div className={clsx("relative", className)} aria-busy={showRefetch}>
      {showRefetch ? (
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-surface/90 py-2 backdrop-blur-sm"
          aria-live="polite"
        >
          <LoadingSpinner size="sm" label="Updating" />
          <span className="text-xs font-medium text-text-muted">Updating…</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
