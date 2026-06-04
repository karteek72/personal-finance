import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEtradePdfText } from "../pdf/etrade-pdf.js";
import { parseFidelityPdfText } from "../pdf/fidelity-pdf.js";
import { parseWebullPdfText } from "../pdf/webull-pdf.js";
import { detectPdfInstitution } from "../pdf/detect-institution.js";

const ETRADE_SNIPPET = `
CLIENT STATEMENT For the Period December 1-31, 2025
Account Summary                                                                                   377-290514-204                 SUBJECT TO STA RULES
ACTIVITY
12/10        12/11      Sold                             CISCO SYS INC                              ACTED AS AGENT                                   243.000                   $80.6053         $19,587.09
12/15                   Online Transfer                  ACH WITHDRAWL                              REFID:7149923395;                                                                           (19,587.00)
`;

const FIDELITY_SNIPPET = `
2025 YEAR-END INVESTMENT REPORT
Account # X90-903881
Activity
Trades Pending Settlement on December 31, 2025
12/31 01/02      CALL (RGTI) RIGETTI COMPUTING                   RGTI           Bought                                         2.0000           $6.40000                       -$1,281.33
`;

const WEBULL_SNIPPET = `
Webull Financial LLC
Welcome to your Webull Summary Statement!
Account Number:                           5MW64666
Symbol & Name            Trade Date   Settlement Date   Buy/Sell   Quantity     Price   Gross Amount         Commission       Fee/Tax   Net Amount
BBAI 260116C00009000 -   12/04/2025        12/05/2025         S      -20.00    0.3300         660.00               0.00         -0.34       659.66      A
`;

test("detectPdfInstitution identifies brokers", () => {
  assert.equal(detectPdfInstitution(ETRADE_SNIPPET), "etrade");
  assert.equal(detectPdfInstitution(FIDELITY_SNIPPET), "fidelity");
  assert.equal(detectPdfInstitution(WEBULL_SNIPPET), "webull");
});

test("parseEtradePdfText extracts sell and transfer", () => {
  const stmts = parseEtradePdfText(ETRADE_SNIPPET, "etrade-123125.pdf");
  const total = stmts.reduce((n, s) => n + s.investmentTransactions.length, 0);
  assert.ok(total >= 2);
  const sells = stmts.flatMap((s) => s.investmentTransactions).filter((t) => t.type === "sell");
  assert.ok(sells.length >= 1);
});

test("parseEtradePdfText splits activity by account header", () => {
  const content = `
CLIENT STATEMENT For the Period January 1-31, 2025
Account Summary                                                                                       377-290514-204               SUBJECT TO STA RULES
12/10        12/11      Sold                             CISCO SYS INC                              ACTED AS AGENT                                   243.000                   $80.6053         $19,587.09
Account Summary                                                                                     258-260302-202          SUBJECT TO STA RULES
01/05        01/06      Bought                           PALANTIR TECHNOLOGIES INC CL A          ACTED AS AGENT                                 10.000       66.1300           (661.30)
`;
  const stmts = parseEtradePdfText(content, "etrade-combined.pdf");
  assert.equal(stmts.length, 2);
  const byId = new Map(stmts.map((s) => [s.account.accountIdRaw, s.investmentTransactions.length]));
  assert.equal(byId.get("377290514204"), 1);
  assert.equal(byId.get("258260302202"), 1);
});

test("parseFidelityPdfText extracts pending settlement buy", () => {
  const stmts = parseFidelityPdfText(FIDELITY_SNIPPET, "fidelity_2025.pdf");
  const total = stmts.reduce((n, s) => n + s.investmentTransactions.length, 0);
  assert.equal(total, 1);
  assert.equal(stmts[0]?.investmentTransactions[0]?.type, "buy");
});

test("parseWebullPdfText extracts summary statement trade", () => {
  const stmt = parseWebullPdfText(WEBULL_SNIPPET, "2025-12.pdf");
  assert.equal(stmt.investmentTransactions.length, 1);
  assert.equal(stmt.investmentTransactions[0]?.type, "sell");
});
