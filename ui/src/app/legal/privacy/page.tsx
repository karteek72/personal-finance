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
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        {COMPANY_LEGAL_NAME} ({COMPANY_BRAND}) operates {PRODUCT_NAME}, a personal
        finance application that helps you understand spending, accounts, and financial
        trends. This Privacy Policy explains what information we collect, how we use
        it, and the choices you have.
      </p>

      <LegalSection title="Information we collect">
        <p>
          <strong className="text-text">Account information.</strong> When you create
          an account, we collect your email address and basic profile details needed
          to authenticate you and operate the service.
        </p>
        <p>
          <strong className="text-text">Financial data you connect.</strong> If you
          link financial institutions through our aggregation partner (Plaid) or import
          statements, we receive transaction history, account balances, institution
          names, and related metadata you authorize. We never receive or store your
          bank login credentials — authentication happens directly with your
          financial institution via Plaid.
        </p>
        <p>
          <strong className="text-text">Uploaded files.</strong> If you import
          statements manually, we temporarily store encrypted file contents only long
          enough to parse transactions, then delete the file.
        </p>
        <p>
          <strong className="text-text">Usage and device data.</strong> We collect
          limited technical information such as browser type, app version, and error
          logs to keep the service reliable and secure.
        </p>
      </LegalSection>

      <LegalSection title="How we use your information">
        <p>We use your information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve {PRODUCT_NAME}</li>
          <li>Categorize transactions and generate spending insights</li>
          <li>Sync accounts and reconcile balances on your behalf</li>
          <li>Respond to support requests and security incidents</li>
          <li>Comply with legal obligations and enforce our Terms of Service</li>
        </ul>
        <p>
          We do not sell your personal or financial data. We do not use your
          financial data for unrelated advertising.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>
          We use trusted third-party processors to operate {PRODUCT_NAME}, including
          Plaid for bank connectivity, cloud hosting providers, and email delivery
          services. These providers process data only on our instructions and under
          contractual confidentiality and security obligations.
        </p>
      </LegalSection>

      <LegalSection title="Data retention and deletion">
        <p>
          We retain your data for as long as your account is active or as needed to
          provide the service. When you delete your account, we revoke connected
          institution access, delete associated financial records, and remove personal
          profile data within a reasonable period, subject to legal retention
          requirements.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We protect sensitive data using encryption in transit (TLS) and at rest,
          including encrypted storage of institution access tokens. Access to
          production systems is restricted and audited. No security measure is
          perfect, but we design {PRODUCT_NAME} with financial-data sensitivity as a
          core requirement.
        </p>
      </LegalSection>

      <LegalSection title="Your rights and choices">
        <p>
          Depending on where you live, you may have rights to access, correct, delete,
          or export your personal data, and to object to or restrict certain
          processing. To exercise these rights, contact us at{" "}
          <a
            href={`mailto:${COMPANY_CONTACT_EMAIL}`}
            className="font-medium text-primary hover:underline"
          >
            {COMPANY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          {PRODUCT_NAME} is not directed to children under 13 (or the minimum age
          required in your jurisdiction), and we do not knowingly collect their
          personal information.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will
          be posted on this page with an updated effective date. Continued use of{" "}
          {PRODUCT_NAME} after changes become effective constitutes acceptance of the
          revised policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this Privacy Policy may be sent to {COMPANY_LEGAL_NAME} at{" "}
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
