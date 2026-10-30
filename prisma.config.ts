import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env itself. Load it locally with Node's built-in
// loader (variables already set, e.g. by the hosting provider, take precedence).
// This file runs in the Prisma CLI, outside Next.js, so it reads process.env
// directly instead of importing src/server/env.ts (which is server-only).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations use the direct (non-pooled) URL when one is configured, as the
    // hosted DB requires; locally only DATABASE_URL is set. Left undefined when
    // neither exists so `prisma generate` still works without a database.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || undefined,
  },
});
