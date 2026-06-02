"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

interface ChartShellProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function ChartShell({
  title,
  subtitle,
  action,
  children,
  className,
  footer,
}: ChartShellProps) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-card)] border border-border/60 bg-surface p-4 card-shadow",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
      {footer ? <div className="mt-3 border-t border-border/60 pt-3">{footer}</div> : null}
    </div>
  );
}
