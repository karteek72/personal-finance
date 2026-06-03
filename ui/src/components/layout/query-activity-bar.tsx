"use client";

import { useIsFetching } from "@tanstack/react-query";

/** Thin bar at top of main content when any React Query request is in flight. */
export function QueryActivityBar() {
  const fetchingCount = useIsFetching();

  if (fetchingCount === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-primary/20"
      aria-hidden="true"
    >
      <div className="h-full w-1/3 animate-[query-bar_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
