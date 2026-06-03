"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navSections = [
  {
    label: null,
    items: [
      { href: "/", label: "Home" },
      { href: "/transactions", label: "Activity" },
      { href: "/categories", label: "Spend" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/plan", label: "Plan" },
      { href: "/wealth", label: "Wealth" },
      { href: "/accounts", label: "Accounts" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/understand", label: "Insights" },
      { href: "/protect", label: "Protect" },
    ],
  },
  {
    label: null,
    items: [{ href: "/family", label: "Family" }],
  },
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
    case "/plan":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "/wealth":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <path d="M4 19V5M4 19h16M8 16l4-5 3 3 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "/understand":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1 .9 1.6h5.2c0-.6.3-1.2.9-1.6A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "/protect":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 overflow-y-auto overflow-x-hidden border-r border-border bg-surface py-5 transition-all md:flex md:flex-col lg:w-[220px]">
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
        {navSections.map((section, sectionIndex) => (
          <div key={section.label ?? `section-${sectionIndex}`} className={sectionIndex > 0 ? "mt-3" : undefined}>
            {section.label ? (
              <p className="mb-1 hidden px-3 text-[9px] font-bold uppercase tracking-widest text-text-muted/60 lg:block">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

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
          </div>
        ))}
      </nav>
    </aside>
  );
}
