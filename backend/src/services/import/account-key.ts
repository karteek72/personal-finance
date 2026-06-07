import { createHash } from "node:crypto";
import { maskFromAccountId } from "./csv-parse.js";
import type { ParsedAccountIdentity } from "./types.js";

export function buildImportAccountKey(
  institutionName: string,
  accountIdRaw: string,
  type: string,
): string {
  const payload = `${institutionName.trim().toLowerCase()}|${accountIdRaw.trim()}|${type}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function buildInvestmentIdentity(
  institutionName: string,
  accountIdRaw: string,
  officialName?: string,
  subtype: ParsedAccountIdentity["subtype"] = "brokerage",
): ParsedAccountIdentity {
  const mask = maskFromAccountId(accountIdRaw);
  return {
    institutionName,
    accountIdRaw,
    mask,
    type: "investment",
    subtype,
    officialName,
    currencyCode: "USD",
    importAccountKey: buildImportAccountKey(
      institutionName,
      accountIdRaw,
      "investment",
    ),
  };
}

export function buildCreditIdentity(
  institutionName: string,
  accountIdRaw: string,
  officialName?: string,
): ParsedAccountIdentity {
  const mask = maskFromAccountId(accountIdRaw);
  const display = officialName ?? `${institutionName} ••${mask}`;
  return {
    institutionName,
    accountIdRaw,
    mask,
    type: "credit",
    subtype: "credit_card",
    officialName: display,
    currencyCode: "USD",
    importAccountKey: buildImportAccountKey(
      institutionName,
      accountIdRaw,
      "credit",
    ),
  };
}

export function buildDepositoryIdentity(
  institutionName: string,
  accountIdRaw: string,
  subtype: "checking" | "savings" = "checking",
  officialName?: string,
): ParsedAccountIdentity {
  const mask = maskFromAccountId(accountIdRaw);
  const display = officialName ?? `${institutionName} ••${mask}`;
  return {
    institutionName,
    accountIdRaw,
    mask,
    type: "depository",
    subtype,
    officialName: display,
    currencyCode: "USD",
    importAccountKey: buildImportAccountKey(
      institutionName,
      accountIdRaw,
      "depository",
    ),
  };
}
