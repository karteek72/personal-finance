"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { isGoogleAuthEnabled, requiresSignIn } from "@/lib/auth-session";
import { useAuthStore } from "@/stores/auth-store";

function AuthHydrator({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return children;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

  const content = <AuthHydrator>{children}</AuthHydrator>;

  if (!isGoogleAuthEnabled()) {
    return content;
  }

  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadError={() => {
        console.error("Google Identity Services script failed to load");
      }}
    >
      {content}
    </GoogleOAuthProvider>
  );
}

function AuthLoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!requiresSignIn() || !hydrated) return;
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status, hydrated]);

  if (!requiresSignIn()) {
    return <>{children}</>;
  }

  // Until client hydrate() runs, match server HTML (always loading).
  if (!hydrated) {
    return <AuthLoadingScreen message="Loading…" />;
  }

  if (status === "unauthenticated") {
    return <AuthLoadingScreen message="Redirecting to sign in…" />;
  }

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return <AuthLoadingScreen message="Loading…" />;
}
