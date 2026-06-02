"use client";

import clsx from "clsx";
import { useState } from "react";

type AlertSeverity = "info" | "warning" | "danger";

interface AlertBannerProps {
  title: string;
  message: string;
  severity?: AlertSeverity;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const severityStyles: Record<
  AlertSeverity,
  { container: string; title: string }
> = {
  info: {
    container: "border-primary/30 bg-primary/10",
    title: "text-primary",
  },
  warning: {
    container: "border-warning/30 bg-warning/10",
    title: "text-warning",
  },
  danger: {
    container: "border-danger/30 bg-danger/10",
    title: "text-danger",
  },
};

export function AlertBanner({
  title,
  message,
  severity = "info",
  dismissible = true,
  onDismiss,
}: AlertBannerProps) {
  const [visible, setVisible] = useState(true);
  const styles = severityStyles[severity];

  if (!visible) {
    return null;
  }

  function handleDismiss() {
    setVisible(false);
    onDismiss?.();
  }

  return (
    <div
      role="alert"
      className={clsx(
        "flex items-start justify-between gap-3 rounded-[var(--radius-card)] border p-4",
        styles.container,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={clsx("text-sm font-semibold", styles.title)}>{title}</p>
        <p className="mt-1 text-sm text-text">{message}</p>
      </div>
      {dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-[var(--radius-card)] px-2 py-1 text-sm text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Dismiss alert"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
