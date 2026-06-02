"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ConnectedAccount {
  id: string;
  name: string;
  institutionName: string;
  mask: string | null;
}

interface SidebarProps {
  accounts?: ConnectedAccount[];
}

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/flow", label: "Money Flow" },
  { href: "/categories", label: "Categories" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
] as const;

function NavIcon({ href }: { href: string }) {
  const common = "h-4 w-4";

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
            d="M3 4.5A1.5 1.5 0 0 1 4.5 3h2A1.5 1.5 0 0 1 8 4.5V6a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 3 6V4.5ZM8 11.5A1.5 1.5 0 0 1 9.5 10h2A1.5 1.5 0 0 1 13 11.5V13a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 8 13v-1.5ZM3 11.5A1.5 1.5 0 0 1 4.5 10h2A1.5 1.5 0 0 1 8 11.5V13a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 3 13v-1.5Z"
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

export function Sidebar({ accounts = [] }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="border-b border-border px-5 py-5">
        <Link href="/" className="text-lg font-bold text-primary">
          SpendFlow
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
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
                "flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-bg hover:text-text",
              )}
            >
              <NavIcon href={item.href} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {accounts.length > 0 ? (
        <div className="border-t border-border px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Connected Accounts
          </p>
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="rounded-[var(--radius-card)] border border-border bg-bg px-3 py-2"
              >
                <p className="truncate text-sm font-medium text-text">
                  {account.name}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {account.institutionName}
                  {account.mask ? ` ·••• ${account.mask}` : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
