"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ImportReview } from "@/components/import/import-review";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { api, ImportApiError } from "@/lib/api-client";
import { notifications } from "@/lib/notifications";
import type { ImportFormatsResponse } from "@/types/api";

const ACCEPT = ".qfx,.ofx,.csv,.pdf";

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) {
    return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  }
  if (n >= 1024) {
    return `${(n / 1024).toFixed(0)} KB`;
  }
  return `${n} B`;
}

export function ImportWizard() {
  const [formats, setFormats] = useState<ImportFormatsResponse | null>(null);
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [pageAlert, setPageAlert] = useState<{
    variant: "error" | "info";
    title: string;
    message: string;
  } | null>(null);
  const [loadingActiveBatch, setLoadingActiveBatch] = useState(true);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .getActiveImportBatch()
      .then((active) => {
        if (cancelled) return;
        if (active.activeBatchId) {
          setBatchId(active.activeBatchId);
          setPageAlert({
            variant: "info",
            title: "Import in progress",
            message:
              active.status === "awaiting_confirmation"
                ? "Your last upload finished parsing. Review results below, confirm import, or discard before starting a new upload."
                : "Parsing your previous upload. Status updates below.",
          });
        }
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setLoadingActiveBatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api
      .getImportFormats()
      .then((data) => {
        if (!cancelled) setFormats(data);
      })
      .catch(() => {
        if (!cancelled) {
          notifications.push(
            "error",
            "Could not load import settings",
            "Try again in a moment.",
            "import",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFormats(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (batchId && reviewRef.current) {
      reviewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [batchId]);

  const limits = formats?.limits;
  const totalBytes = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files],
  );

  const validationError = useMemo((): string | null => {
    if (!limits || files.length === 0) return null;
    if (files.length > limits.maxFiles) {
      return `Maximum ${limits.maxFiles} files per upload.`;
    }
    if (totalBytes > limits.maxBatchBytes) {
      return `Total size exceeds ${formatBytes(limits.maxBatchBytes)}.`;
    }
    for (const f of files) {
      if (f.size > limits.maxFileBytes) {
        return `"${f.name}" exceeds ${formatBytes(limits.maxFileBytes)} per file.`;
      }
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (![".qfx", ".ofx", ".csv", ".pdf"].includes(ext)) {
        return `"${f.name}" is not a supported type.`;
      }
    }
    return null;
  }, [files, limits, totalBytes]);

  const onFilesSelected = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      setFiles(Array.from(list));
      setPageAlert(null);
    },
    [],
  );

  async function handleUpload() {
    if (!consent) {
      notifications.push(
        "error",
        "Consent required",
        "Confirm authorization to process your files.",
        "import",
      );
      return;
    }
    if (validationError || files.length === 0) return;

    setUploading(true);
    setPageAlert(null);
    try {
      const result = await api.uploadImportBatch(files, consent);
      setBatchId(result.batchId);
      setPageAlert({
        variant: "info",
        title: "Upload received",
        message: result.message,
      });
      setFiles([]);
    } catch (err) {
      if (err instanceof ImportApiError) {
        setPageAlert({
          variant: "error",
          title: "Cannot start a new upload",
          message: err.message,
        });
        if (err.activeBatchId) {
          setBatchId(err.activeBatchId);
        }
      } else {
        setPageAlert({
          variant: "error",
          title: "Upload failed",
          message: err instanceof Error ? err.message : "Please try again.",
        });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {pageAlert ? (
        <Card
          padding="md"
          className={
            pageAlert.variant === "error"
              ? "border-red-300/80 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/30"
              : "border-primary/30 bg-primary-soft/20"
          }
        >
          <p className="text-sm font-semibold text-text">{pageAlert.title}</p>
          <p className="mt-1 text-sm text-text-muted" role="alert">
            {pageAlert.message}
          </p>
        </Card>
      ) : null}

      <PageHeader
        title="Import history"
        subtitle="Upload statements or broker exports — encrypted in transit and at rest"
        action={
          <Link
            href="/accounts"
            className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:text-text"
          >
            Back to accounts
          </Link>
        }
      />

      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-text">Supported formats</h2>
        {loadingFormats ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {formats?.formats.map((fmt) => (
              <div
                key={fmt.id}
                className="rounded-[var(--radius-sm)] border border-border/80 bg-surface-elevated/50 p-3"
              >
                <p className="font-medium text-text">{fmt.label}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {fmt.extensions.join(", ")}
                </p>
                <p className="mt-2 text-sm text-text-muted">{fmt.description}</p>
                <p className="mt-2 text-xs text-text-muted">
                  {fmt.brokers.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}
        {limits ? (
          <p className="text-xs text-text-muted">
            Up to {limits.maxFiles} files · {formatBytes(limits.maxFileBytes)}{" "}
            each · {formatBytes(limits.maxBatchBytes)} total per upload
          </p>
        ) : null}
      </Card>

      <Card padding="lg" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-text">Upload files</h2>
        <label
          htmlFor="import-files"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border-2 border-dashed border-border bg-surface-elevated/30 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
        >
          <span className="text-sm font-medium text-text">
            Drag files here or click to browse
          </span>
          <span className="text-xs text-text-muted">
            QFX, OFX, CSV, or PDF — up to 12 files. Bank of America monthly PDFs
            (checking, savings, credit card) are supported when CSV/QFX are not offered.
          </span>
          <input
            id="import-files"
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
        </label>

        {files.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-text-muted">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`}>
                {f.name} · {formatBytes(f.size)}
              </li>
            ))}
            <li className="font-medium text-text">
              Total: {formatBytes(totalBytes)}
            </li>
          </ul>
        ) : null}

        {validationError ? (
          <p className="text-sm text-red-500" role="alert">
            {validationError}
          </p>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span>
            I authorize SpendFlow to process these files containing my financial
            data. Files are encrypted (AES-256) and deleted after parsing.
          </span>
        </label>

        <button
          type="button"
          disabled={
            uploading ||
            loadingActiveBatch ||
            files.length === 0 ||
            !consent ||
            validationError !== null ||
            batchId !== null
          }
          onClick={() => void handleUpload()}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload securely"}
        </button>

        {batchId ? (
          <p className="text-xs text-text-muted">
            Finish or discard the import below before uploading another batch.
          </p>
        ) : null}
      </Card>

      {batchId ? (
        <div ref={reviewRef} className="scroll-mt-6">
          <ImportReview
            batchId={batchId}
            onComplete={() => {
              setBatchId(null);
              setPageAlert(null);
            }}
          />
        </div>
      ) : loadingActiveBatch ? (
        <Card padding="md">
          <p className="text-sm text-text-muted">Checking for an active import…</p>
        </Card>
      ) : null}

      <Card padding="md" variant="ghost">
        <p className="text-xs text-text-muted">
          Prefer live sync? Connect up to 10 accounts with Plaid from the{" "}
          <Link href="/accounts" className="text-primary underline-offset-2 hover:underline">
            accounts page
          </Link>{" "}
          (~24 months of history).
        </p>
      </Card>
    </div>
  );
}
