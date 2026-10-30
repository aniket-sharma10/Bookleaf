import { readFileSync } from "node:fs";

import { z } from "zod";

import type { Prisma, PrismaClient } from "../src/generated/prisma/client";

// Strict mirror of bookleaf_sample_data.json (docs/requirements.md §12).
// Validation only: no value is trimmed, normalised or recalculated. Unknown or
// missing keys are rejected so a changed file fails loudly instead of being
// partially imported.

const text = z.string().min(1, "must not be empty");
const wholeNumber = z.number().int().nonnegative();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date")
  .refine(isCalendarDate, "must be a real calendar date");

const bookSchema = z.strictObject({
  book_id: text,
  title: text,
  isbn: text, // masked placeholder in the dataset: stored verbatim, never validated as an ISBN
  genre: text,
  publication_date: isoDate.nullable(),
  status: text,
  mrp: wholeNumber.nullable(),
  author_royalty_per_copy: wholeNumber.nullable(),
  total_copies_sold: wholeNumber,
  total_royalty_earned: wholeNumber,
  royalty_paid: wholeNumber,
  royalty_pending: wholeNumber,
  last_royalty_payout_date: isoDate.nullable(),
  print_partner: text.nullable(),
  available_on: z.array(text),
});

const authorSchema = z.strictObject({
  author_id: text,
  name: text,
  email: text,
  phone: text,
  city: text,
  joined_date: isoDate,
  books: z.array(bookSchema),
});

export const datasetSchema = z
  .strictObject({ authors: z.array(authorSchema).min(1) })
  .superRefine((dataset, ctx) => {
    // Upserts key on these values, so a duplicate would silently merge records.
    const seen = {
      author_id: new Set<string>(),
      email: new Set<string>(),
      book_id: new Set<string>(),
      isbn: new Set<string>(),
    };
    const check = (
      field: keyof typeof seen,
      value: string,
      path: (string | number)[],
    ) => {
      if (seen[field].has(value)) {
        ctx.addIssue({ code: "custom", path, message: `duplicate ${field}` });
      }
      seen[field].add(value);
    };
    dataset.authors.forEach((author, a) => {
      check("author_id", author.author_id, ["authors", a, "author_id"]);
      check("email", author.email, ["authors", a, "email"]);
      author.books.forEach((book, b) => {
        check("book_id", book.book_id, ["authors", a, "books", b, "book_id"]);
        check("isbn", book.isbn, ["authors", a, "books", b, "isbn"]);
      });
    });
  });

export type Dataset = z.infer<typeof datasetSchema>;
type DatasetAuthor = Dataset["authors"][number];
type DatasetBook = DatasetAuthor["books"][number];

export class DatasetError extends Error {
  override name = "DatasetError";
}

/**
 * Parses and validates the raw file contents. Error messages name the failing
 * paths and rules only, never dataset values.
 */
export function parseDataset(raw: string): Dataset {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Node's SyntaxError quotes part of the input, so it is not passed on.
    throw new DatasetError("Dataset file is not valid JSON.");
  }
  const result = datasetSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new DatasetError(
      `Dataset does not match the expected structure:\n  - ${problems.join("\n  - ")}`,
    );
  }
  return result.data;
}

export const DEFAULT_DATASET_PATH = "./bookleaf_sample_data.json";

/** Reads the dataset file; errors name the path but never the contents. */
export function readDatasetFile(path: string): string {
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

export type SeedSummary = { authors: number; books: number };

/**
 * Upserts every author and book by its dataset ID inside one transaction, so a
 * failure leaves the database unchanged and re-runs never create duplicates.
 * Callers are responsible for choosing a safe target database.
 */
export async function seedDataset(
  db: PrismaClient,
  dataset: Dataset,
): Promise<SeedSummary> {
  return db.$transaction(
    async (tx) => {
      let books = 0;
      for (const author of dataset.authors) {
        const authorData = toAuthorData(author);
        await tx.author.upsert({
          where: { id: authorData.id },
          create: authorData,
          update: authorData,
        });
        for (const book of author.books) {
          const bookData = toBookData(author.author_id, book);
          await tx.book.upsert({
            where: { id: bookData.id },
            create: bookData,
            update: bookData,
          });
          books += 1;
        }
      }
      return { authors: dataset.authors.length, books };
    },
    { timeout: 30_000 },
  );
}

// snake_case → camelCase only; values are passed through unchanged.
// Exported so verifyDataset() compares the database with the same mapping.
export function toAuthorData(author: DatasetAuthor): Prisma.AuthorCreateInput {
  return {
    id: author.author_id,
    name: author.name,
    email: author.email,
    phone: author.phone,
    city: author.city,
    joinedDate: toDbDate(author.joined_date),
  };
}

export function toBookData(
  authorId: string,
  book: DatasetBook,
): Prisma.BookUncheckedCreateInput {
  return {
    id: book.book_id,
    authorId,
    title: book.title,
    isbn: book.isbn,
    genre: book.genre,
    publicationDate: toDbDateOrNull(book.publication_date),
    status: book.status,
    mrp: book.mrp,
    authorRoyaltyPerCopy: book.author_royalty_per_copy,
    totalCopiesSold: book.total_copies_sold,
    totalRoyaltyEarned: book.total_royalty_earned,
    royaltyPaid: book.royalty_paid,
    royaltyPending: book.royalty_pending,
    lastRoyaltyPayoutDate: toDbDateOrNull(book.last_royalty_payout_date),
    printPartner: book.print_partner,
    availableOn: book.available_on,
  };
}

// Columns are Postgres DATE. Building the Date at UTC midnight keeps the stored
// calendar day identical to the source string regardless of machine timezone.
function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDbDateOrNull(value: string | null): Date | null {
  return value === null ? null : toDbDate(value);
}

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
