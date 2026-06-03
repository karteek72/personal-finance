import type { InvestmentTxnType } from "./types.js";

export function mapInvestmentAction(raw: string): InvestmentTxnType | null {
  const a = raw.trim().toUpperCase();
  if (!a) {
    return null;
  }

  if (/BUY TO COVER|BUY TO OPEN|YOU BOUGHT|^BUY$|BOUGHT|PURCHASE/.test(a)) {
    return "buy";
  }
  if (/SELL SHORT|YOU SOLD|^SELL$|SOLD|SALE/.test(a)) {
    return "sell";
  }
  if (/SHORT SALE|SELL SHORT/.test(a)) {
    return "sell_short";
  }
  if (/DIVIDEND|REINVEST/.test(a)) {
    return "dividend";
  }
  if (/INTEREST/.test(a)) {
    return "interest";
  }
  if (/CONTRIBUTION|DEPOSIT/.test(a)) {
    return "contribution";
  }
  if (/WITHDRAW|DISTRIBUTION/.test(a)) {
    return "withdrawal";
  }
  if (/FEE|COMMISSION|ADR/.test(a)) {
    return "fee";
  }
  if (/TRANSFER|JOURNAL|ACAT/.test(a)) {
    return "transfer";
  }

  return null;
}

export function mapRobinhoodTransCode(raw: string): InvestmentTxnType | null {
  const code = raw.trim().toUpperCase();
  if (code === "BUY" || code === "BTO" || code === "BTC") {
    return "buy";
  }
  if (code === "SELL" || code === "STO" || code === "STC") {
    return "sell";
  }
  if (code === "CDIV" || code === "SDIV" || code === "DIV" || code === "DIVNRA") {
    return "dividend";
  }
  if (code === "INT") {
    return "interest";
  }
  if (code === "GOLD" || code === "FEE") {
    return "fee";
  }
  if (code === "ACH" || code === "XFER" || code === "TRANS") {
    return "transfer";
  }
  return mapInvestmentAction(raw);
}

export function mapCoinbaseTransactionType(raw: string): InvestmentTxnType | null {
  const t = raw.trim().toLowerCase();
  if (t.includes("buy")) {
    return "buy";
  }
  if (t.includes("sell")) {
    return "sell";
  }
  if (t.includes("reward") || t.includes("income") || t.includes("interest")) {
    return "interest";
  }
  if (t.includes("send") || t.includes("withdraw")) {
    return "withdrawal";
  }
  if (t.includes("receive") || t.includes("deposit")) {
    return "contribution";
  }
  if (t.includes("fee")) {
    return "fee";
  }
  if (t.includes("transfer")) {
    return "transfer";
  }
  return null;
}

export function mapWebullSide(side: string): InvestmentTxnType | null {
  const s = side.trim().toUpperCase();
  if (s === "BUY") {
    return "buy";
  }
  if (s === "SELL") {
    return "sell";
  }
  return null;
}
