import {
  useNotificationStore,
  type NotificationSource,
} from "@/stores/notification-store";

/** Imperative API for async tasks (usable outside React). */
export const notifications = {
  startTask(
    taskId: string,
    title: string,
    message: string,
    source: NotificationSource = "system",
  ): void {
    useNotificationStore.getState().addNotification({
      kind: "progress",
      title,
      message,
      source,
      taskId,
      read: false,
    });
  },

  completeTask(
    taskId: string,
    title: string,
    message: string,
    source: NotificationSource = "system",
  ): void {
    useNotificationStore.getState().updateTaskNotification(taskId, {
      kind: "success",
      title,
      message,
      source,
      read: false,
    });
  },

  failTask(
    taskId: string,
    title: string,
    message: string,
    source: NotificationSource = "system",
  ): void {
    useNotificationStore.getState().updateTaskNotification(taskId, {
      kind: "error",
      title,
      message,
      source,
      read: false,
    });
  },

  push(
    kind: "info" | "success" | "error" | "progress",
    title: string,
    message: string,
    source: NotificationSource = "system",
  ): string {
    return useNotificationStore.getState().addNotification({
      kind,
      title,
      message,
      source,
    });
  },
};

export function createTaskId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}
