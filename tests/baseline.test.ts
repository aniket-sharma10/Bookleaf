import { describe, expect, it, vi } from "vitest";

// next/font is compiled by Next's build, not Vitest; stub the font loaders.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: {} });
  return { Geist: font, Source_Serif_4: font };
});

import { metadata } from "@/app/layout";

// Baseline check that the test pipeline works: the "@/*" alias resolves and
// a TSX module (including its CSS import) loads under Vitest.
describe("test setup", () => {
  it("resolves @/ imports and loads app modules", () => {
    expect(metadata.title).toEqual({
      default: "BookLeaf Author Support",
      template: "%s · BookLeaf Author Support",
    });
  });
});
