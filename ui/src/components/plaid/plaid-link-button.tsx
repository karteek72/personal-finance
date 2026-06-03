"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccess,
  type PlaidLinkOptions,
} from "react-plaid-link";
import clsx from "clsx";

import { IconButton, PlusIcon } from "@/components/ui/icon-button";
import { api } from "@/lib/api-client";
import { storePlaidLinkToken } from "@/lib/plaid-storage";

const defaultClassName =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-primary px-5 py-2.5 text-sm font-semibold text-text-inverse transition-all hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const dashedClassName =
  "flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-border/80 bg-surface/50 text-text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

interface PlaidLinkLauncherProps {
  linkToken: string;
  label?: string;
  className?: string;
  variant?: "default" | "dashed" | "icon";
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

function PlaidLinkLauncher({
  linkToken,
  label = "Connect account",
  className,
  variant = "default",
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

  if (variant === "icon") {
    return (
      <IconButton
        label={exchanging ? "Connecting…" : (label ?? "Add account")}
        disabled={!ready || exchanging}
        onClick={() => open()}
      >
        <PlusIcon className={exchanging ? "animate-spin" : undefined} />
      </IconButton>
    );
  }

  if (variant === "dashed") {
    return (
      <button
        type="button"
        disabled={!ready || exchanging}
        onClick={() => open()}
        className={clsx(dashedClassName, className)}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <PlusIcon />
        </span>
        <span className="text-sm font-semibold">
          {exchanging ? "Connecting…" : label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!ready || exchanging}
      onClick={() => open()}
      className={className ?? defaultClassName}
    >
      {exchanging ? "Syncing…" : label}
    </button>
  );
}

interface PlaidLinkButtonProps {
  label?: string;
  className?: string;
  variant?: "default" | "dashed" | "icon";
  /** DB plaid_items.id — opens Plaid Link in update mode for reconnect. */
  itemId?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function PlaidLinkButton({
  label,
  className,
  variant = "default",
  itemId,
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
        const response = await api.createPlaidLinkToken("web", itemId);
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
  }, [itemId, onError]);

  if (loading || !linkToken) {
    if (variant === "icon") {
      return (
        <IconButton label={label ?? "Add account"} disabled>
          <PlusIcon />
        </IconButton>
      );
    }
    if (variant === "dashed") {
      return (
        <div className={clsx(dashedClassName, "opacity-50")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <PlusIcon />
          </span>
          <span className="text-sm font-semibold">{label ?? "Add account"}</span>
        </div>
      );
    }

    return (
      <button type="button" disabled className={className ?? defaultClassName}>
        {label ?? "Add account"}
      </button>
    );
  }

  return (
    <PlaidLinkLauncher
      linkToken={linkToken}
      label={label}
      className={className}
      variant={variant}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}
