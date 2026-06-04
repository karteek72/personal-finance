/**
 * Apply pending SQL migrations from backend/drizzle/*.sql
 * (custom runner — not drizzle-kit migrate).
 */
import { loadRootEnv } from "../src/config/load-root-env.js";
import { runMigrations } from "../src/db/migrate.js";

loadRootEnv();

await runMigrations();
process.exit(0);
