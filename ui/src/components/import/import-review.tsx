"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";
import type { ImportBatchStatusResponse } from "@/types/api";

interface ImportReviewProps {
  batchId: string;
  onComplete: () => void;
}

function statusLabel(status: string): string {
  switch (status) {
    case "preview_ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "parsed":
      return "Imported";
    case "parsing":
      return "Parsing…";
    case "stored":
      return "Queued";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "preview_ready":
      return "text-emerald-600";
    case "failed":
      return "text-red-500";
    case "parsed":
      return "text-emerald-700";
    default:
      return "text-text-muted";
  }
}

export function ImportReview({ batchId, onComplete }: ImportReviewProps) {
  const [status, setStatus] = useState<ImportBatchStatusResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetFileId, setReplaceTargetFileId] = useState<string | null>(
    null,
  );

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

  const readyFiles = useMemo(
    () => status?.files.filter((f) => f.status === "preview_ready") ?? [],
    [status],
  );

  useEffect(() => {
    if (readyFiles.length === 0) {
      setSelectedFileIds(new Set());
      return;
    }
    setSelectedFileIds((prev) => {
      const next = new Set<string>();
      for (const file of readyFiles) {
        if (prev.size === 0 || prev.has(file.id)) {
          next.add(file.id);
        }
      }
      if (next.size === 0) {
        for (const file of readyFiles) {
          next.add(file.id);
        }
      }
      return next;
    });
  }, [readyFiles]);

  async function handleConfirm() {
    const fileIds = [...selectedFileIds];
    if (fileIds.length === 0) {
      notifications.push(
        "error",
        "Nothing selected",
        "Select at least one file to import.",
        "import",
      );
      return;
    }

    setConfirming(true);
    try {
      const result = await api.confirmImportBatch(batchId, { fileIds });
      notifications.push("success", "Import complete", result.message, "import");
      if (result.status === "completed") {
        onComplete();
      } else {
        await poll();
      }
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

  async function handleRetryFile(fileId: string) {
    setActionLoading(fileId);
    try {
      await api.retryImportFile(batchId, fileId);
      notifications.push("success", "Retry started", "Re-parsing file…", "import");
      await poll();
    } catch (err) {
      notifications.push(
        "error",
        "Retry failed",
        err instanceof Error ? err.message : "Please try again.",
        "import",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetryAllFailed() {
    setActionLoading("retry-all");
    try {
      const result = await api.retryFailedImportFiles(batchId);
      notifications.push("success", "Retry started", result.message, "import");
      await poll();
    } catch (err) {
      notifications.push(
        "error",
        "Retry failed",
        err instanceof Error ? err.message : "Please try again.",
        "import",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading("cancel");
    try {
      await api.cancelImportBatch(batchId);
      notifications.push("success", "Import cancelled", "Upload discarded.", "import");
      onComplete();
    } catch (err) {
      notifications.push(
        "error",
        "Cancel failed",
        err instanceof Error ? err.message : "Please try again.",
        "import",
      );
    } finally {
      setActionLoading(null);
    }
  }

  function triggerReplace(fileId: string) {
    setReplaceTargetFileId(fileId);
    replaceInputRef.current?.click();
  }

  async function handleReplaceSelected(list: FileList | null) {
    const fileId = replaceTargetFileId;
    setReplaceTargetFileId(null);
    if (!fileId || !list?.[0]) return;

    setActionLoading(fileId);
    try {
      const result = await api.replaceImportFile(batchId, fileId, list[0]);
      notifications.push("success", "File replaced", result.message, "import");
      await poll();
    } catch (err) {
      notifications.push(
        "error",
        "Replace failed",
        err instanceof Error ? err.message : "Please try again.",
        "import",
      );
    } finally {
      setActionLoading(null);
      if (replaceInputRef.current) {
        replaceInputRef.current.value = "";
      }
    }
  }

  function toggleFileSelection(fileId: string) {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  const totals = useMemo(() => {
    if (!status) return { banking: 0, investment: 0 };
    let banking = 0;
    let investment = 0;
    for (const file of status.files) {
      if (!selectedFileIds.has(file.id)) continue;
      for (const acct of file.preview?.accounts ?? []) {
        banking += acct.bankingCount;
        investment += acct.investmentCount;
      }
    }
    return { banking, investment };
  }, [status, selectedFileIds]);

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

  const { batch, files, summary } = status;

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

  if (batch.status === "failed" && summary.ready === 0) {
    return (
      <Card padding="lg" className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-text">Import failed</h2>
          <p className="mt-1 text-sm text-red-500" role="alert">
            {batch.errorMessage ?? "All files failed to parse."}
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="rounded-[var(--radius-sm)] border border-red-200/80 bg-red-50/30 p-3 dark:border-red-900/50 dark:bg-red-950/20"
            >
              <p className="text-sm font-medium text-text">{file.filename}</p>
              {file.errorMessage ? (
                <p className="mt-1 text-xs text-red-500">{file.errorMessage}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {file.canRetry ? (
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() => void handleRetryFile(file.id)}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {actionLoading === file.id ? "Retrying…" : "Retry"}
                  </button>
                ) : null}
                {file.canReplace ? (
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() => triggerReplace(file.id)}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Replace file
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {summary.canRetryFailed ? (
            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={() => void handleRetryAllFailed()}
              className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-text transition-colors hover:bg-surface-elevated disabled:opacity-50"
            >
              {actionLoading === "retry-all" ? "Retrying…" : "Retry all failed"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={actionLoading !== null}
            onClick={() => void handleCancel()}
            className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {actionLoading === "cancel" ? "Cancelling…" : "Discard upload"}
          </button>
        </div>

        <input
          ref={replaceInputRef}
          type="file"
          accept=".qfx,.ofx,.csv,.pdf"
          className="sr-only"
          onChange={(e) => void handleReplaceSelected(e.target.files)}
        />
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
  const selectedCount = selectedFileIds.size;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <input
        ref={replaceInputRef}
        type="file"
        accept=".qfx,.ofx,.csv,.pdf"
        className="sr-only"
        onChange={(e) => void handleReplaceSelected(e.target.files)}
      />

      <div>
        <h2 className="text-base font-semibold text-text">Review import</h2>
        <p className="mt-1 text-sm text-text-muted">
          Confirm before transactions are saved to your accounts.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-[var(--radius-sm)] border border-border/80 bg-surface-elevated/40 px-3 py-2 text-xs">
        <span className="text-emerald-600">{summary.ready} ready</span>
        {summary.failed > 0 ? (
          <span className="text-red-500">{summary.failed} failed</span>
        ) : null}
        {summary.imported > 0 ? (
          <span className="text-text-muted">{summary.imported} imported</span>
        ) : null}
        <span className="text-text-muted">
          {summary.bankingTransactions + summary.investmentTransactions} transactions
          in ready files
        </span>
      </div>

      {batch.errorMessage ? (
        <p className="text-sm text-amber-600" role="status">
          {batch.errorMessage}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {files.map((file) => {
          const preview = file.preview;
          const isReady = file.status === "preview_ready";
          const isFailed = file.status === "failed";

          if (isFailed) {
            return (
              <li
                key={file.id}
                className="rounded-[var(--radius-sm)] border border-red-200/80 bg-red-50/30 p-3 dark:border-red-900/50 dark:bg-red-950/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-text">{file.filename}</p>
                  <span className={`text-xs font-medium ${statusColor(file.status)}`}>
                    {statusLabel(file.status)}
                  </span>
                </div>
                {file.errorMessage ? (
                  <p className="mt-1 text-xs text-red-500">{file.errorMessage}</p>
                ) : (
                  <p className="mt-1 text-xs text-text-muted">Could not parse this file.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {file.canRetry ? (
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void handleRetryFile(file.id)}
                      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {actionLoading === file.id ? "Retrying…" : "Retry"}
                    </button>
                  ) : null}
                  {file.canReplace ? (
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => triggerReplace(file.id)}
                      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      Replace file
                    </button>
                  ) : null}
                </div>
              </li>
            );
          }

          if (!preview) {
            return (
              <li
                key={file.id}
                className="rounded-[var(--radius-sm)] border border-border/80 p-3 text-sm text-text-muted"
              >
                <div className="flex items-center justify-between">
                  <span>{file.filename}</span>
                  <span className={`text-xs ${statusColor(file.status)}`}>
                    {statusLabel(file.status)}
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li
              key={file.id}
              className="rounded-[var(--radius-sm)] border border-border/80 bg-surface-elevated/50 p-3"
            >
              <div className="flex items-start gap-3">
                {isReady ? (
                  <input
                    type="checkbox"
                    checked={selectedFileIds.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="mt-1 h-4 w-4 rounded border-border"
                    aria-label={`Include ${file.filename} in import`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-text">{file.filename}</p>
                    <span className={`text-xs font-medium ${statusColor(file.status)}`}>
                      {statusLabel(file.status)}
                    </span>
                  </div>
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
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedCount > 0 ? (
        <p className="text-sm text-text">
          Selected: {totalBanking + totalInvestment} transactions (
          {totalBanking} banking, {totalInvestment} investment)
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={confirming || selectedCount === 0}
          onClick={() => void handleConfirm()}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirming
            ? "Importing…"
            : selectedCount < readyFiles.length
              ? `Import ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`
              : "Confirm import"}
        </button>

        {summary.canRetryFailed ? (
          <button
            type="button"
            disabled={actionLoading !== null}
            onClick={() => void handleRetryAllFailed()}
            className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-4 text-sm text-text transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            {actionLoading === "retry-all" ? "Retrying…" : "Retry failed"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={actionLoading !== null || confirming}
          onClick={() => void handleCancel()}
          className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-4 text-sm text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {actionLoading === "cancel" ? "Cancelling…" : "Discard upload"}
        </button>
      </div>
    </Card>
  );
}
