import {
  detectPdfInstitution,
  pdfInstitutionLabel,
} from "./pdf/detect-institution.js";
import { pdfBufferToText } from "./pdf/extract-text.js";
import {
  parseBofaAutoLoanText,
  parseBofaCreditCardText,
  parseBofaDepositoryText,
} from "./pdf/bofa-pdf.js";
import { parseEtradePdfText } from "./pdf/etrade-pdf.js";
import { parseFidelityPdfText } from "./pdf/fidelity-pdf.js";
import { parseSofiInvestText } from "./pdf/sofi-invest.js";
import { parseWebullPdfText } from "./pdf/webull-pdf.js";
import { parseCsvStatement } from "./parse-csv.js";
import { parseOfxFile } from "./parse-ofx.js";
import type { ParsedStatement } from "./types.js";

export function parseImportFile(
  format: string,
  input: string | Buffer,
  filename: string,
): ParsedStatement[] {
  switch (format) {
    case "csv":
      return [parseCsvStatement(input.toString(), filename)];
    case "qfx":
    case "ofx":
      return parseOfxFile(input.toString(), filename);
    case "pdf":
      throw new Error(
        "PDF files require async parsing. The import worker handles this automatically.",
      );
    default:
      throw new Error(`Unsupported import format: ${format}`);
  }
}

export async function parseImportFileAsync(
  format: string,
  input: string | Buffer,
  filename: string,
): Promise<ParsedStatement[]> {
  if (format === "pdf") {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    let text: string;
    try {
      text = await pdfBufferToText(buffer);
    } catch {
      throw new Error(
        "Could not read PDF (pdftotext unavailable). Upload CSV or QFX/OFX instead.",
      );
    }

    if (text.trim().length < 40) {
      throw new Error(
        "PDF appears empty or scanned. Export CSV/QFX from your broker or use a text-based statement.",
      );
    }

    const institution = detectPdfInstitution(text);
    if (institution === "fidelity") {
      return parseFidelityPdfText(text, filename);
    }
    if (institution === "etrade") {
      return parseEtradePdfText(text, filename);
    }
    if (institution === "webull") {
      return [parseWebullPdfText(text, filename)];
    }
    if (institution === "sofi-invest") {
      return [parseSofiInvestText(text, filename)];
    }
    if (institution === "bofa-credit") {
      return [parseBofaCreditCardText(text, filename)];
    }
    if (institution === "bofa-depository") {
      return [parseBofaDepositoryText(text, filename)];
    }
    if (institution === "bofa-auto-loan") {
      return [parseBofaAutoLoanText(text, filename)];
    }

    throw new Error(
      `Unsupported PDF statement (${pdfInstitutionLabel(institution)}). ` +
        "Supported PDFs: Bank of America, SoFi Invest, Fidelity, E*TRADE, Webull. " +
        "For Amex, Discover, and Citi use CSV exports.",
    );
  }

  return parseImportFile(format, input, filename);
}
