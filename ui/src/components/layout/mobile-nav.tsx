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

function MobileNavIcon({ href, active }: { href: string; active: boolean }) {
  const common = clsx("h-5 w-5", active && "stroke-[2.5]");

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

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 md:hidden">
      <div
        className="glass mx-auto flex max-w-md items-center justify-around rounded-[var(--radius-lg)] border border-border/60 px-2 py-2"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
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
                "flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-text-muted",
              )}
            >
              <MobileNavIcon href={item.href} active={isActive} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
