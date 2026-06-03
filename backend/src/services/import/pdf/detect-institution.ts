export type PdfInstitutionId =
  | "sofi-invest"
  | "unknown";

export function detectPdfInstitution(text: string): PdfInstitutionId | null {
  const head = text.slice(0, 8000);

  if (/SoFi\s+(Securities|Invest)/i.test(head)) {
    return "sofi-invest";
  }

  return null;
}

export function pdfInstitutionLabel(id: PdfInstitutionId | null): string {
  if (id === "sofi-invest") {
    return "SoFi Invest";
  }
  return "unknown institution";
}
