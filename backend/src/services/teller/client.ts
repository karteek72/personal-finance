import { readFile } from "node:fs/promises";
import { Agent } from "node:https";
import type { Env } from "../../config/env.js";
import { isTellerConfigured } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";

const TELLER_API = "https://api.teller.io";

export interface TellerAccount {
  id: string;
  enrollment_id: string;
  name: string;
  type: "depository" | "credit";
  subtype: string;
  currency: string;
  last_four: string;
  status: string;
  institution: { id: string; name: string };
  links: {
    balances?: string;
    transactions?: string;
  };
}

export interface TellerBalance {
  account_id: string;
  ledger: string | null;
  available: string | null;
}

export interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string;
  date: string;
  description: string;
  status: "posted" | "pending";
  type: string;
  details?: {
    processing_status?: string;
    category?: string | null;
    counterparty?: { name?: string | null; type?: string | null };
  };
}

let tellerAgent: Agent | undefined;

async function resolveAgent(env: Env): Promise<Agent | undefined> {
  if (env.TELLER_ENV === "sandbox") {
    return undefined;
  }
  if (!env.TELLER_CERT_PATH || !env.TELLER_KEY_PATH) {
    throw AppError.tellerError(
      "TELLER_CERT_PATH and TELLER_KEY_PATH are required for development/production Teller API",
    );
  }
  if (!tellerAgent) {
    const [cert, key] = await Promise.all([
      readFile(env.TELLER_CERT_PATH, "utf8"),
      readFile(env.TELLER_KEY_PATH, "utf8"),
    ]);
    tellerAgent = new Agent({ cert, key });
  }
  return tellerAgent;
}

async function tellerFetch<T>(
  path: string,
  accessToken: string,
  env: Env,
  init?: RequestInit,
): Promise<T> {
  if (!isTellerConfigured(env)) {
    throw AppError.providerNotConfigured("Teller");
  }

  const agent = await resolveAgent(env);
  const headers = new Headers(init?.headers);
  headers.set(
    "Authorization",
    `Basic ${Buffer.from(`${accessToken}:`).toString("base64")}`,
  );

  const response = await fetch(`${TELLER_API}${path}`, {
    ...init,
    headers,
    // @ts-expect-error Node fetch supports agent for mTLS
    agent,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw AppError.tellerError(
      `Teller API ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listTellerAccounts(
  accessToken: string,
  env: Env,
): Promise<TellerAccount[]> {
  return tellerFetch<TellerAccount[]>("/accounts", accessToken, env);
}

export async function getTellerBalances(
  accountId: string,
  accessToken: string,
  env: Env,
): Promise<TellerBalance> {
  return tellerFetch<TellerBalance>(
    `/accounts/${accountId}/balances`,
    accessToken,
    env,
  );
}

export async function listTellerTransactions(
  accountId: string,
  accessToken: string,
  env: Env,
  options?: { startDate?: string; endDate?: string },
): Promise<TellerTransaction[]> {
  const params = new URLSearchParams();
  if (options?.startDate) params.set("start_date", options.startDate);
  if (options?.endDate) params.set("end_date", options.endDate);
  const qs = params.toString();
  const path = `/accounts/${accountId}/transactions${qs ? `?${qs}` : ""}`;
  return tellerFetch<TellerTransaction[]>(path, accessToken, env);
}

export function getTellerConnectConfig(env: Env): {
  applicationId: string;
  environment: "sandbox" | "development" | "production";
  products: string[];
} {
  if (!isTellerConfigured(env)) {
    throw AppError.providerNotConfigured("Teller");
  }
  return {
    applicationId: env.TELLER_APPLICATION_ID!,
    environment: env.TELLER_ENV,
    products: ["transactions", "balance"],
  };
}
