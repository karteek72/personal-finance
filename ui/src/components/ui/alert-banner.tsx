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
  { container: string; title: string; emoji: string }
> = {
  info: {
    container: "border-primary/20 bg-primary-soft",
    title: "text-primary",
    emoji: "💡",
  },
  warning: {
    container: "border-warning/20 bg-warning/10",
    title: "text-warning",
    emoji: "⚡",
  },
  danger: {
    container: "border-danger/20 bg-danger/10",
    title: "text-danger",
    emoji: "🚨",
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

  if (!visible || (!title.trim() && !message.trim())) {
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
        "flex items-start gap-3 rounded-[var(--radius-card)] border p-4 card-shadow",
        styles.container,
      )}
    >
      <span className="text-lg" aria-hidden="true">
        {styles.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx("text-sm font-semibold", styles.title)}>{title}</p>
        <p className="mt-0.5 text-sm text-text-muted">{message}</p>
      </div>
      {dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-[var(--radius-sm)] p-1 text-text-muted transition-colors hover:text-text"
          aria-label="Dismiss"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
