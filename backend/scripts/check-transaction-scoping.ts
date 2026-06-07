#!/usr/bin/env npx tsx
/**
 * Static check: services querying `transactions` should use household scoping helpers.
 * PR checklist item for TASK-INTEGRITY-003 (M3).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SERVICES_DIR = resolve(process.cwd(), "src/services");
const ALLOWLIST = new Set([
  "active-account-scope.ts",
  "transaction-store.ts",
  "backfill-transfers.ts",
  "backfill-subcategories.ts",
  "account-store.ts",
  "category-rules.ts",
  "dim-merchant-store.ts",
  "export-user-data.ts",
  "cross-provider-duplicates.ts",
  "import/",
  "plaid/",
  "teller/",
  "snaptrade/",
  "metrics/transaction-aggregates.ts",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = path.slice(SERVICES_DIR.length + 1);
    if (statSync(path).isDirectory()) {
      if (ALLOWLIST.has(`${rel}/`)) continue;
      out.push(...walk(path));
      continue;
    }
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
    if (ALLOWLIST.has(rel)) continue;
    out.push(path);
  }
  return out;
}

const violations: string[] = [];

for (const file of walk(SERVICES_DIR)) {
  const src = readFileSync(file, "utf8");
  if (!src.includes(".from(transactions)") && !src.includes("from(transactions)")) {
    continue;
  }
  const usesScope =
    src.includes("drizzleActiveTransactionWhere") ||
    src.includes("activeTransactionFilter") ||
    src.includes("resolveActiveAccountScope") ||
    src.includes("eq(transactions.userId") ||
    src.includes("inArray(transactions.userId");
  if (!usesScope) {
    violations.push(file.slice(SERVICES_DIR.length + 1));
  }
}

if (violations.length > 0) {
  console.error(
    "Transaction scoping check failed — query transactions via resolveHouseholdContext +\n" +
      "drizzleActiveTransactionWhere / activeTransactionFilter:\n",
  );
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("Transaction scoping check passed.");
