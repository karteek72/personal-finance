/** Plaid PFC detailed code for credit card bill payments from checking. */
export const CREDIT_CARD_PAYMENT_PFC = "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT";

export const INTERNAL_TRANSFER_CATEGORY = "Transfers (internal)" as const;
export const CREDIT_CARD_PAYMENT_SUBCATEGORY = "Credit Card Payments" as const;

const CREDIT_CARD_PAYMENT_PATTERNS = [
  /payment thank you/i,
  /online scheduled payment/i,
  /autopay/i,
  /credit card payment/i,
  /card autopay/i,
  /payment from chk/i,
  /ach pmt/i,
  /epayment/i,
  /e-payment/i,
  /chase credit/i,
  /amex.*payment/i,
  /discover.*payment/i,
  /citi.*autopay/i,
  /capital one.*payment/i,
  /barclays.*payment/i,
  /syncb/i,
  /cardmember/i,
];

export function matchesCreditCardPaymentText(
  name: string,
  merchantName?: string | null,
): boolean {
  const haystack = `${merchantName ?? ""} ${name}`.trim();
  return CREDIT_CARD_PAYMENT_PATTERNS.some((pattern) => pattern.test(haystack));
}

export interface TransferResolutionInput {
  category: string;
  subCategory: string | null;
  name: string;
  merchantName: string | null;
  pfcDetailed?: string | null;
}

export interface TransferResolution {
  category: typeof INTERNAL_TRANSFER_CATEGORY;
  subCategory: string;
  transactionType: "transfer";
  isTransfer: true;
}

/**
 * Credit card bill payments and other internal transfers should not count as spend.
 * The underlying card charges are already categorized as expenses.
 */
export function resolveInternalTransfer(
  input: TransferResolutionInput,
): TransferResolution | null {
  const isCreditCardPayment =
    input.pfcDetailed === CREDIT_CARD_PAYMENT_PFC ||
    matchesCreditCardPaymentText(input.name, input.merchantName) ||
    (input.category === "Financial & Insurance" &&
      input.subCategory === CREDIT_CARD_PAYMENT_SUBCATEGORY) ||
    (input.category === INTERNAL_TRANSFER_CATEGORY &&
      input.subCategory === CREDIT_CARD_PAYMENT_SUBCATEGORY);

  if (isCreditCardPayment) {
    return {
      category: INTERNAL_TRANSFER_CATEGORY,
      subCategory: CREDIT_CARD_PAYMENT_SUBCATEGORY,
      transactionType: "transfer",
      isTransfer: true,
    };
  }

  if (input.category === INTERNAL_TRANSFER_CATEGORY) {
    return {
      category: INTERNAL_TRANSFER_CATEGORY,
      subCategory: input.subCategory ?? "Bank Transfers",
      transactionType: "transfer",
      isTransfer: true,
    };
  }

  return null;
}
