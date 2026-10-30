import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { DatabaseTargetError, LOCAL_DATABASES } from "../../prisma/db-target";
import { assertTestDatabase, loadTestDatabaseUrl } from "./test-database";

/** A Prisma client for bookleaf_test, verified on the live connection. */
export async function connectTestDb(): Promise<PrismaClient> {
  const url = loadTestDatabaseUrl();
  assertTestDatabase(url);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  await assertConnectedToTestDatabase(db);
  return db;
}

/**
 * Empties every application table (keeps the migration history). Re-checks
 * the database name on the live connection first, so it can never run against
 * anything but bookleaf_test even if a caller built the client some other way.
 */
export async function truncateAllTables(db: PrismaClient): Promise<void> {
  await assertConnectedToTestDatabase(db);
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  // Table names come from the Postgres catalog, not from user input, and are
  // quoted as identifiers, so building this statement is safe.
  const list = tables
    .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    .join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function assertConnectedToTestDatabase(db: PrismaClient): Promise<void> {
  const [row] = await db.$queryRaw<
    { name: string }[]
  >`select current_database() as name`;
  if (row?.name !== LOCAL_DATABASES.test.name) {
    throw new DatabaseTargetError(
      `Connected to database "${row?.name ?? "unknown"}", expected "${LOCAL_DATABASES.test.name}".`,
    );
  }
}
