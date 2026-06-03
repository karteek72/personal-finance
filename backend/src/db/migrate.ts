import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { createLogger } from "../lib/logger.js";

const log = createLogger("db.migrate");

const MIGRATION_FILES = [
  "0000_init.sql",
  "0001_plaid.sql",
  "0002_households.sql",
  "0003_google_auth.sql",
  "0004_household_invitations.sql",
  "0005_merchant_category_rules.sql",
  "0006_subcategories.sql",
  "0007_credit_card_liabilities.sql",
  "0008_feature_tables.sql",
  "0009_import_batches.sql",
  "0010_import_preview_dedup.sql",
  "0011_import_compliance.sql",
];

let migrationPromise: Promise<void> | null = null;

async function runMigrationsOnce(databaseUrl?: string): Promise<void> {
  const url =
    databaseUrl ??
    process.env.DATABASE_URL ??
    "postgresql://spendflow:spendflow@localhost:5433/spendflow";
  const sqlClient = postgres(url);

  await sqlClient`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const [row] = await sqlClient<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'transactions'
    ) AS exists
  `;
  const hasTransactions = row?.exists ?? false;

  if (hasTransactions) {
    await sqlClient`
      INSERT INTO schema_migrations (filename)
      VALUES ('0000_init.sql')
      ON CONFLICT (filename) DO NOTHING
    `;
  }

  for (const file of MIGRATION_FILES) {
    const [applied] = await sqlClient<{ filename: string }[]>`
      SELECT filename FROM schema_migrations WHERE filename = ${file}
    `;
    if (applied) {
      log.debug({ file }, "migration already applied");
      continue;
    }

    log.info({ file }, "applying migration");
    const migration = readFileSync(
      resolve(process.cwd(), "drizzle", file),
      "utf-8",
    );
    const statements = migration.split("--> statement-breakpoint");
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        await sqlClient.unsafe(trimmed);
      }
    }

    await sqlClient`
      INSERT INTO schema_migrations (filename) VALUES (${file})
    `;
    log.info({ file }, "migration applied");
  }

  await sqlClient.end({ timeout: 5 });
}

/** Runs pending SQL migrations once per process (safe if multiple routes import this). */
export function runMigrations(databaseUrl?: string): Promise<void> {
  migrationPromise ??= runMigrationsOnce(databaseUrl);
  return migrationPromise;
}
