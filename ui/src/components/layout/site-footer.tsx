import clsx from "clsx";
import Link from "next/link";

import {
  COMPANY_BRAND,
  COMPANY_LEGAL_NAME,
  LEGAL_LINKS,
  PRODUCT_NAME,
} from "@/lib/company";

interface SiteFooterProps {
  variant?: "default" | "compact";
  className?: string;
}

export function SiteFooter({ variant = "default", className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={clsx(
        "border-t border-border text-center text-text-muted",
        variant === "compact" ? "py-4 text-xs" : "mt-auto py-6 text-xs",
        className,
      )}
      aria-label="Site footer"
    >
      <p className="mx-auto max-w-2xl">
        © {year} {COMPANY_LEGAL_NAME}. {PRODUCT_NAME} is a product of{" "}
        {COMPANY_BRAND}.
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-[11px] leading-relaxed">
        {PRODUCT_NAME}™ is a trademark of {COMPANY_LEGAL_NAME}. All rights reserved.
      </p>
      <nav
        aria-label="Legal and company"
        className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1"
      >
        {LEGAL_LINKS.map((link, index) => (
          <span key={link.href} className="inline-flex items-center gap-3">
            {index > 0 ? (
              <span aria-hidden="true" className="text-border">
                ·
              </span>
            ) : null}
            <Link
              href={link.href}
              className="font-medium text-text-muted transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </span>
        ))}
      </nav>
    </footer>
  );
}
