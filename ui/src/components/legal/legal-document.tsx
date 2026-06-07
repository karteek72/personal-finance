import type { ReactNode } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { COMPANY_BRAND, PRODUCT_NAME } from "@/lib/company";

interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalDocument({
  title,
  lastUpdated,
  children,
}: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity hover:opacity-80"
        >
          ← Back to {PRODUCT_NAME}
        </Link>

        <header className="mt-6 border-b border-border pb-6">
          <p className="text-sm font-semibold text-text-muted">{COMPANY_BRAND}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">
            {title}
          </h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: {lastUpdated}</p>
        </header>

        <article className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-text">
          {children}
        </article>

        <SiteFooter variant="compact" className="mt-12" />
      </div>
    </div>
  );
}

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="text-base font-bold text-text">{title}</h2>
      <div className="mt-2 space-y-3 text-text-muted">{children}</div>
    </section>
  );
}
