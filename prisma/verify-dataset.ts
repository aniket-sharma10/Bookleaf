import type { PrismaClient } from "../src/generated/prisma/client";
import { type Dataset, toAuthorData, toBookData } from "./dataset";

export type VerifyResult = {
  authors: number;
  books: number;
  /** One line per difference, naming the record ID and field, never values. */
  problems: string[];
};

type Row = Record<string, unknown>;

/**
 * Read-only check that the Author and Book tables hold exactly the dataset:
 * every record present, every field equal to the seed mapping, and no extra
 * rows. Used by `npm run db:verify` (real data, dev DB) and by the integration
 * tests (synthetic data, test DB).
 */
export async function verifyDataset(
  db: PrismaClient,
  dataset: Dataset,
): Promise<VerifyResult> {
  const [authorRows, bookRows] = await Promise.all([
    db.author.findMany(),
    db.book.findMany(),
  ]);
  const authorsById = new Map<string, Row>(authorRows.map((r) => [r.id, r]));
  const booksById = new Map<string, Row>(bookRows.map((r) => [r.id, r]));
  const problems: string[] = [];
  let books = 0;

  for (const author of dataset.authors) {
    compareRecord("Author", toAuthorData(author), authorsById, problems);
    for (const book of author.books) {
      compareRecord(
        "Book",
        toBookData(author.author_id, book),
        booksById,
        problems,
      );
      books += 1;
    }
  }
  // Whatever compareRecord did not consume is in the database but not the file.
  for (const id of authorsById.keys()) {
    problems.push(`Author ${id}: in database but not in dataset`);
  }
  for (const id of booksById.keys()) {
    problems.push(`Book ${id}: in database but not in dataset`);
  }

  return { authors: dataset.authors.length, books, problems };
}

function compareRecord(
  label: string,
  expected: { id: string },
  rowsById: Map<string, Row>,
  problems: string[],
): void {
  const actual = rowsById.get(expected.id);
  rowsById.delete(expected.id);
  if (!actual) {
    problems.push(`${label} ${expected.id}: missing from database`);
    return;
  }
  for (const [field, value] of Object.entries(expected)) {
    if (!sameValue(value, actual[field])) {
      problems.push(`${label} ${expected.id}: ${field} differs`);
    }
  }
}

function sameValue(expected: unknown, actual: unknown): boolean {
  if (expected instanceof Date || actual instanceof Date) {
    return (
      expected instanceof Date &&
      actual instanceof Date &&
      expected.getTime() === actual.getTime()
    );
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    return (
      Array.isArray(expected) &&
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, i) => item === actual[i])
    );
  }
  return expected === actual;
}
