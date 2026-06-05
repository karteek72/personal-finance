import type { Metadata } from "next";

import { COMPANY_BRAND, PRODUCT_NAME } from "@/lib/company";

export const metadata: Metadata = {
  title: {
    template: `%s | ${PRODUCT_NAME}`,
    default: `Legal | ${PRODUCT_NAME}`,
  },
  description: `Legal notices, privacy policy, and terms for ${PRODUCT_NAME} by ${COMPANY_BRAND}.`,
};

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
