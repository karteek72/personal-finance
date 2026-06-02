"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccess,
  type PlaidLinkOptions,
} from "react-plaid-link";

import { api } from "@/lib/api-client";
import { storePlaidLinkToken } from "@/lib/plaid-storage";

interface PlaidLinkLauncherProps {
  linkToken: string;
  label?: string;
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

function PlaidLinkLauncher({
  linkToken,
  label = "Connect Account",
  className,
  onSuccess,
  onError,
}: PlaidLinkLauncherProps) {
  const [exchanging, setExchanging] = useState(false);

  const handleSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken) => {
      try {
        setExchanging(true);
        await api.exchangePlaidToken(publicToken);
        onSuccess?.();
      } catch (error) {
        onError?.(
          error instanceof Error
            ? error.message
            : "Failed to connect account",
        );
      } finally {
        setExchanging(false);
      }
    },
    [onError, onSuccess],
  );

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (error) => {
      if (error?.error_message) {
        onError?.(error.error_message);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <button
      type="button"
      disabled={!ready || exchanging}
      onClick={() => open()}
      className={
        className ??
        "inline-flex items-center justify-center rounded-[var(--radius-card)] border border-primary bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      }
    >
      {exchanging ? "Syncing transactions…" : label}
    </button>
  );
}

interface PlaidLinkButtonProps {
  label?: string;
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function PlaidLinkButton({
  label,
  className,
  onSuccess,
  onError,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLinkToken() {
      try {
        setLoading(true);
        const response = await api.createPlaidLinkToken("web");
        if (!cancelled) {
          storePlaidLinkToken(response.linkToken);
          setLinkToken(response.linkToken);
        }
      } catch (error) {
        if (!cancelled) {
          onError?.(
            error instanceof Error
              ? error.message
              : "Failed to initialize Plaid Link",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchLinkToken();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  if (loading || !linkToken) {
    return (
      <button
        type="button"
        disabled
        className={
          className ??
          "inline-flex items-center justify-center rounded-[var(--radius-card)] border border-primary bg-primary px-4 py-2 text-sm font-medium text-text-inverse opacity-60"
        }
      >
        Loading Plaid…
      </button>
    );
  }

  return (
    <PlaidLinkLauncher
      linkToken={linkToken}
      label={label}
      className={className}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}
