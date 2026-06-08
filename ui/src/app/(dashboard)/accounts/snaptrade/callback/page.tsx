"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";
import { refetchCoreFinancialQueries } from "@/lib/invalidate-financial-queries";

export default function SnaptradeCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(
    "Starting brokerage sync… large accounts can take a few minutes in the background.",
  );

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const params = new URLSearchParams(window.location.search);
      const status = params.get("status");
      if (status === "ERROR") {
        const detail = [
          params.get("error_code")
            ? `SnapTrade error ${params.get("error_code")}`
            : null,
          params.get("status_code")
            ? `HTTP ${params.get("status_code")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const text =
          detail ||
          "SnapTrade could not connect this brokerage. Try again in a few minutes.";
        setMessage(text);
        notifications.push("error", "Brokerage link failed", text, "snaptrade-connect");
        return;
      }
      if (status === "ABANDONED") {
        setMessage("Connection cancelled.");
        return;
      }

      try {
        const result = await api.completeSnaptradeConnection();
        if (cancelled) return;

        const notifyMessage =
          result.status === "started"
            ? "Your brokerage is linked. Accounts and holdings will appear shortly."
            : result.message;

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "spendflow:snaptrade-success" },
            window.location.origin,
          );
          window.close();
          return;
        }

        notifications.push(
          "success",
          "Brokerage linked",
          notifyMessage,
          "snaptrade-connect",
        );
        void refetchCoreFinancialQueries(queryClient);
        router.replace("/accounts");
      } catch (error) {
        if (cancelled) return;
        const text =
          error instanceof Error
            ? error.message
            : "Failed to sync brokerage accounts";
        setMessage(text);
        notifications.push("error", "Brokerage link failed", text, "snaptrade-connect");
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [router, queryClient]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-lg font-semibold text-text">SnapTrade</p>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
