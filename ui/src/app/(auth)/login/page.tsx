"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { isGoogleAuthEnabled, requiresSignIn } from "@/lib/auth-session";
import { useAuthStore } from "@/stores/auth-store";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useAuthStore((s) => s.status);
  const googleEnabled = isGoogleAuthEnabled();
  const nextPath = searchParams.get("next")?.trim() || "/";

  useEffect(() => {
    if (!requiresSignIn()) return;
    if (status === "authenticated") {
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
    }
  }, [router, status, nextPath]);

  return (
    <div className="flex min-h-screen flex-col bg-bg px-4">
      <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-surface p-8 card-shadow">
        <p className="text-2xl font-extrabold tracking-tight text-gradient">
          SpendFlow
        </p>
        <h1 className="mt-4 text-xl font-bold text-text">Welcome back</h1>
        <p className="mt-1 text-sm text-text-muted">
          Sign in to pick up where you left off
        </p>

        <div className="mt-6">
          <GoogleSignInButton redirectPath={nextPath.startsWith("/") ? nextPath : "/"} />
        </div>

        {googleEnabled ? (
          <p className="mt-6 text-center text-xs text-text-muted">
            Email and password sign-in is coming soon.
          </p>
        ) : (
          <form className="mt-6 flex flex-col gap-4" action="#" method="post">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-text-muted"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="rounded-[var(--radius-sm)] border-0 bg-bg px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-text-muted"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="rounded-[var(--radius-sm)] border-0 bg-bg px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              type="submit"
              className="mt-2 rounded-[var(--radius-pill)] bg-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-text-muted">
          New here?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Create an account
          </Link>
        </p>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-text-muted">
          By signing in, you agree to our{" "}
          <Link href="/legal/terms" className="font-medium text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      </div>
      <SiteFooter variant="compact" className="border-t-0" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-text-muted">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
