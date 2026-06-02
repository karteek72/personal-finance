"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-bold text-text">Something went wrong</h2>
      <p className="max-w-md text-sm text-text-muted">
        {error.message || "The dashboard failed to load."}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-[var(--radius-pill)] bg-primary px-4 py-2 text-sm font-semibold text-text-inverse"
        >
          Try again
        </button>
        <Link
          href="/login"
          className="rounded-[var(--radius-pill)] bg-bg px-4 py-2 text-sm font-semibold text-text"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
