"use client";

import clsx from "clsx";
import { useEffect, useRef, type RefObject } from "react";

import {
  selectVisibleNotifications,
  useNotificationStore,
  type AppNotification,
  type NotificationKind,
} from "@/stores/notification-store";
import { useWrappedStore } from "@/stores/wrapped-store";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function kindStyles(kind: NotificationKind): {
  dot: string;
  icon: string;
} {
  switch (kind) {
    case "success":
      return { dot: "bg-success", icon: "text-success" };
    case "error":
      return { dot: "bg-danger", icon: "text-danger" };
    case "progress":
      return { dot: "bg-primary animate-pulse", icon: "text-primary" };
    default:
      return { dot: "bg-text-muted", icon: "text-text-muted" };
  }
}

function NotificationItem({
  notification,
  onDismiss,
  onMarkRead,
  onActivate,
}: {
  notification: AppNotification;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onActivate: (notification: AppNotification) => void;
}) {
  const styles = kindStyles(notification.kind);
  const isActionable = Boolean(notification.action);

  return (
    <li
      className={clsx(
        "relative flex gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 transition-colors",
        !notification.read && "bg-primary-soft/40",
      )}
    >
      <span
        className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", styles.dot)}
        aria-hidden
      />
      {isActionable ? (
        <button
          type="button"
          onClick={() => onActivate(notification)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text">{notification.title}</p>
            <time
              className="shrink-0 text-[10px] text-text-muted"
              dateTime={notification.createdAt}
            >
              {formatRelativeTime(notification.createdAt)}
            </time>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
            {notification.message}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-primary">
            Tap to open →
          </p>
        </button>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text">{notification.title}</p>
            <time
              className="shrink-0 text-[10px] text-text-muted"
              dateTime={notification.createdAt}
            >
              {formatRelativeTime(notification.createdAt)}
            </time>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
            {notification.message}
          </p>
        </div>
      )}
      <div className="flex shrink-0 flex-col gap-1">
        {!notification.read ? (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            Read
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className="text-[10px] font-medium text-text-muted hover:text-text"
          aria-label={`Dismiss ${notification.title}`}
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

export function NotificationPanel({
  open,
  onClose,
  anchorRef,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const openWrapped = useWrappedStore((s) => s.openWrapped);

  const visible = selectVisibleNotifications(notifications);

  function handleActivate(notification: AppNotification) {
    markRead(notification.id);
    if (notification.action?.type === "open-wrapped") {
      openWrapped();
      onClose();
    }
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      id="notification-panel"
      role="region"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-surface card-shadow"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-bold text-text">Notifications</h2>
        {visible.some((n) => !n.read) ? (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">
          No notifications yet. Background tasks will appear here.
        </p>
      ) : (
        <ul className="max-h-[min(60vh,20rem)] divide-y divide-border/40 overflow-y-auto p-2">
          {visible.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onDismiss={dismiss}
              onMarkRead={markRead}
              onActivate={handleActivate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
