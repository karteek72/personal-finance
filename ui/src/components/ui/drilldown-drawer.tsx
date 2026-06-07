"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { TransactionList } from "@/components/transactions/transaction-list";
import type { InfiniteTransactionFilters } from "@/hooks/use-infinite-transactions";

export interface DrilldownConfig {
  title: string;
  subtitle?: string;
  filters: InfiniteTransactionFilters;
  viewAllHref?: string;
}

interface DrilldownDrawerProps {
  config: DrilldownConfig | null;
  onClose: () => void;
}

export function DrilldownDrawer({ config, onClose }: DrilldownDrawerProps) {
  const open = config !== null;
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Trap focus inside drawer when open
  useEffect(() => {
    if (open) {
      drawerRef.current?.focus();
    }
  }, [open]);

  if (!open || !config) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
        tabIndex={-1}
        className={clsx(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-surface outline-none",
          "border-l border-border/60",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">
              {config.title}
            </h2>
            {config.subtitle ? (
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {config.subtitle}
              </p>
            ) : null}
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            {config.viewAllHref ? (
              <a
                href={config.viewAllHref}
                className="rounded-[var(--radius-pill)] bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                View all
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border/40 hover:text-text"
            >
              <svg
                aria-hidden
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TransactionList
            key={JSON.stringify(config.filters)}
            filters={config.filters}
            pageSize={25}
            infiniteScroll
            showLoadAll
            emptyMessage="No transactions match this filter."
          />
        </div>
      </div>
    </>
  );
}
