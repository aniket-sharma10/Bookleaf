// Read-only check that bookleaf_dev matches the local dataset JSON field by
// field. Run with `npm run db:verify`. Same target guard as the seed; output
// names record IDs and field names only, never dataset values.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { describeCliError } from "./cli-errors";
import { DEFAULT_DATASET_PATH, parseDataset, readDatasetFile } from "./dataset";
import { assertLocalDevDatabase } from "./db-target";
import { verifyDataset } from "./verify-dataset";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main(): Promise<void> {
  // The direct (non-pooled) URL when configured, as for migrations; locally
  // only DATABASE_URL is set.
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  assertLocalDevDatabase(databaseUrl, { action: "verify" });

  const dataPath = resolve(process.env.SEED_DATA_PATH || DEFAULT_DATASET_PATH);
  const dataset = parseDataset(readDatasetFile(dataPath));

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const { authors, books, problems } = await verifyDataset(db, dataset);
    if (problems.length === 0) {
      console.log(
        `Verified ${authors} authors and ${books} books: the database matches the dataset exactly.`,
      );
      return;
    }
    console.error(`Found ${problems.length} difference(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Verify failed: ${describeCliError(error)}`);
  process.exitCode = 1;
});
