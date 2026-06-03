import clsx from "clsx";
import type { ReactNode } from "react";

interface MetricGridProps {
  children: ReactNode;
  className?: string;
  /** Minimum column width before wrapping (CSS minmax) */
  minColumnWidth?: string;
}

/**
 * Fills available width with equal columns; no orphaned empty grid cells.
 */
export function MetricGrid({
  children,
  className,
  minColumnWidth = "10.5rem",
}: MetricGridProps) {
  return (
    <div
      className={clsx("grid gap-3", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}
