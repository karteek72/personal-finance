"use client";

import clsx from "clsx";

interface CategoryRowProps {
  name: string;
  percentage: number;
  amount: string;
  delta?: string;
  barColor?: string;
  selected?: boolean;
  onClick?: () => void;
}

function formatDelta(delta: string): { text: string; tone: "success" | "danger" | "default" } {
  const trimmed = delta.trim();
  if (trimmed.startsWith("+") || trimmed.startsWith("↑")) {
    return { text: trimmed, tone: "danger" };
  }
  if (trimmed.startsWith("-") || trimmed.startsWith("↓")) {
    return { text: trimmed, tone: "success" };
  }
  return { text: trimmed, tone: "default" };
}

export function CategoryRow({
  name,
  percentage,
  amount,
  delta,
  barColor = "var(--color-primary)",
  selected = false,
  onClick,
}: CategoryRowProps) {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const deltaInfo = delta ? formatDelta(delta) : null;
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "w-full rounded-[var(--radius-sm)] p-3 text-left transition-all",
        selected
          ? "bg-primary-soft ring-2 ring-primary/30"
          : "hover:bg-primary-soft/40",
        onClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: barColor }}
            aria-hidden="true"
          />
          <p className="truncate text-sm font-semibold text-text">{name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-text" data-money>
            {amount}
          </span>
          {deltaInfo ? (
            <span
              className={clsx(
                "text-xs font-semibold tabular-nums",
                deltaInfo.tone === "success" && "text-success",
                deltaInfo.tone === "danger" && "text-danger",
                deltaInfo.tone === "default" && "text-text-muted",
              )}
            >
              {deltaInfo.text}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-border/50">
        <div
          className="h-full rounded-[var(--radius-pill)] transition-all duration-500"
          style={{
            width: `${clampedPercentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </Wrapper>
  );
}
