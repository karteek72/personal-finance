import type { Env } from "../../config/env.js";
import { decryptField, encryptField } from "../../lib/field-crypto.js";

const TELLER_SALT = "spendflow-teller-v1";

export function encryptTellerToken(plaintext: string, env: Env): string {
  return encryptField(plaintext, env, TELLER_SALT);
}

export function decryptTellerToken(ciphertext: string, env: Env): string {
  return decryptField(ciphertext, env, TELLER_SALT);
}
