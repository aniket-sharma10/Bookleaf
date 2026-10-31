import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as listBooks } from "@/app/api/author/books/route";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthorBooksResponse } from "@/lib/api-types";
import { seedDataset } from "../../prisma/dataset";
import {
  author,
  book,
  edgeCaseRawDataset,
  rawDataset,
  toDataset,
} from "../fixtures/synthetic-dataset";
import { requestAs, testAdmin } from "../helpers/auth";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// GET /api/author/books against bookleaf_test, synthetic data only.
// A1: B1 (published, 30 pending) + B2 (in production, all nulls).
// A2: B3 (fully paid). A3: one book with 1,500 pending.
const URL = "http://localhost:3000/api/author/books";
const noParams = { params: Promise.resolve({}) };

const asAuthor = (authorId: string) => ({
  id: `user-${authorId}`,
  role: "AUTHOR" as const,
  authorId,
});

async function booksFor(authorId: string): Promise<AuthorBooksResponse> {
  const response = await listBooks(
    await requestAs(asAuthor(authorId), URL),
    noParams,
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: AuthorBooksResponse }).data;
}

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
  const raw = edgeCaseRawDataset();
  const third = rawDataset([
    author(
      { author_id: "A3", name: "Third Author", email: "third@example.test" },
      [
        book({
          book_id: "B4",
          isbn: "000-00-0XXXX-00-4",
          total_copies_sold: 150,
          total_royalty_earned: 1500,
          royalty_paid: 0,
          royalty_pending: 1500,
        }),
      ],
    ),
  ]);
  await seedDataset(
    db,
    toDataset({ authors: [...raw.authors, ...third.authors] }),
  );
});
afterAll(() => db.$disconnect());

describe("GET /api/author/books", () => {
  it("returns all of the author's books, including one in production", async () => {
    const { books } = await booksFor("A1");
    expect(books.map((b) => b.id)).toEqual(["B1", "B2"]);

    expect(books[0]).toEqual({
      id: "B1",
      title: "Example Title",
      isbn: "000-00-0XXXX-00-0",
      genre: "Example Genre",
      publicationDate: "2024-02-29",
      status: "Published & Live",
      mrp: 100,
      authorRoyaltyPerCopy: 10,
      totalCopiesSold: 3,
      totalRoyaltyEarned: 30,
      royaltyPaid: 0,
      royaltyPending: 30,
      lastRoyaltyPayoutDate: null,
      printPartner: "Example Partner",
      availableOn: ["Store A"],
    });
    // In production: nulls stay null (the UI decides how to show them).
    expect(books[1]).toMatchObject({
      id: "B2",
      publicationDate: null,
      mrp: null,
      authorRoyaltyPerCopy: null,
      printPartner: null,
      availableOn: [],
      status: "In Production - Example Stage",
    });
    expect(books[0]).not.toHaveProperty("authorId");
  });

  it("never includes another author's books (AUTH-06)", async () => {
    expect((await booksFor("A2")).books.map((b) => b.id)).toEqual(["B3"]);
    // The URL can't widen the scope: authorId comes only from the token.
    const response = await listBooks(
      await requestAs(asAuthor("A2"), `${URL}?authorId=A1`),
      noParams,
    );
    const { data } = (await response.json()) as { data: AuthorBooksResponse };
    expect(data.books.map((b) => b.id)).toEqual(["B3"]);
  });

  it("returns totals that are sums of the author's book values", async () => {
    expect((await booksFor("A1")).totals).toEqual({
      bookCount: 2,
      totalCopiesSold: 3,
      totalRoyaltyEarned: 30,
      royaltyPaid: 0,
      royaltyPending: 30,
    });
    expect((await booksFor("A2")).totals).toEqual({
      bookCount: 1,
      totalCopiesSold: 7,
      totalRoyaltyEarned: 70,
      royaltyPaid: 70,
      royaltyPending: 0,
    });
  });

  it("flags only authors with some pending royalty below ₹1,000 (BOOK-07)", async () => {
    expect((await booksFor("A1")).payout).toEqual({
      thresholdInr: 1000,
      belowThreshold: true,
    });
    expect((await booksFor("A2")).payout.belowThreshold).toBe(false); // 0 pending
    expect((await booksFor("A3")).payout.belowThreshold).toBe(false); // 1,500
  });

  it("returns an empty list and zero totals for an author with no books", async () => {
    const data = await booksFor("A-none");
    expect(data.books).toEqual([]);
    expect(data.totals.bookCount).toBe(0);
    expect(data.payout.belowThreshold).toBe(false);
  });

  it("refuses admins (403) and anonymous callers (401)", async () => {
    expect(
      (await listBooks(await requestAs(testAdmin, URL), noParams)).status,
    ).toBe(403);
    expect((await listBooks(await requestAs(null, URL), noParams)).status).toBe(
      401,
    );
  });
});
