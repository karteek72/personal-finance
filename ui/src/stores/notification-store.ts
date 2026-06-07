"use client";

import { create } from "zustand";

export type NotificationKind = "info" | "success" | "error" | "progress";

export type NotificationSource =
  | "plaid-sync"
  | "plaid-link"
  | "account-connect"
  | "snaptrade-connect"
  | "import"
  | "household"
  | "insight"
  | "system";

export interface InsightAlertInput {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
}

const INSIGHT_ID_PREFIX = "insight:";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  source: NotificationSource;
  createdAt: string;
  read: boolean;
  dismissed: boolean;
  /** Group progress → completion updates for one async job */
  taskId?: string;
}

const MAX_NOTIFICATIONS = 50;

export interface AddNotificationInput {
  kind: NotificationKind;
  title: string;
  message: string;
  source?: NotificationSource;
  taskId?: string;
  read?: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  panelOpen: boolean;
  addNotification: (input: AddNotificationInput) => string;
  updateNotification: (
    id: string,
    patch: Partial<
      Pick<AppNotification, "kind" | "title" | "message" | "read" | "source">
    >,
  ) => void;
  updateTaskNotification: (
    taskId: string,
    patch: Partial<
      Pick<AppNotification, "kind" | "title" | "message" | "read" | "source">
    >,
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearDismissed: () => void;
  /** Replaces active insight alerts; preserves read/dismissed per alert id */
  syncInsightNotifications: (alerts: InsightAlertInput[]) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}

function insightNotificationId(alertId: string): string {
  return `${INSIGHT_ID_PREFIX}${alertId}`;
}

function insightSeverityToKind(
  severity: InsightAlertInput["severity"],
): NotificationKind {
  if (severity === "danger") return "error";
  return "info";
}

function createId(): string {
  return crypto.randomUUID();
}

function trimNotifications(list: AppNotification[]): AppNotification[] {
  const active = list.filter((n) => !n.dismissed);
  if (active.length <= MAX_NOTIFICATIONS) {
    return list;
  }
  const dismissed = list.filter((n) => n.dismissed);
  const keep = active.slice(0, MAX_NOTIFICATIONS);
  return [...keep, ...dismissed];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  panelOpen: false,

  addNotification: (input) => {
    const id = createId();
    const notification: AppNotification = {
      id,
      kind: input.kind,
      title: input.title,
      message: input.message,
      source: input.source ?? "system",
      createdAt: new Date().toISOString(),
      read: input.read ?? false,
      dismissed: false,
      taskId: input.taskId,
    };

    set((state) => ({
      notifications: trimNotifications([notification, ...state.notifications]),
    }));

    return id;
  },

  updateNotification: (id, patch) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...patch, read: patch.read ?? n.read } : n,
      ),
    }));
  },

  updateTaskNotification: (taskId, patch) => {
    const existing = get().notifications.find(
      (n) => n.taskId === taskId && !n.dismissed,
    );
    if (!existing) {
      get().addNotification({
        kind: patch.kind ?? "info",
        title: patch.title ?? "Update",
        message: patch.message ?? "",
        source: patch.source ?? "system",
        taskId,
        read: patch.read,
      });
      return;
    }
    get().updateNotification(existing.id, patch);
  },

  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  dismiss: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true, read: true } : n,
      ),
    }));
  },

  clearDismissed: () => {
    set((state) => ({
      notifications: state.notifications.filter((n) => !n.dismissed),
    }));
  },

  syncInsightNotifications: (alerts) => {
    set((state) => {
      const incomingIds = new Set(
        alerts.map((alert) => insightNotificationId(alert.id)),
      );
      const existingById = new Map(
        state.notifications.map((notification) => [
          notification.id,
          notification,
        ]),
      );

      const withoutStaleInsights = state.notifications.filter(
        (notification) =>
          notification.source !== "insight" ||
          (incomingIds.has(notification.id) && !notification.dismissed),
      );

      const syncedInsights: AppNotification[] = alerts.map((alert) => {
        const id = insightNotificationId(alert.id);
        const existing = existingById.get(id);
        return {
          id,
          kind: insightSeverityToKind(alert.severity),
          title: alert.title,
          message: alert.message,
          source: "insight",
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          read: existing?.read ?? false,
          dismissed: existing?.dismissed ?? false,
        };
      });

      const nonInsight = withoutStaleInsights.filter(
        (notification) => notification.source !== "insight",
      );
      const activeInsights = syncedInsights.filter(
        (notification) => !notification.dismissed,
      );

      return {
        notifications: trimNotifications([
          ...activeInsights,
          ...nonInsight,
        ]),
      };
    });
  },

  setPanelOpen: (open) => set({ panelOpen: open }),

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
}));

export function selectUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read && !n.dismissed).length;
}

export function selectVisibleNotifications(
  notifications: AppNotification[],
): AppNotification[] {
  return notifications.filter((n) => !n.dismissed);
}
