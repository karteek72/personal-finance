"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";

import { api } from "@/lib/api-client";
import {
  clearPlaidLinkToken,
  getPlaidLinkToken,
} from "@/lib/plaid-storage";

type OAuthStatus = "loading" | "opening" | "error" | "done";

export function PlaidOAuthHandler() {
  const router = useRouter();
  const [status, setStatus] = useState<OAuthStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkToken] = useState<string | null>(() => getPlaidLinkToken());
  const [receivedRedirectUri] = useState<string | undefined>(() =>
    typeof window !== "undefined" ? window.location.href : undefined,
  );

  const finishSuccess = useCallback(() => {
    clearPlaidLinkToken();
    setStatus("done");

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "spendflow:plaid-oauth-success" },
        window.location.origin,
      );
      window.close();
      return;
    }

    router.replace("/accounts");
  }, [router]);

  const handleSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken) => {
      try {
        setStatus("opening");
        await api.exchangePlaidToken(publicToken);
        finishSuccess();
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to finish account linking",
        );
      }
    },
    [finishSuccess],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: handleSuccess,
    onExit: (error) => {
      if (error?.error_message) {
        setStatus("error");
        setErrorMessage(error.error_message);
      }
    },
  });

  useEffect(() => {
    if (!linkToken) {
      setStatus("error");
      setErrorMessage(
        "Link session expired. Close this window and connect again from Accounts.",
      );
      return;
    }

    if (!receivedRedirectUri) {
      setStatus("error");
      setErrorMessage("Missing OAuth redirect information.");
      return;
    }

    if (ready) {
      setStatus("opening");
      open();
    }
  }, [linkToken, receivedRedirectUri, ready, open]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <h1 className="text-lg font-semibold text-text">
        {status === "error"
          ? "Could not finish linking"
          : "Finishing bank connection…"}
      </h1>

      {status === "loading" || status === "opening" ? (
        <p className="max-w-md text-sm text-text-muted">
          SpendFlow is reopening Plaid to complete your bank sign-in. This
          should happen automatically.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="max-w-md text-sm text-danger">{errorMessage}</p>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.opener && !window.opener.closed) {
                window.close();
              } else {
                router.replace("/accounts");
              }
            }}
            className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-2 text-sm font-medium text-text"
          >
            Back to Accounts
          </button>
          {linkToken && ready ? (
            <button
              type="button"
              onClick={() => open()}
              className="rounded-[var(--radius-card)] border border-primary bg-primary px-4 py-2 text-sm font-medium text-text-inverse"
            >
              Continue linking
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
