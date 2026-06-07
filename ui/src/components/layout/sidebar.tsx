"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/layout/nav-icon";
import { isNavItemActive, NAV_SECTIONS } from "@/lib/nav-config";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 overflow-y-auto overflow-x-hidden border-r border-border bg-surface py-5 transition-all md:flex md:flex-col lg:w-[220px]">
      <Link
        href="/"
        className="mb-8 flex items-center justify-center lg:justify-start lg:px-4"
        aria-label="SpendFlow home"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-extrabold text-white lg:hidden"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden="true"
        >
          SF
        </span>
        <span className="hidden text-xl font-extrabold tracking-tight text-gradient lg:block">
          SpendFlow
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Main navigation">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div
            key={section.label ?? `section-${sectionIndex}`}
            className={sectionIndex > 0 ? "mt-3" : undefined}
          >
            {section.label ? (
              <p className="mb-1 hidden px-3 text-[9px] font-bold uppercase tracking-widest text-text-muted/60 lg:block">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);

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
                  <NavIcon
                    href={item.href}
                    active={isActive}
                    className="h-[18px] w-[18px]"
                  />
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
