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
  title: "Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of{" "}
        {PRODUCT_NAME}, a product of {COMPANY_BRAND}, operated by {COMPANY_LEGAL_NAME}
        (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account
        or using {PRODUCT_NAME}, you agree to these Terms.
      </p>

      <LegalSection title="Eligibility">
        <p>
          You must be at least 18 years old (or the age of majority in your
          jurisdiction) and capable of entering a binding contract. You may use{" "}
          {PRODUCT_NAME} only for lawful personal or household financial management.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          {PRODUCT_NAME} provides tools to aggregate, categorize, and visualize
          financial activity from accounts you connect or data you import. Features
          may change over time. Some capabilities shown in the product may be marked
          as previews or illustrative until fully released.
        </p>
        <p>
          {PRODUCT_NAME} is an informational tool. It does not provide investment,
          tax, or legal advice, and it is not a bank, broker-dealer, or payment
          processor.
        </p>
      </LegalSection>

      <LegalSection title="Your account and responsibilities">
        <p>
          You are responsible for maintaining the confidentiality of your login
          credentials and for all activity under your account. You agree to provide
          accurate information and to use {PRODUCT_NAME} in compliance with
          applicable law and the terms of any third-party services you connect (such as
          Plaid and your financial institutions).
        </p>
      </LegalSection>

      <LegalSection title="Connected accounts and imports">
        <p>
          When you link a financial institution or upload a statement, you represent
          that you have the right to access that data and authorize us to retrieve,
          store, and process it to provide the service. You may disconnect accounts at
          any time through the product or by contacting support.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use {PRODUCT_NAME} to violate law or third-party rights</li>
          <li>Attempt to access another user&apos;s data without authorization</li>
          <li>Reverse engineer, scrape, or overload the service</li>
          <li>Introduce malware or interfere with service security or availability</li>
        </ul>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          {PRODUCT_NAME}, its software, design, documentation, and branding are owned
          by {COMPANY_LEGAL_NAME} and protected by intellectual property laws. These
          Terms do not grant you any rights to our trademarks except as needed to use
          the service. See our{" "}
          <a href="/legal/trademarks" className="font-medium text-primary hover:underline">
            Trademark Notice
          </a>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          {PRODUCT_NAME} is provided &quot;as is&quot; and &quot;as available.&quot;
          We do not guarantee that balances, categories, or projections will be
          error-free or complete. Financial data depends on third-party sources and
          may be delayed or inaccurate. You are responsible for verifying information
          before making financial decisions.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, {COMPANY_LEGAL_NAME} and its
          affiliates will not be liable for indirect, incidental, special,
          consequential, or punitive damages, or for any loss of profits, data, or
          goodwill arising from your use of {PRODUCT_NAME}. Our aggregate liability for
          any claim relating to the service is limited to the greater of (a) amounts
          you paid us for the service in the twelve months before the claim or (b)
          USD $100.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may stop using {PRODUCT_NAME} at any time. We may suspend or terminate
          access if you breach these Terms, if required by law, or to protect the
          service or other users. Upon termination, provisions that by their nature
          should survive will remain in effect.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, United
          States, without regard to conflict-of-law principles, except where mandatory
          consumer protections in your jurisdiction apply.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For questions about these Terms, contact {COMPANY_LEGAL_NAME} at{" "}
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
