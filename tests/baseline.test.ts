import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";

// Baseline check that the test pipeline works: the "@/*" alias resolves and
// a TSX module (including its CSS import) loads under Vitest.
describe("test setup", () => {
  it("resolves @/ imports and loads app modules", () => {
    expect(metadata.title).toBe("BookLeaf Author Support");
  });
});
