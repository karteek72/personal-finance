"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/flow", label: "Flow" },
  { href: "/categories", label: "Spend" },
  { href: "/transactions", label: "Activity" },
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
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-[220px] shrink-0 flex-col px-4 py-6 md:flex">
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

      <p className="px-3 text-xs text-text-muted">
        Your money, minus the stress
      </p>
    </aside>
  );
}
