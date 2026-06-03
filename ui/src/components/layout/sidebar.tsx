"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Spend" },
  { href: "/transactions", label: "Activity" },
  { href: "/accounts", label: "Accounts" },
  { href: "/debt", label: "Debt" },
  { href: "/family", label: "Family" },
] as const;

const previewItems = [
  { href: "/plan", label: "Plan" },
  { href: "/grow", label: "Grow" },
  { href: "/understand", label: "Understand" },
  { href: "/protect", label: "Protect" },
  { href: "/trim", label: "Trim" },
] as const;

function NavIcon({ href, active }: { href: string; active: boolean }) {
  const cls = clsx("h-[18px] w-[18px]", active && "stroke-[2.5]");

  switch (href) {
    case "/":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <path
            d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/categories":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <path
            d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/transactions":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
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
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
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
    case "/debt":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <path
            d="M12 3v18M7 8h6a4 4 0 0 1 0 8H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/family":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
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

  return (
    <aside className="hidden md:flex md:flex-col sticky top-0 h-screen shrink-0 overflow-y-auto w-16 lg:w-[220px] border-r border-border bg-surface py-5 transition-all">
      {/* Logo */}
      <Link
        href="/"
        className="mb-8 flex items-center justify-center lg:justify-start lg:px-4"
        aria-label="SpendFlow home"
      >
        {/* Icon-only: SF pill */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-extrabold text-white lg:hidden"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden="true"
        >
          SF
        </span>
        {/* Full logo */}
        <span className="hidden lg:block text-xl font-extrabold tracking-tight text-gradient">
          SpendFlow
        </span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={clsx(
                "flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2.5 text-sm font-semibold transition-all",
                "justify-center lg:justify-start lg:px-3",
                isActive
                  ? "bg-primary-soft text-primary"
                  : "text-text-muted hover:bg-primary-soft/30 hover:text-text",
              )}
            >
              <NavIcon href={item.href} active={isActive} />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}

        {/* Preview section */}
        <div className="mt-4 hidden lg:block">
          <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-widest text-text-muted/60">
            Preview
          </p>
          {previewItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={clsx(
                  "flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-semibold transition-all",
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-text-muted hover:bg-primary-soft/30 hover:text-text",
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Preview icon-only (collapsed) */}
        <div className="mt-4 lg:hidden">
          {previewItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={clsx(
                  "flex items-center justify-center rounded-[var(--radius-sm)] p-2 transition-all",
                  isActive ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-primary-soft/30",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
