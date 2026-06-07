"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavIcon } from "@/components/layout/nav-icon";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  isMoreNavActive,
  isNavItemActive,
  MOBILE_MORE_NAV,
  MOBILE_PRIMARY_NAV,
} from "@/lib/nav-config";

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreNavActive(pathname);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [moreOpen]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 px-2 pb-3 md:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className="glass mx-auto flex w-full max-w-lg items-stretch overflow-hidden rounded-[var(--radius-lg)] border border-border/60 px-0.5 py-1.5"
          style={{ boxShadow: "var(--shadow-float)" }}
        >
          {MOBILE_PRIMARY_NAV.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 transition-colors",
                  isActive ? "text-primary" : "text-text-muted",
                )}
              >
                <NavIcon
                  href={item.href}
                  active={isActive}
                  className="h-[22px] w-[22px] shrink-0"
                />
                <span
                  className={clsx(
                    "text-[9px] font-semibold leading-none transition-all",
                    isActive ? "opacity-100" : "opacity-0 h-0 overflow-hidden",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="More navigation"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
            className={clsx(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 transition-colors",
              moreActive || moreOpen ? "text-primary" : "text-text-muted",
            )}
          >
            <NavIcon
              href="__more__"
              active={moreActive || moreOpen}
              className="h-[22px] w-[22px] shrink-0"
            />
            <span
              className={clsx(
                "text-[9px] font-semibold leading-none transition-all",
                moreActive || moreOpen
                  ? "opacity-100"
                  : "opacity-0 h-0 overflow-hidden",
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <ModalPortal>
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation menu"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMoreOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-[var(--radius-lg)] border border-border bg-surface px-4 pb-8 pt-3"
              style={{ boxShadow: "var(--shadow-float)" }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <p className="mb-3 text-sm font-bold text-text">More</p>
              <div className="space-y-4">
                {MOBILE_MORE_NAV.map((section, sectionIndex) => (
                  <div key={section.label ?? `more-section-${sectionIndex}`}>
                    {section.label ? (
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-muted/70">
                        {section.label}
                      </p>
                    ) : null}
                    <div className="grid gap-1">
                      {section.items.map((item) => {
                        const isActive = isNavItemActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={clsx(
                              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm font-semibold transition-colors",
                              isActive
                                ? "bg-primary-soft text-primary"
                                : "text-text hover:bg-primary-soft/30",
                            )}
                          >
                            <NavIcon
                              href={item.href}
                              active={isActive}
                              className="h-5 w-5 shrink-0"
                            />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
