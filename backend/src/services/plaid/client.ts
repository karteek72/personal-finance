import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import type { Env } from "../../config/env.js";

let plaidClient: PlaidApi | null = null;

export function getPlaidClient(env: Env): PlaidApi {
  if (plaidClient) {
    return plaidClient;
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": env.PLAID_SECRET,
      },
    },
  });

  plaidClient = new PlaidApi(configuration);
  return plaidClient;
}

export function parsePlaidProducts(raw: string): Products[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (item === "transactions") return Products.Transactions;
      if (item === "auth") return Products.Auth;
      if (item === "identity") return Products.Identity;
      if (item === "balance") return Products.Balance;
      if (item === "liabilities") return Products.Liabilities;
      throw new Error(`Unsupported Plaid product: ${item}`);
    });
}

export function hasLiabilitiesProduct(env: Env): boolean {
  return parsePlaidProducts(env.PLAID_PRODUCTS).includes(Products.Liabilities);
}

export function parseCountryCodes(raw: string): CountryCode[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (item === "US") return CountryCode.Us;
      if (item === "CA") return CountryCode.Ca;
      throw new Error(`Unsupported country code: ${item}`);
    });
}
