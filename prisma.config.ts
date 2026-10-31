import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

import {
  ALLOW_REMOTE_ENV,
  assertPrismaCliTarget,
  DEV_HOST_ENV,
} from "./prisma/db-target";

// Prisma 7 no longer reads .env itself. Load it locally with Node's built-in
// loader (variables already set, e.g. by the hosting provider, take precedence).
// This file runs in the Prisma CLI, outside Next.js, so it reads process.env
// directly instead of importing src/server/env.ts (which is server-only).
if (existsSync(".env")) process.loadEnvFile(".env");

// Migrations use the direct (non-pooled) URL when one is configured, as the
// hosted DB requires; locally only DATABASE_URL is set. Left undefined when
// neither exists so `prisma generate` still works without a database.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || undefined;

// Every Prisma CLI command loads this file first, so this is the one place
// that can stop `migrate reset`, `migrate dev`, `db push` or `db execute` from
// reaching an unintended database (architecture §8). Only the dev database (local or
// the registered Neon host) and the local test database pass, unless the
// remote opt-in is set for that command.
assertPrismaCliTarget({
  url,
  argv: process.argv,
  allowRemote: process.env[ALLOW_REMOTE_ENV],
  devHost: process.env[DEV_HOST_ENV],
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Runs only via `prisma db seed` (Prisma 7 never seeds automatically).
    // The react-server condition lets the script import server-only modules
    // (e.g. password hashing) the same way Next.js server code does.
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: { url },
});
