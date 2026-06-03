import type { Env } from "../../config/env.js";
import { decryptField, encryptField } from "../../lib/field-crypto.js";

const PLAID_SALT = "spendflow-plaid-v1";

export function encryptPlaidToken(plaintext: string, env: Env): string {
  return encryptField(plaintext, env, PLAID_SALT);
}

export function decryptPlaidToken(ciphertext: string, env: Env): string {
  return decryptField(ciphertext, env, PLAID_SALT);
}
