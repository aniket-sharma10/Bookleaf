import "server-only";

import type {
  AuthorBook,
  AuthorBookTotals,
  AuthorBooksResponse,
} from "@/lib/api-types";
import { getDb } from "@/server/db";
import {
  isBelowPayoutThreshold,
  MIN_PAYOUT_INR,
} from "@/server/policies/royalty";

// Explicit select: every book field except the owner ID (BOOK-01).
const bookSelect = {
  id: true,
  title: true,
  isbn: true,
  genre: true,
  publicationDate: true,
  status: true,
  mrp: true,
  authorRoyaltyPerCopy: true,
  totalCopiesSold: true,
  totalRoyaltyEarned: true,
  royaltyPaid: true,
  royaltyPending: true,
  lastRoyaltyPayoutDate: true,
  printPartner: true,
  availableOn: true,
} as const;

/** A `@db.Date` value (UTC midnight) as `YYYY-MM-DD`; null stays null. */
function toCalendarDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

type SummedField = Exclude<keyof AuthorBookTotals, "bookCount">;

function sumBy(books: AuthorBook[], field: SummedField): number {
  return books.reduce((total, book) => total + book[field], 0);
}

/**
 * The author's books (including ones still in production), with totals that
 * are plain sums of the stored values. `authorId` must come from the verified
 * session, never from the request (AUTH-06).
 */
export async function listBooksForAuthor(
  authorId: string,
): Promise<AuthorBooksResponse> {
  const rows = await getDb().book.findMany({
    where: { authorId },
    select: bookSelect,
    orderBy: { id: "asc" },
  });
  const books: AuthorBook[] = rows.map((row) => ({
    ...row,
    publicationDate: toCalendarDate(row.publicationDate),
    lastRoyaltyPayoutDate: toCalendarDate(row.lastRoyaltyPayoutDate),
  }));

  const totals: AuthorBookTotals = {
    bookCount: books.length,
    totalCopiesSold: sumBy(books, "totalCopiesSold"),
    totalRoyaltyEarned: sumBy(books, "totalRoyaltyEarned"),
    royaltyPaid: sumBy(books, "royaltyPaid"),
    royaltyPending: sumBy(books, "royaltyPending"),
  };

  return {
    books,
    totals,
    payout: {
      thresholdInr: MIN_PAYOUT_INR,
      belowThreshold: isBelowPayoutThreshold(totals.royaltyPending),
    },
  };
}
