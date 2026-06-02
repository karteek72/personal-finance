"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/flow", label: "Flow" },
  { href: "/categories", label: "Spend" },
  { href: "/transactions", label: "Activity" },
  { href: "/family", label: "Family" },
  { href: "/accounts", label: "Wallet" },
] as const;

function NavIcon({ href, active }: { href: string; active: boolean }) {
  const common = clsx("h-[18px] w-[18px]", active && "stroke-[2.5]");

  switch (href) {
    case "/":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/flow":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M4 14h4l2-4 4 8 2-4h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/categories":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "/transactions":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "/accounts":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <rect
            x="3"
            y="6"
            width="18"
            height="12"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "/family":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4 20c0-3 2.5-5 5-5s5 2 5 5M14 20c0-2.5 1.8-4.5 4-4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrated = useAuthStore((s) => s.hydrated);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [signingOut, setSigningOut] = useState(false);

  const showAccount = hydrated && status === "authenticated" && user;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await api.signOut();
    } catch {
      // Clear local session even if the API call fails.
    } finally {
      clearSession();
      router.push("/login");
    }
  }

  return (
    <aside className="hidden h-full w-[220px] shrink-0 flex-col px-4 py-6 md:flex md:flex-col">
      <Link href="/" className="mb-8 px-3">
        <span className="text-xl font-extrabold tracking-tight text-gradient">
          SpendFlow
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-primary-soft text-primary"
                  : "text-text-muted hover:bg-surface hover:text-text",
              )}
            >
              <NavIcon href={item.href} active={isActive} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 px-3">
        {showAccount ? (
          <>
            <p className="truncate text-xs font-semibold text-text">
              {user.displayName ?? user.email}
            </p>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm font-semibold text-text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : null}
        <p className="text-xs text-text-muted">Your money, minus the stress</p>
      </div>
    </aside>
  );
}
