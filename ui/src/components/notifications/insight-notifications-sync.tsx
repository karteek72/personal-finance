"use client";

import { useEffect } from "react";

import { useAlerts } from "@/hooks/use-alerts";
import { useNotificationStore } from "@/stores/notification-store";

/** Pushes API insight alerts into the notification bell (no inline banners). */
export function InsightNotificationsSync() {
  const { data } = useAlerts();
  const syncInsightNotifications = useNotificationStore(
    (s) => s.syncInsightNotifications,
  );

  useEffect(() => {
    if (!data) return;
    syncInsightNotifications(data.alerts);
  }, [data, syncInsightNotifications]);

  return null;
}
