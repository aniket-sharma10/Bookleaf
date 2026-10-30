// Seeds the supplied authors and books into the local development database.
// Run with `npm run db:seed` (which calls `prisma db seed`).
//
// Order matters: the target database is checked before the dataset is read,
// and the dataset is fully validated before any connection is opened.
// Logs contain counts only, never dataset contents.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { describeCliError } from "./cli-errors";
import {
  DEFAULT_DATASET_PATH,
  parseDataset,
  readDatasetFile,
  seedDataset,
} from "./dataset";
import { assertLocalDevDatabase } from "./db-target";

// Runs outside Next.js, so load .env the same way prisma.config.ts does.
if (existsSync(".env")) process.loadEnvFile(".env");

async function main(): Promise<void> {
  // The direct (non-pooled) URL when configured, as for migrations; locally
  // only DATABASE_URL is set.
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  assertLocalDevDatabase(databaseUrl, { action: "seed" });

  const dataPath = resolve(process.env.SEED_DATA_PATH || DEFAULT_DATASET_PATH);
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

main().catch((error: unknown) => {
  console.error(
    `Seed failed: ${describeCliError(error, "No changes were committed.")}`,
  );
  process.exitCode = 1;
});
