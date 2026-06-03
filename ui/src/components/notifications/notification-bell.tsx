"use client";

import clsx from "clsx";
import { useRef } from "react";

import { NotificationPanel } from "@/components/notifications/notification-panel";
import {
  selectUnreadCount,
  useNotificationStore,
} from "@/stores/notification-store";

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NotificationBell() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelOpen = useNotificationStore((s) => s.panelOpen);
  const togglePanel = useNotificationStore((s) => s.togglePanel);
  const setPanelOpen = useNotificationStore((s) => s.setPanelOpen);
  const notifications = useNotificationStore((s) => s.notifications);

  const unread = selectUnreadCount(notifications);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => togglePanel()}
        className={clsx(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-text-muted transition-colors hover:text-primary card-shadow",
          panelOpen && "text-primary ring-2 ring-primary/30",
        )}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications"
        }
        aria-expanded={panelOpen}
        aria-controls="notification-panel"
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        anchorRef={buttonRef}
      />
    </div>
  );
}
