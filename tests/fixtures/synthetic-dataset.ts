// Synthetic records with the same shape and edge cases as the supplied dataset
// (requirements §12–13), but invented values. The real dataset is confidential
// and must never appear in tests (public repo).

import { type Dataset, parseDataset } from "../../prisma/dataset";

type Overrides = Record<string, unknown>;

/** A published book with sales, nothing paid yet and no payout date. */
export function book(overrides: Overrides = {}) {
  return {
    book_id: "B1",
    title: "Example Title",
    isbn: "000-00-0XXXX-00-0",
    genre: "Example Genre",
    publication_date: "2024-02-29",
    status: "Published & Live",
    mrp: 100,
    author_royalty_per_copy: 10,
    total_copies_sold: 3,
    total_royalty_earned: 30,
    royalty_paid: 0,
    royalty_pending: 30,
    last_royalty_payout_date: null,
    print_partner: "Example Partner",
    available_on: ["Store A"],
    ...overrides,
  };
}

/** A book still in production: null date, MRP, per-copy royalty and partner. */
export function inProductionBook(overrides: Overrides = {}) {
  return book({
    book_id: "B2",
    isbn: "000-00-0XXXX-00-1",
    publication_date: null,
    status: "In Production - Example Stage",
    mrp: null,
    author_royalty_per_copy: null,
    total_copies_sold: 0,
    total_royalty_earned: 0,
    royalty_pending: 0,
    print_partner: null,
    available_on: [],
    ...overrides,
  });
}

export function author(
  overrides: Overrides = {},
  books: unknown[] = [book(), inProductionBook()],
) {
  return {
    author_id: "A1",
    name: "Example Author",
    email: "author@example.test",
    phone: "+00-00000-00000",
    city: "Example City",
    joined_date: "2023-01-01",
    books,
    ...overrides,
  };
}

/** Raw JSON-shaped dataset (before validation). */
export function rawDataset(authors: unknown[] = [author()]) {
  return { authors };
}

/**
 * Two authors covering every edge case: in-production nulls and an empty
 * platform list, zero payouts, a fully paid book with a payout date, several
 * platforms, and a non-ASCII title.
 */
export function edgeCaseRawDataset() {
  return rawDataset([
    author(),
    author(
      {
        author_id: "A2",
        name: "Second Author",
        email: "second@example.test",
        joined_date: "2022-12-31",
      },
      [
        book({
          book_id: "B3",
          isbn: "000-00-0XXXX-00-2",
          title: "Café’s Ünusual Notes",
          publication_date: "2023-12-31",
          total_copies_sold: 7,
          total_royalty_earned: 70,
          royalty_paid: 70,
          royalty_pending: 0,
          last_royalty_payout_date: "2024-01-01",
          available_on: ["Store A", "Store B", "Store C"],
        }),
      ],
    ),
  ]);
}

/** Validated through the real parser, as the seed does. */
export function toDataset(raw: unknown): Dataset {
  return parseDataset(JSON.stringify(raw));
}
