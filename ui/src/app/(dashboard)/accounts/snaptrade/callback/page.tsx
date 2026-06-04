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
  const [message, setMessage] = useState("Finishing brokerage connection…");

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        const result = await api.completeSnaptradeConnection();
        if (cancelled) return;

        notifications.push(
          "success",
          "Brokerage linked",
          result.message,
          "snaptrade-connect",
        );
        await refetchCoreFinancialQueries(queryClient);

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "spendflow:snaptrade-success" },
            window.location.origin,
          );
          window.close();
          return;
        }

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
