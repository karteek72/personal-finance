import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Repo root (parent of `backend/`), resolved from this module location. */
export const REPO_ROOT_FROM_MODULE = resolve(moduleDir, "../../..");

let loaded = false;

export function findRepoRoot(startDir = process.cwd()): string {
  let dir = resolve(startDir);
  for (let depth = 0; depth < 8; depth += 1) {
    const hasBackend = existsSync(resolve(dir, "backend", "package.json"));
    const hasUi = existsSync(resolve(dir, "ui", "package.json"));
    const hasRootEnv = existsSync(resolve(dir, ".env"));
    if (hasBackend && hasUi && hasRootEnv) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return REPO_ROOT_FROM_MODULE;
}

/** Load environment from the single repo-root `.env` (idempotent). */
export function loadRootEnv(): string {
  const root = findRepoRoot();
  if (!loaded) {
    const envPath = resolve(root, ".env");
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath });
    }
    loaded = true;
  }
  return root;
}
