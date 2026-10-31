// Seeds the supplied authors and books, plus the login accounts, into the
// development database. Run with `npm run db:seed` (which calls
// `prisma db seed`). Add `-- --reset-passwords` to re-hash existing accounts'
// passwords from the current SEED_*_PASSWORD values.
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
import { readSeedPasswords, seedUsers } from "./users";

// Runs outside Next.js, so load .env the same way prisma.config.ts does.
if (existsSync(".env")) process.loadEnvFile(".env");

async function main(): Promise<void> {
  // The direct (non-pooled) URL when configured, as for migrations; locally
  // only DATABASE_URL is set.
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  assertLocalDevDatabase(databaseUrl, { action: "seed" });
  const passwords = readSeedPasswords();
  const resetPasswords = process.argv.includes("--reset-passwords");

  const dataPath = resolve(process.env.SEED_DATA_PATH || DEFAULT_DATASET_PATH);
  const dataset = parseDataset(readDatasetFile(dataPath));

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const seeded = await seedDataset(db, dataset);
    const users = await seedUsers(db, dataset, passwords, { resetPasswords });
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
    console.log(
      `Upserted ${users.authors} author logins and ${users.admins} admin logins; ` +
        `${users.passwordsSet} password(s) set${resetPasswords ? " (reset requested)" : ""}.`,
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
    `Seed failed: ${describeCliError(error, "The failing step was rolled back.")}`,
  );
  process.exitCode = 1;
});
