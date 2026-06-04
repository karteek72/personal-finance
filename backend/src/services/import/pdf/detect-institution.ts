export type PdfInstitutionId =
  | "sofi-invest"
  | "bofa-credit"
  | "bofa-depository"
  | "bofa-auto-loan"
  | "fidelity"
  | "etrade"
  | "webull";

export function detectPdfInstitution(text: string): PdfInstitutionId | null {
  const head = text.slice(0, 12_000);

  if (
    /Webull Financial LLC|Welcome to your Webull Summary Statement/i.test(head) ||
    (/Account Number:\s*5MW/i.test(head) && /Apex Clearing/i.test(head))
  ) {
    return "webull";
  }

  if (
    /Fidelity Brokerage Services|YEAR-END INVESTMENT REPORT|Fidelity Investments/i.test(
      head,
    )
  ) {
    return "fidelity";
  }

  if (
    /CLIENT STATEMENT|E\*TRADE|ETRADE\.COM|Morgan Stanley at Work Self-Directed/i.test(
      head,
    )
  ) {
    return "etrade";
  }

  if (/SoFi\s+(Securities|Invest)/i.test(head)) {
    return "sofi-invest";
  }

  if (/Bank of America/i.test(head)) {
    if (isAmexMisfiled(text)) {
      return null;
    }

    if (
      /Loan account status|Loan Interest rate:|Auto Loan|650-\d{10,}/i.test(head) ||
      (/Account\s*#:\s*650-/i.test(head) && /VOLKSWAGEN|TOYOTA|HONDA|FORD|AUTO/i.test(head))
    ) {
      return "bofa-auto-loan";
    }

    const isCredit =
      /Visa\s+Signature|World\s+Mastercard|Credit Card|Cash Rewards/i.test(
        head,
      ) ||
      /Account#\s*\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/i.test(head) ||
      /! Account # [\d ]+ !/i.test(text) ||
      /\d{2}\/\d{2}\s+\d{2}\/\d{2}\s+.+\s+\d{4}\s+\d{4}\s+-?[\d,]+\.\d{2}/m.test(
        text.slice(0, 30_000),
      ) ||
      (/\bReference\b[\s\S]{0,400}\bAccount\b[\s\S]{0,200}\bAmount\b/i.test(
        text,
      ) &&
        /! Account #/i.test(text));

    if (isCredit) {
      return "bofa-credit";
    }

    const isDepository =
      /Advantage Banking|Adv Plus Banking|Relationship Banking|Money Market Savings/i.test(
        head,
      ) ||
      /Account number:\s*\d{4}\s+\d{4}\s+\d{4}/i.test(head);

    if (
      isDepository ||
      /\d{2}\/\d{2}\/\d{2}\s+.+\s+-?[\d,]+\.\d{2}/m.test(text.slice(0, 30_000))
    ) {
      return "bofa-depository";
    }

    return "bofa-depository";
  }

  return null;
}

function isAmexMisfiled(text: string): boolean {
  return (
    /American Express/i.test(text) &&
    !/Bank of America/i.test(text.slice(0, 2000))
  );
}

export function pdfInstitutionLabel(id: PdfInstitutionId | null): string {
  switch (id) {
    case "sofi-invest":
      return "SoFi Invest";
    case "bofa-credit":
      return "Bank of America (credit card)";
    case "bofa-depository":
      return "Bank of America (checking/savings)";
    case "bofa-auto-loan":
      return "Bank of America (auto loan)";
    case "fidelity":
      return "Fidelity";
    case "etrade":
      return "E*TRADE";
    case "webull":
      return "Webull";
    default:
      return "unknown institution";
  }
}
