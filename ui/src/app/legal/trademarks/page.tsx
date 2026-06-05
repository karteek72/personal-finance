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
  title: "Trademark Notice",
};

export default function TrademarkNoticePage() {
  return (
    <LegalDocument title="Trademark Notice" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        The following trademarks, service marks, and trade names are owned by{" "}
        {COMPANY_LEGAL_NAME} and may not be used without prior written permission,
        except as allowed by applicable trademark law to refer to our products or
        services accurately.
      </p>

      <LegalSection title="Our mark">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-text">{PRODUCT_NAME}™</strong> — personal finance
            software and related services offered by {COMPANY_LEGAL_NAME}
          </li>
        </ul>
        <p className="mt-3">
          {COMPANY_BRAND} is the company behind {PRODUCT_NAME}. {COMPANY_LEGAL_NAME}{" "}
          is our legal entity name.
        </p>
      </LegalSection>

      <LegalSection title="Proper use">
        <p>When referring to {PRODUCT_NAME}, please:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the mark exactly as shown above</li>
          <li>Use the ™ symbol on first prominent mention in marketing materials</li>
          <li>
            Use {PRODUCT_NAME} as an adjective modifying a noun (for example,
            &quot;{PRODUCT_NAME} application&quot;)
          </li>
          <li>Do not incorporate our marks into your company, product, or domain names</li>
          <li>Do not imply sponsorship, endorsement, or affiliation without consent</li>
        </ul>
      </LegalSection>

      <LegalSection title="Third-party marks">
        <p>
          All other trademarks, logos, and service marks displayed in {PRODUCT_NAME}
          are the property of their respective owners. References to third-party
          products or institutions do not imply endorsement by those parties.
        </p>
        <p>
          Plaid® is a registered trademark of Plaid Inc. Google® and Google Sign-In
          are trademarks of Google LLC. Other institution names and logos belong to
          their respective holders.
        </p>
      </LegalSection>

      <LegalSection title="Permissions">
        <p>
          To request permission to use the {PRODUCT_NAME} trademark in press,
          partnership, or co-marketing materials, contact{" "}
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
