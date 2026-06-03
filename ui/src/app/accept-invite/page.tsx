"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { isGoogleAuthEnabled, requiresSignIn } from "@/lib/auth-session";
import { useAuthStore } from "@/stores/auth-store";
import type { HouseholdInvitePreview } from "@/types/api";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const authStatus = useAuthStore((s) => s.status);

  const [preview, setPreview] = useState<HouseholdInvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("Missing invitation token.");
      return;
    }

    let cancelled = false;
    void api
      .previewHouseholdInvite(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(
            err instanceof Error ? err.message : "Could not load invitation",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await api.acceptHouseholdInvite(token);
      setAccepted(true);
      router.replace("/");
    } catch (err) {
      setAcceptError(
        err instanceof Error ? err.message : "Could not accept invitation",
      );
    } finally {
      setAccepting(false);
    }
  }, [router, token]);

  useEffect(() => {
    if (
      !requiresSignIn() ||
      authStatus !== "authenticated" ||
      !token ||
      !preview ||
      preview.status !== "pending" ||
      accepted
    ) {
      return;
    }
    void handleAccept();
  }, [authStatus, accepted, handleAccept, preview, token]);

  const loginNext = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : "/accept-invite";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card padding="lg" className="w-full max-w-md">
        <p className="text-2xl font-extrabold tracking-tight text-gradient">
          SpendFlow
        </p>
        <h1 className="mt-4 text-xl font-bold text-text">Join your household</h1>

        {previewError ? (
          <p className="mt-3 text-sm text-danger">{previewError}</p>
        ) : null}

        {preview ? (
          <div className="mt-4 space-y-2 text-sm text-text-muted">
            <p>
              You&apos;re invited to <strong className="text-text">{preview.householdName}</strong> as{" "}
              <strong className="text-text">{preview.memberName}</strong> ({preview.memberRole}).
            </p>
            <p>
              Sign in as <strong className="text-text">{preview.email}</strong> to accept.
            </p>
            {preview.status === "expired" ? (
              <p className="text-warning">This invitation has expired. Ask for a new link.</p>
            ) : null}
            {preview.status === "accepted" ? (
              <p className="text-success">This invitation was already accepted.</p>
            ) : null}
          </div>
        ) : !previewError ? (
          <p className="mt-3 text-sm text-text-muted">Loading invitation…</p>
        ) : null}

        {acceptError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {acceptError}
          </p>
        ) : null}

        {preview?.status === "pending" && requiresSignIn() ? (
          <div className="mt-6">
            {authStatus === "authenticated" ? (
              <button
                type="button"
                disabled={accepting}
                onClick={() => void handleAccept()}
                className="w-full rounded-[var(--radius-pill)] bg-primary px-5 py-3 text-sm font-semibold text-text-inverse disabled:opacity-50"
              >
                {accepting ? "Joining…" : "Accept invitation"}
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs text-text-muted">
                  Sign in with the invited Google account to continue.
                </p>
                {isGoogleAuthEnabled() ? (
                  <GoogleSignInButton redirectPath={loginNext} />
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(loginNext)}`}
                    className="text-center text-sm font-semibold text-primary hover:underline"
                  >
                    Go to sign in
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-text-muted">
          <Link href="/" className="text-primary hover:underline">
            Back to app
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-text-muted">
          Loading…
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
