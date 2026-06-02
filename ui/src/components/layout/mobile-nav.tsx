"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", shortLabel: "Home" },
  { href: "/flow", label: "Money Flow", shortLabel: "Flow" },
  { href: "/categories", label: "Categories", shortLabel: "Cats" },
  { href: "/transactions", label: "Transactions", shortLabel: "Txns" },
  { href: "/accounts", label: "Accounts", shortLabel: "Accts" },
] as const;

function MobileNavIcon({ href }: { href: string }) {
  const common = "h-5 w-5";

  switch (href) {
    case "/":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M2 6.5 8 2l6 4.5V14a1 1 0 0 1-1 1h-3.5v-4H6.5v4H3a1 1 0 0 1-1-1V6.5Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/flow":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M2 8h4l1.5-3L10 11l1.5-3H14"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/categories":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M3 4.5A1.5 1.5 0 0 1 4.5 3h2A1.5 1.5 0 0 1 8 4.5V6a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 3 6V4.5Z"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </svg>
      );
    case "/transactions":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <path
            d="M3 4.5h10M3 8h10M3 11.5h6"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      );
    case "/accounts":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
          <rect
            x="2"
            y="4"
            width="12"
            height="8"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path d="M2 7h12" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden">
      <ul className="grid grid-cols-5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  isActive ? "text-primary" : "text-text-muted",
                )}
              >
                <MobileNavIcon href={item.href} />
                <span>{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
