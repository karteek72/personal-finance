import postgres from "postgres";
import { createLogger } from "../lib/logger.js";

const log = createLogger("analytics.refresh-marts");

const MART_VIEWS = [
  "mart_cashflow_month",
  "mart_category_month",
  "mart_recurring",
  "mart_net_worth_month",
] as const;

let refreshPromise: Promise<void> | null = null;
let lastRefreshAt = 0;
const MIN_REFRESH_INTERVAL_MS = 30_000;

function getSqlClient(): postgres.Sql {
  const url =
    process.env.DATABASE_URL ??
    "postgresql://spendflow:spendflow@localhost:5433/spendflow";
  return postgres(url, { max: 1 });
}

/** Refresh analytics materialized views (CONCURRENTLY when possible). */
export async function refreshAnalyticsMarts(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
    return;
  }

  if (refreshPromise) {
    await refreshPromise;
    return;
  }

  refreshPromise = (async () => {
    const sql = getSqlClient();
    try {
      for (const view of MART_VIEWS) {
        try {
          await sql.unsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
          log.debug({ view }, "refreshed materialized view");
        } catch (err) {
          log.warn({ err, view }, "concurrent refresh failed; trying non-concurrent");
          await sql.unsafe(`REFRESH MATERIALIZED VIEW ${view}`);
        }
      }
      lastRefreshAt = Date.now();
    } finally {
      await sql.end({ timeout: 5 });
      refreshPromise = null;
    }
  })();

  await refreshPromise;
}

/** Test hook — reset debounce state. */
export function resetMartRefreshDebounce(): void {
  lastRefreshAt = 0;
  refreshPromise = null;
}
