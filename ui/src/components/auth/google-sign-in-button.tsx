"use client";

import { useGoogleOAuth, type CredentialResponse } from "@react-oauth/google";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { isGoogleAuthEnabled } from "@/lib/auth-session";
import { useAuthStore } from "@/stores/auth-store";

type GoogleSignInButtonProps = {
  label?: string;
};

declare global {
  interface Window {
    __spendflowGoogleIdInitialized?: boolean;
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | undefined>,
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  if (!isGoogleAuthEnabled()) {
    return (
      <p className="rounded-[var(--radius-sm)] bg-bg px-4 py-3 text-xs text-text-muted">
        Set{" "}
        <code className="font-mono text-text">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>{" "}
        in the UI env and{" "}
        <code className="font-mono text-text">GOOGLE_CLIENT_ID</code> on the API
        to enable Google sign-in.
      </p>
    );
  }

  return <GoogleSignInButtonInner label={label} />;
}

function GoogleSignInButtonInner({ label }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef<(response: CredentialResponse) => void>(() => {});
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  callbackRef.current = async (response: CredentialResponse) => {
    const idToken = response.credential;
    if (!idToken) {
      setError("Google did not return a sign-in credential");
      setPending(false);
      return;
    }

    setError(null);
    try {
      const session = await api.signInWithGoogle(idToken);
      setSession(session);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setPending(false);
    }
  };

  useEffect(() => {
    if (!mounted || !scriptLoadedSuccessfully || !containerRef.current || !window.google) {
      return;
    }

    if (!window.__spendflowGoogleIdInitialized) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          setPending(true);
          setError(null);
          void callbackRef.current(response);
        },
      });
      window.__spendflowGoogleIdInitialized = true;
    }

    const container = containerRef.current;
    container.replaceChildren();

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: label === "Continue with Google" ? "continue_with" : "signin_with",
      shape: "pill",
      width: 320,
    });

    return () => {
      container.replaceChildren();
      window.google?.accounts?.id?.cancel();
    };
  }, [mounted, clientId, scriptLoadedSuccessfully, label]);

  // Server and first client paint: identical placeholder (avoids hydration mismatch).
  if (!mounted || !scriptLoadedSuccessfully) {
    return (
      <p className="text-center text-xs text-text-muted">
        Loading Google sign-in…
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div
        ref={containerRef}
        className={pending ? "pointer-events-none opacity-60" : "flex justify-center"}
        aria-busy={pending}
      />
      {pending ? (
        <p className="text-sm text-text-muted">Completing sign-in…</p>
      ) : null}
      {error ? (
        <p className="text-center text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
