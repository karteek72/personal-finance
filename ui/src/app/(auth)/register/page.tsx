"use client";

import Link from "next/link";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { isGoogleAuthEnabled } from "@/lib/auth-session";

export default function RegisterPage() {
  const googleEnabled = isGoogleAuthEnabled();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-surface p-8 card-shadow">
        <p className="text-2xl font-extrabold tracking-tight text-gradient">
          SpendFlow
        </p>
        <h1 className="mt-4 text-xl font-bold text-text">Get started</h1>
        <p className="mt-1 text-sm text-text-muted">
          Track spending without the spreadsheet energy
        </p>

        <div className="mt-6">
          <GoogleSignInButton label="Sign up with Google" />
        </div>

        {!googleEnabled ? (
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
                autoComplete="new-password"
                required
                className="rounded-[var(--radius-sm)] border-0 bg-bg px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              type="submit"
              className="mt-2 rounded-[var(--radius-pill)] bg-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
            >
              Create account
            </button>
          </form>
        ) : null}

        <p className="mt-5 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
