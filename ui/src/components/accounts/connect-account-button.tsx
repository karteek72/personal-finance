"use client";

import { useCallback, useEffect, useState } from "react";

import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { api } from "@/lib/api-client";
import { createTellerConnectHandle } from "@/lib/teller-connect";
import type { ConnectionProviderId, ConnectionProviderOption } from "@/types/api";

type ButtonVariant = "default" | "icon" | "dashed";

interface ConnectAccountButtonProps {
  label?: string;
  className?: string;
  variant?: ButtonVariant;
  itemId?: string;
  tellerEnrollmentId?: string;
  preferredProviders?: ConnectionProviderId[];
  onSuccess: () => void;
  onError?: (message: string) => void;
}

const PROVIDER_HINTS: Record<ConnectionProviderId, string> = {
  plaid: "Wide bank & card coverage",
  teller: "Direct bank & card connections",
  snaptrade: "Brokerage & retirement accounts",
};

export function ConnectAccountButton({
  label = "Add account",
  className,
  variant = "default",
  itemId,
  tellerEnrollmentId,
  preferredProviders,
  onSuccess,
  onError,
}: ConnectAccountButtonProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ConnectionProviderOption[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [connecting, setConnecting] = useState<ConnectionProviderId | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);

  const reportError = useCallback(
    (message: string) => {
      setModalError(message);
      onError?.(message);
    },
    [onError],
  );

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const response = await api.getConnectionProviders();
      let list = response.providers.filter((p) => p.enabled);
      if (preferredProviders?.length) {
        const order = new Map(
          preferredProviders.map((id, index) => [id, index]),
        );
        list = [...list].sort(
          (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
        );
      }
      setProviders(list);
    } catch (error) {
      reportError(
        error instanceof Error
          ? error.message
          : "Could not load connection options",
      );
    } finally {
      setLoadingProviders(false);
    }
  }, [preferredProviders, reportError]);

  useEffect(() => {
    if (open && providers.length === 0 && !loadingProviders) {
      void loadProviders();
    }
  }, [open, providers.length, loadingProviders, loadProviders]);

  async function handleTellerConnect() {
    setConnecting("teller");
    try {
      const config = await api.getTellerConfig();
      const handle = await createTellerConnectHandle({
        applicationId: config.applicationId,
        environment: config.environment,
        products: config.products,
        enrollmentId: tellerEnrollmentId,
        onSuccess: async (enrollment) => {
          setOpen(false);
          try {
            await api.exchangeTellerToken({
              accessToken: enrollment.accessToken,
              enrollmentId: enrollment.enrollment.id,
              institutionName: enrollment.enrollment.institution?.name,
            });
            onSuccess();
          } catch (error) {
            reportError(
              error instanceof Error
                ? error.message
                : "Failed to connect Teller account",
            );
          } finally {
            setConnecting(null);
          }
        },
        onExit: () => setConnecting(null),
      });
      handle.open();
    } catch (error) {
      setConnecting(null);
      reportError(
        error instanceof Error
          ? error.message
          : "Could not start Teller Connect",
      );
    }
  }

  async function handleSnaptradeConnect() {
    setConnecting("snaptrade");
    setModalError(null);
    try {
      const { redirectUri } = await api.createSnaptradePortalUrl();
      const popup = window.open(
        redirectUri,
        "snaptrade-connect",
        "width=520,height=720,noopener,noreferrer",
      );
      if (!popup) {
        setConnecting(null);
        reportError(
          "Pop-up blocked. Allow pop-ups for this site, then try again.",
        );
        return;
      }

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          setConnecting(null);
          setOpen(false);
          void api
            .completeSnaptradeConnection()
            .then(() => onSuccess())
            .catch((error: unknown) => {
              reportError(
                error instanceof Error
                  ? error.message
                  : "Failed to sync brokerage accounts",
              );
            });
        }
      }, 500);
    } catch (error) {
      setConnecting(null);
      reportError(
        error instanceof Error
          ? error.message
          : "Could not open SnapTrade portal",
      );
    }
  }

  function handleOpen() {
    setModalError(null);
    setOpen(true);
  }

  if (itemId) {
    return (
      <PlaidLinkButton
        label={label}
        className={className}
        variant={variant}
        itemId={itemId}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  if (tellerEnrollmentId && providers.length === 0) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => void handleTellerConnect()}
      >
        {label}
      </button>
    );
  }

  if (variant !== "default" && !open) {
    return (
      <>
        <button
          type="button"
          aria-label={label}
          className={className}
          onClick={handleOpen}
        >
          {variant === "icon" ? (
            <span className="text-lg leading-none" aria-hidden="true">
              +
            </span>
          ) : (
            <span className="text-sm font-semibold">{label}</span>
          )}
        </button>
        {open ? (
          <ProviderPickerModal
            label={label}
            providers={providers}
            loading={loadingProviders}
            connecting={connecting}
            error={modalError}
            onClose={() => setOpen(false)}
            onPick={(id) => {
              if (id === "teller") void handleTellerConnect();
              else if (id === "snaptrade") void handleSnaptradeConnect();
            }}
            onPlaidSuccess={() => {
              setOpen(false);
              onSuccess();
            }}
            onPlaidError={reportError}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleOpen}
      >
        {label}
      </button>
      {open ? (
        <ProviderPickerModal
          label={label}
          providers={providers}
          loading={loadingProviders}
          connecting={connecting}
          error={modalError}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            if (id === "teller") void handleTellerConnect();
            else if (id === "snaptrade") void handleSnaptradeConnect();
          }}
          onPlaidSuccess={() => {
            setOpen(false);
            onSuccess();
          }}
          onPlaidError={reportError}
        />
      ) : null}
    </>
  );
}

interface ProviderPickerModalProps {
  label: string;
  providers: ConnectionProviderOption[];
  loading: boolean;
  connecting: ConnectionProviderId | null;
  error: string | null;
  onClose: () => void;
  onPick: (id: ConnectionProviderId) => void;
  onPlaidSuccess: () => void;
  onPlaidError?: (message: string) => void;
}

function ProviderPickerModal({
  label,
  providers,
  loading,
  connecting,
  error,
  onClose,
  onPick,
  onPlaidSuccess,
  onPlaidError,
}: ProviderPickerModalProps) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-account-title"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface card-shadow"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="connect-account-title" className="text-lg font-bold text-text">
                  {label}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Choose how to link your financial accounts.
                </p>
              </div>
              <button
                type="button"
                className="text-text-muted hover:text-text"
                aria-label="Close"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>

          {error ? (
            <div className="mx-5 mb-3 shrink-0 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-5">
            {loading ? (
              <p className="text-sm text-text-muted">Loading options…</p>
            ) : null}

            {!loading && providers.length === 0 ? (
              <p className="text-sm text-text-muted">
                No connection providers are configured on this server.
              </p>
            ) : null}

            {providers.map((provider) => (
              <div
                key={provider.id}
                className="rounded-[var(--radius-sm)] border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text">{provider.label}</p>
                    <p className="text-xs text-text-muted">
                      {PROVIDER_HINTS[provider.id]}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {provider.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  {provider.id === "plaid" ? (
                    <PlaidLinkButton
                      label="Connect with Plaid"
                      variant="default"
                      className="w-full"
                      onSuccess={onPlaidSuccess}
                      onError={onPlaidError}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={connecting !== null}
                      className="w-full rounded-[var(--radius-sm)] bg-primary px-3 py-2 text-sm font-semibold text-text-inverse disabled:opacity-60"
                      onClick={() => onPick(provider.id)}
                    >
                      {connecting === provider.id
                        ? "Connecting…"
                        : `Connect with ${provider.label}`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
