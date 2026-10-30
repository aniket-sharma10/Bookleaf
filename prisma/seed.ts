// Seeds the supplied authors and books into the local development database.
// Run with `npm run db:seed` (which calls `prisma db seed`).
//
// Order matters: the target database is checked before the dataset is read,
// and the dataset is fully validated before any connection is opened.
// Logs contain counts only, never dataset contents.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { DatasetError, parseDataset, seedDataset } from "./dataset";
import { assertLocalDevDatabase, SeedTargetError } from "./seed-target";

// Runs outside Next.js, so load .env the same way prisma.config.ts does.
if (existsSync(".env")) process.loadEnvFile(".env");

const DEFAULT_DATA_PATH = "./bookleaf_sample_data.json";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  assertLocalDevDatabase(databaseUrl);

  const dataPath = resolve(process.env.SEED_DATA_PATH || DEFAULT_DATA_PATH);
  const dataset = parseDataset(readDatasetFile(dataPath));

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const seeded = await seedDataset(db, dataset);
    const [authorsInDb, booksInDb] = await Promise.all([
      db.author.count(),
      db.book.count(),
    ]);
    console.log(
      `Seeded ${seeded.authors} authors and ${seeded.books} books (upserted by dataset ID).`,
    );
    console.log(
      `Database now contains ${authorsInDb} authors and ${booksInDb} books.`,
    );
    if (authorsInDb !== seeded.authors || booksInDb !== seeded.books) {
      // Never deleted automatically: tickets may reference them.
      console.warn(
        "Warning: the database has records that are not in the dataset. They were left untouched.",
      );
    }
  } finally {
    await db.$disconnect();
  }
}

function readDatasetFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "file not found"
        : "file could not be read";
    throw new DatasetError(
      `Dataset ${reason}: ${path}. Place bookleaf_sample_data.json in the project root or set SEED_DATA_PATH.`,
    );
  }
}

// Prisma error messages can echo query arguments (i.e. dataset values), so
// only the error class or code is reported for query failures.
function describeError(error: unknown): string {
  if (error instanceof SeedTargetError || error instanceof DatasetError) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001") {
      return "Cannot reach the database server. Is it running? Try `npm run db:up`.";
    }
    if (error.code === "P1000") {
      return "Database authentication failed. Check the credentials in DATABASE_URL.";
    }
    return `Database error (Prisma code ${error.code}). No changes were committed.`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return "Prisma rejected the seed query (details omitted to avoid logging dataset values). No changes were committed.";
  }
  return `unexpected ${error instanceof Error ? error.name : "error"}. No changes were committed.`;
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${describeError(error)}`);
  process.exitCode = 1;
});
