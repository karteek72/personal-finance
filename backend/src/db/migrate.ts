import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const MIGRATION_FILES = ["0000_init.sql", "0001_plaid.sql"];

export async function runMigrations(databaseUrl?: string): Promise<void> {
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
    if (applied) continue;

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
  }

  await sqlClient.end({ timeout: 5 });
}
