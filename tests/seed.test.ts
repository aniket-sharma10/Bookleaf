import { describe, expect, it } from "vitest";

import { DatasetError, parseDataset } from "../prisma/dataset";
import { assertLocalDevDatabase, SeedTargetError } from "../prisma/seed-target";

// Synthetic fixture with the dataset's shape. Real dataset values are never
// committed (public repo); the real file is checked by the seed itself.
function book(overrides: Record<string, unknown> = {}) {
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

function inProductionBook(overrides: Record<string, unknown> = {}) {
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

function dataset(books: unknown[] = [book(), inProductionBook()]) {
  return {
    authors: [
      {
        author_id: "A1",
        name: "Example Author",
        email: "author@example.test",
        phone: "+00-00000-00000",
        city: "Example City",
        joined_date: "2023-01-01",
        books,
      },
    ],
  };
}

const parse = (value: unknown) => parseDataset(JSON.stringify(value));

describe("parseDataset", () => {
  it("accepts nullable fields, empty arrays and zero amounts unchanged", () => {
    const result = parse(dataset());
    const [published, inProduction] = result.authors[0]!.books;
    expect(published).toEqual(book());
    expect(inProduction).toEqual(inProductionBook());
    expect(inProduction!.available_on).toEqual([]);
  });

  it("rejects unknown keys", () => {
    expect(() => parse(dataset([book({ extra: "x" })]))).toThrow(
      /authors\.0\.books\.0: Unrecognized key/,
    );
  });

  it("rejects missing keys, including nullable ones", () => {
    const withoutMrp: Record<string, unknown> = book();
    delete withoutMrp.mrp;
    expect(() => parse(dataset([withoutMrp]))).toThrow(
      /authors\.0\.books\.0\.mrp/,
    );
  });

  it("rejects wrong types and non-integer amounts", () => {
    expect(() => parse(dataset([book({ mrp: "100" })]))).toThrow(/\.mrp/);
    expect(() => parse(dataset([book({ royalty_paid: 1.5 })]))).toThrow(
      /\.royalty_paid/,
    );
  });

  it("rejects malformed and impossible dates", () => {
    expect(() =>
      parse(dataset([book({ publication_date: "2024/01/01" })])),
    ).toThrow(/publication_date: must be a YYYY-MM-DD date/);
    expect(() =>
      parse(dataset([book({ publication_date: "2023-02-30" })])),
    ).toThrow(/publication_date: must be a real calendar date/);
  });

  it("rejects duplicate IDs and ISBNs that would merge records on upsert", () => {
    expect(() => parse(dataset([book(), book()]))).toThrow(
      /duplicate book_id[\s\S]*duplicate isbn/,
    );
  });

  it("reports invalid JSON without echoing the file contents", () => {
    const secret = "do-not-print-me";
    const run = () => parseDataset(`{"authors": [${secret}`);
    expect(run).toThrow(DatasetError);
    expect(run).toThrow("Dataset file is not valid JSON.");
    expect(run).not.toThrow(new RegExp(secret));
  });

  it("reports validation failures without echoing values", () => {
    const run = () =>
      parse(dataset([book({ title: "", genre: 42, status: "visible?" })]));
    expect(run).toThrow(/\.title: must not be empty/);
    expect(run).not.toThrow(/42|visible\?/);
  });
});

describe("assertLocalDevDatabase", () => {
  const dev = "postgresql://bookleaf:pw@127.0.0.1:55432/bookleaf_dev";

  it("accepts the local development database", () => {
    expect(() => assertLocalDevDatabase(dev, "development")).not.toThrow();
    expect(() =>
      assertLocalDevDatabase(
        "postgres://u:p@localhost:55432/bookleaf_dev",
        "development",
      ),
    ).not.toThrow();
  });

  it.each([
    ["the test database", "postgresql://u:pw@127.0.0.1:55433/bookleaf_test"],
    [
      "the dev name on the test port",
      "postgresql://u:pw@127.0.0.1:55433/bookleaf_dev",
    ],
    ["another local Postgres", "postgresql://u:pw@127.0.0.1:5432/bookleaf_dev"],
    [
      "a hosted database",
      "postgresql://u:pw@ep-x.example.neon.tech/bookleaf_dev?sslmode=require",
    ],
    ["a different database name", "postgresql://u:pw@127.0.0.1:55432/postgres"],
    ["a non-Postgres URL", "mysql://u:pw@127.0.0.1:55432/bookleaf_dev"],
  ])("refuses %s", (_label, url) => {
    expect(() => assertLocalDevDatabase(url, "development")).toThrow(
      SeedTargetError,
    );
  });

  it("refuses when NODE_ENV is production, even for the dev URL", () => {
    expect(() => assertLocalDevDatabase(dev, "production")).toThrow(
      /NODE_ENV is production/,
    );
  });

  it("refuses a missing or unparseable URL", () => {
    expect(() => assertLocalDevDatabase(undefined, "development")).toThrow(
      /DATABASE_URL is not set/,
    );
    expect(() => assertLocalDevDatabase("not a url", "development")).toThrow(
      /not a valid URL/,
    );
  });

  it("never includes credentials in the refusal message", () => {
    const run = () =>
      assertLocalDevDatabase(
        "postgresql://someuser:S3cretPass@db.example.com:5432/prod",
        "development",
      );
    expect(run).toThrow(/db\.example\.com:5432\/prod/);
    expect(run).not.toThrow(/S3cretPass|someuser/);
  });
});
