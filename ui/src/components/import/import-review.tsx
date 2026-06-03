"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";
import type { ImportBatchStatusResponse } from "@/types/api";

interface ImportReviewProps {
  batchId: string;
  onComplete: () => void;
}

export function ImportReview({ batchId, onComplete }: ImportReviewProps) {
  const [status, setStatus] = useState<ImportBatchStatusResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await api.getImportBatch(batchId);
      setStatus(data);
      setPollError(null);
      return data.batch.status;
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Could not load status");
      return null;
    }
  }, [batchId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    void poll().then((s) => {
      if (cancelled) return;
      if (s && !["awaiting_confirmation", "completed", "failed"].includes(s)) {
        timer = setInterval(() => {
          void poll().then((next) => {
            if (
              next &&
              ["awaiting_confirmation", "completed", "failed"].includes(next)
            ) {
              if (timer) clearInterval(timer);
            }
          });
        }, 2000);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [batchId, poll]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const result = await api.confirmImportBatch(batchId);
      notifications.push("success", "Import complete", result.message, "import");
      onComplete();
    } catch (err) {
      notifications.push(
        "error",
        "Confirm failed",
        err instanceof Error ? err.message : "Please try again.",
        "import",
      );
    } finally {
      setConfirming(false);
    }
  }

  const totals = useMemo(() => {
    if (!status) return { banking: 0, investment: 0 };
    let banking = 0;
    let investment = 0;
    for (const file of status.files) {
      for (const acct of file.preview?.accounts ?? []) {
        banking += acct.bankingCount;
        investment += acct.investmentCount;
      }
    }
    return { banking, investment };
  }, [status]);

  if (pollError) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-500" role="alert">
          {pollError}
        </p>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card padding="lg">
        <p className="text-sm text-text-muted">Parsing uploaded files…</p>
      </Card>
    );
  }

  const { batch, files } = status;

  if (batch.status === "processing" || batch.status === "pending") {
    return (
      <Card padding="lg" className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text">Parsing files…</p>
        <p className="text-xs text-text-muted">
          {batch.filesProcessed} / {batch.filesTotal} processed
        </p>
      </Card>
    );
  }

  if (batch.status === "failed") {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-500" role="alert">
          {batch.errorMessage ?? "Import failed."}
        </p>
      </Card>
    );
  }

  if (batch.status === "completed") {
    return (
      <Card padding="lg">
        <p className="text-sm text-emerald-600">
          Imported {batch.txnsInserted} transactions
          {batch.txnsSkipped > 0
            ? ` (${batch.txnsSkipped} duplicates skipped)`
            : ""}
          .
        </p>
      </Card>
    );
  }

  const totalBanking = totals.banking;
  const totalInvestment = totals.investment;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-text">Review import</h2>
        <p className="mt-1 text-sm text-text-muted">
          Confirm before transactions are saved to your accounts.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {files.map((file) => {
          const preview = file.preview;
          if (!preview) {
            return (
              <li
                key={file.id}
                className="rounded-[var(--radius-sm)] border border-border/80 p-3 text-sm text-text-muted"
              >
                {file.filename} — no preview
              </li>
            );
          }

          return (
            <li
              key={file.id}
              className="rounded-[var(--radius-sm)] border border-border/80 bg-surface-elevated/50 p-3"
            >
              <p className="font-medium text-text">{file.filename}</p>
              {preview.accounts.map((acct, i) => (
                <div key={`${file.id}-${i}`} className="mt-2 text-sm text-text-muted">
                  <p>
                    {acct.institutionName} ••{acct.mask} ({acct.type})
                    {acct.matchedAccountId ? (
                      <span className="ml-2 text-emerald-600">matched existing</span>
                    ) : (
                      <span className="ml-2 text-amber-600">new account</span>
                    )}
                  </p>
                  <p className="text-xs">
                    {acct.bankingCount > 0
                      ? `${acct.bankingCount} banking`
                      : null}
                    {acct.bankingCount > 0 && acct.investmentCount > 0
                      ? " · "
                      : null}
                    {acct.investmentCount > 0
                      ? `${acct.investmentCount} investment`
                      : null}
                  </p>
                </div>
              ))}
              {preview.dateRange.min ? (
                <p className="mt-2 text-xs text-text-muted">
                  {preview.dateRange.min} → {preview.dateRange.max}
                </p>
              ) : null}
              {preview.sampleTransactions.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs text-text-muted">
                  {preview.sampleTransactions.map((t, i) => (
                    <li key={`${file.id}-sample-${i}`}>
                      {t.date} · {t.name} · ${t.amount}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-text">
        Total: {totalBanking + totalInvestment} transactions (
        {totalBanking} banking, {totalInvestment} investment)
      </p>

      <button
        type="button"
        disabled={confirming}
        onClick={() => void handleConfirm()}
        className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {confirming ? "Importing…" : "Confirm import"}
      </button>
    </Card>
  );
}
