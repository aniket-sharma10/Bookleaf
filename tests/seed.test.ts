import { describe, expect, it } from "vitest";

import { DatasetError, parseDataset } from "../prisma/dataset";
import {
  author,
  book,
  inProductionBook,
  rawDataset,
} from "./fixtures/synthetic-dataset";

// Unit tests for the dataset parser, using synthetic records only. The
// database side of the seed is covered in tests/db/seed-dataset.test.ts.
function dataset(books: unknown[] = [book(), inProductionBook()]) {
  return rawDataset([author({}, books)]);
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
