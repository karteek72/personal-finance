"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 20c0-3.5 3.134-6 7-6s7 2.5 7 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function displayLabel(email: string, displayName: string | null): string {
  if (displayName?.trim()) return displayName.trim();
  const local = email.split("@")[0] ?? "";
  return local.length > 0 ? local : email;
}

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrated = useAuthStore((s) => s.hydrated);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!hydrated || status !== "authenticated" || !user) {
    return null;
  }

  const label = displayLabel(user.email, user.displayName);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await api.signOut();
    } catch {
      // Clear local session even if the API call fails.
    } finally {
      clearSession();
      window.location.assign("/login");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-surface px-2.5 text-text-muted transition-colors card-shadow hover:text-primary",
          open && "text-primary",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
          <PersonIcon />
        </span>
        <span className="hidden max-w-[120px] truncate text-xs font-semibold text-text sm:inline">
          {label}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-[var(--radius-sm)] border border-border bg-surface p-1 card-shadow"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-text">{label}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="flex w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm font-semibold text-danger transition-colors hover:bg-bg disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
