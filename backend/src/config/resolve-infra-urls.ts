import { existsSync } from "node:fs";

function isContainerRuntime(): boolean {
  return (
    process.env.SPENDFLOW_RUNTIME === "container" ||
    existsSync("/.dockerenv")
  );
}

function encodePostgresPassword(password: string): string {
  return encodeURIComponent(password);
}

/** Rewrite docker-compose hostnames to localhost when API/worker run on the host. */
export function resolveInfraUrlsForHostRuntime(): void {
  if (isContainerRuntime()) {
    return;
  }

  const pgUser = process.env.POSTGRES_USER ?? "spendflow";
  const pgPassword = process.env.POSTGRES_PASSWORD ?? "spendflow";
  const pgDb = process.env.POSTGRES_DB ?? "spendflow";
  const pgPort = process.env.POSTGRES_HOST_PORT ?? "5433";
  const redisPort = process.env.REDIS_HOST_PORT ?? "6380";

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const redisUrl = process.env.REDIS_URL ?? "";

  const databaseUsesContainerHost =
    databaseUrl.includes("@postgres:") ||
    databaseUrl.includes("@postgres/") ||
    databaseUrl.includes("@spendflow-postgres:") ||
    databaseUrl.includes("host.containers.internal");

  const redisUsesContainerHost =
    redisUrl.includes("redis://redis:") ||
    redisUrl === "redis://redis:6379" ||
    redisUrl.includes("redis://spendflow-redis:");

  if (!databaseUrl || databaseUsesContainerHost) {
    process.env.DATABASE_URL = `postgresql://${pgUser}:${encodePostgresPassword(pgPassword)}@127.0.0.1:${pgPort}/${pgDb}`;
  }

  if (!redisUrl || redisUsesContainerHost) {
    process.env.REDIS_URL = `redis://127.0.0.1:${redisPort}`;
  }
}
