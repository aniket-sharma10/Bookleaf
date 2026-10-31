// Test-database guard and reset (architecture §8).
//
// The test database URL comes only from .env.test: never from .env and never
// from variables exported in the shell, so a stray DATABASE_URL cannot redirect
// destructive test operations. Every destructive step re-checks the target.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import {
  ALLOW_REMOTE_ENV,
  assertLocalDatabase,
  DatabaseTargetError,
} from "../../prisma/db-target";

export const TEST_ENV_FILE = ".env.test";

/** Reads DATABASE_URL from .env.test and checks it is the local test database. */
export function loadTestDatabaseUrl(
  envFilePath = resolve(process.cwd(), TEST_ENV_FILE),
): string {
  let contents: string;
  try {
    contents = readFileSync(envFilePath, "utf8");
  } catch {
    throw new DatabaseTargetError(
      `Missing ${TEST_ENV_FILE}. Create it with: cp .env.test.example .env.test`,
    );
  }
  const url = parseEnv(contents).DATABASE_URL;
  assertLocalDatabase(url, ["test"], "use as the test database");
  return url;
}

/** Guard for destructive operations (reset, truncate): test mode + test DB. */
export function assertTestDatabase(
  url: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): asserts url is string {
  if (nodeEnv !== "test") {
    throw new DatabaseTargetError(
      `Refusing destructive test-database operations: NODE_ENV is "${nodeEnv ?? "unset"}", expected "test".`,
    );
  }
  assertLocalDatabase(url, ["test"], "reset or truncate");
}

/**
 * Drops everything in bookleaf_test and re-applies all migrations with
 * `prisma migrate reset --force`. Two guards apply: assertTestDatabase here,
 * then prisma.config.ts inside the CLI (the remote opt-in is stripped from the
 * child environment so that second guard can never be skipped).
 */
export function resetTestDatabase(): void {
  const url = loadTestDatabaseUrl();
  assertTestDatabase(url);

  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url };
  // An empty DIRECT_URL stops a shell-exported or .env value taking precedence
  // in prisma.config.ts (process.loadEnvFile never overrides set variables).
  env.DIRECT_URL = "";
  delete env[ALLOW_REMOTE_ENV];

  const prismaCli = resolve(
    process.cwd(),
    "node_modules/prisma/build/index.js",
  );
  const result = spawnSync(
    process.execPath,
    [prismaCli, "migrate", "reset", "--force"],
    { env, encoding: "utf8" },
  );
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(
      `Resetting the test database failed. Is it running? Try: npm run db:up\n${output}`,
    );
  }
}
