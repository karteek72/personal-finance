import type { Metadata } from "next";

import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import {
  COMPANY_BRAND,
  COMPANY_CONTACT_EMAIL,
  COMPANY_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  PRODUCT_NAME,
} from "@/lib/company";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <LegalDocument title="About" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        {PRODUCT_NAME} is built by {COMPANY_BRAND}, the consumer software brand of{" "}
        {COMPANY_LEGAL_NAME}. We help households see where money goes, connect
        accounts in one place, and make calmer decisions about spending, saving, and
        planning — without spreadsheet gymnastics.
      </p>

      <LegalSection title="Our mission">
        <p>
          Financial clarity should feel approachable, not overwhelming. {PRODUCT_NAME}
          aggregates transactions, surfaces patterns, and keeps the story of your money
          in one calm, trustworthy place.
        </p>
      </LegalSection>

      <LegalSection title="What SpendFlow does">
        <ul className="list-disc space-y-2 pl-5">
          <li>Connect checking, credit, and investment accounts via secure aggregation</li>
          <li>Import statements when direct connections are unavailable</li>
          <li>Categorize activity and highlight trends across merchants and categories</li>
          <li>Track net worth, debt, and household views for shared finances</li>
        </ul>
      </LegalSection>

      <LegalSection title="Company">
        <p>
          <strong className="text-text">Legal entity:</strong> {COMPANY_LEGAL_NAME}
        </p>
        <p>
          <strong className="text-text">Product:</strong> {PRODUCT_NAME}
        </p>
        <p>
          <strong className="text-text">Brand:</strong> {COMPANY_BRAND}
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For product feedback, partnerships, or legal inquiries, email{" "}
          <a
            href={`mailto:${COMPANY_CONTACT_EMAIL}`}
            className="font-medium text-primary hover:underline"
          >
            {COMPANY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
