import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { seedDataset } from "../../prisma/dataset";
import { verifyDataset } from "../../prisma/verify-dataset";
import {
  author,
  book,
  edgeCaseRawDataset,
  rawDataset,
  toDataset,
} from "../fixtures/synthetic-dataset";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Seed + verification against bookleaf_test with synthetic data only.
let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
});
beforeEach(() => truncateAllTables(db));
afterAll(() => db.$disconnect());

describe("seedDataset", () => {
  it("stores every field exactly as supplied", async () => {
    const dataset = toDataset(edgeCaseRawDataset());
    expect(await seedDataset(db, dataset)).toEqual({ authors: 2, books: 3 });

    const { problems } = await verifyDataset(db, dataset);
    expect(problems).toEqual([]);

    // Spot checks independent of the shared mapping functions.
    const inProduction = await db.book.findUniqueOrThrow({
      where: { id: "B2" },
    });
    expect(inProduction).toMatchObject({
      authorId: "A1",
      status: "In Production - Example Stage",
      publicationDate: null,
      mrp: null,
      authorRoyaltyPerCopy: null,
      printPartner: null,
      lastRoyaltyPayoutDate: null,
      availableOn: [],
      totalRoyaltyEarned: 0,
      royaltyPaid: 0,
      royaltyPending: 0,
    });

    const paid = await db.book.findUniqueOrThrow({ where: { id: "B3" } });
    expect(paid.authorId).toBe("A2");
    expect(paid.title).toBe("Café’s Ünusual Notes");
    expect(paid.publicationDate?.toISOString().slice(0, 10)).toBe("2023-12-31");
    expect(paid.lastRoyaltyPayoutDate?.toISOString().slice(0, 10)).toBe(
      "2024-01-01",
    );
    expect(paid.availableOn).toEqual(["Store A", "Store B", "Store C"]);

    const second = await db.author.findUniqueOrThrow({ where: { id: "A2" } });
    expect(second.joinedDate.toISOString().slice(0, 10)).toBe("2022-12-31");
  });

  it("is idempotent: re-running creates no duplicates", async () => {
    const dataset = toDataset(edgeCaseRawDataset());
    await seedDataset(db, dataset);
    await seedDataset(db, dataset);
    expect(await db.author.count()).toBe(2);
    expect(await db.book.count()).toBe(3);
    expect((await verifyDataset(db, dataset)).problems).toEqual([]);
  });

  it("re-running restores drifted values to the source", async () => {
    const dataset = toDataset(edgeCaseRawDataset());
    await seedDataset(db, dataset);
    await db.book.update({ where: { id: "B1" }, data: { royaltyPaid: 999 } });

    expect((await verifyDataset(db, dataset)).problems).toEqual([
      "Book B1: royaltyPaid differs",
    ]);
    await seedDataset(db, dataset);
    expect((await verifyDataset(db, dataset)).problems).toEqual([]);
  });

  it("rolls back every write when any upsert fails", async () => {
    // A pre-existing author holds the second author's email under another ID,
    // so the second author's upsert hits the unique constraint.
    await db.author.create({
      data: {
        id: "OTHER",
        name: "Existing",
        email: "second@example.test",
        phone: "0",
        city: "X",
        joinedDate: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    await expect(
      seedDataset(db, toDataset(edgeCaseRawDataset())),
    ).rejects.toMatchObject({ code: "P2002" });
    // A1 and its books were written before the failure and must be gone.
    expect(await db.author.findMany({ select: { id: true } })).toEqual([
      { id: "OTHER" },
    ]);
    expect(await db.book.count()).toBe(0);
  });
});

describe("verifyDataset", () => {
  it("reports missing and extra records by ID, never by value", async () => {
    const dataset = toDataset(edgeCaseRawDataset());
    await seedDataset(db, dataset);
    await db.book.delete({ where: { id: "B3" } });
    await db.author.create({
      data: {
        id: "EXTRA",
        name: "Not In Dataset",
        email: "extra@example.test",
        phone: "0",
        city: "X",
        joinedDate: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    const { problems } = await verifyDataset(db, dataset);
    expect(problems).toEqual([
      "Book B3: missing from database",
      "Author EXTRA: in database but not in dataset",
    ]);
    expect(problems.join("\n")).not.toMatch(/Café|Not In Dataset|extra@/);
  });

  it("detects a book moved to another author", async () => {
    const raw = rawDataset([
      author({}, [book()]),
      author({ author_id: "A2", email: "a2@example.test" }, []),
    ]);
    const dataset = toDataset(raw);
    await seedDataset(db, dataset);
    await db.book.update({ where: { id: "B1" }, data: { authorId: "A2" } });

    expect((await verifyDataset(db, dataset)).problems).toEqual([
      "Book B1: authorId differs",
    ]);
  });
});
