import type { Env } from "../../config/env.js";
import { decryptField, encryptField } from "../../lib/field-crypto.js";

const SNAPTRADE_SALT = "spendflow-snaptrade-v1";

export function encryptSnaptradeSecret(plaintext: string, env: Env): string {
  return encryptField(plaintext, env, SNAPTRADE_SALT);
}

export function decryptSnaptradeSecret(ciphertext: string, env: Env): string {
  return decryptField(ciphertext, env, SNAPTRADE_SALT);
}
