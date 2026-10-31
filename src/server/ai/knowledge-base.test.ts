import { describe, expect, it } from "vitest";

import { TicketCategory } from "@/generated/prisma/enums";

import {
  CATEGORY_GUIDANCE,
  guidanceForCategory,
  KB_SECTIONS,
  sectionsForCategory,
} from "./knowledge-base";

const ids = (category: TicketCategory | null) =>
  sectionsForCategory(category).map((section) => section.id);

const allText = Object.values(KB_SECTIONS)
  .flatMap((section) => section.facts)
  .join("\n");

describe("knowledge base", () => {
  it("keeps every figure from the brief exactly", () => {
    for (const figure of [
      "80% of the net profit",
      "20%",
      "every quarter",
      "within 45 days after the quarter ends",
      "₹1,000",
      "roll over to the next quarter",
      "5–7 business days",
      "7–10 business days",
      "24–48 hours",
      "3–5 business days",
      "48 hours",
    ]) {
      expect(allText, figure).toContain(figure);
    }
  });

  it("always includes company and tone first", () => {
    for (const category of [...Object.values(TicketCategory), null]) {
      expect(ids(category).slice(0, 2)).toEqual(["company", "tone"]);
    }
  });

  it("maps each category to its policy sections", () => {
    expect(ids("ROYALTY_PAYMENTS")).toEqual(["company", "tone", "royalty"]);
    expect(ids("ISBN_METADATA")).toEqual([
      "company",
      "tone",
      "isbn",
      "metadata",
    ]);
    expect(ids("PRINTING_QUALITY")).toEqual(["company", "tone", "printing"]);
    expect(ids("DISTRIBUTION_AVAILABILITY")).toEqual([
      "company",
      "tone",
      "distribution",
      "production",
    ]);
    expect(ids("BOOK_STATUS_PRODUCTION")).toEqual([
      "company",
      "tone",
      "production",
    ]);
  });

  it("gives General inquiries and unclassified tickets every policy section", () => {
    const everything = [
      "company",
      "tone",
      "royalty",
      "isbn",
      "printing",
      "distribution",
      "production",
      "metadata",
    ];
    expect(ids("GENERAL_INQUIRY")).toEqual(everything);
    expect(ids(null)).toEqual(everything);
  });

  it("has handling guidance for every category, and none before classification", () => {
    for (const category of Object.values(TicketCategory)) {
      expect(guidanceForCategory(category).length, category).toBeGreaterThan(0);
    }
    expect(guidanceForCategory(null)).toEqual([]);
  });

  it("keeps the brief's conditions on timelines", () => {
    const royalty = CATEGORY_GUIDANCE.ROYALTY_PAYMENTS.join(" ");
    // 48 hours only for a confirmed overdue payment, never as a blanket promise.
    expect(royalty).toMatch(
      /only a confirmed overdue payment justifies promising resolution within 48 hours/,
    );
    expect(royalty).toMatch(/needsVerification/);
    const production = CATEGORY_GUIDANCE.BOOK_STATUS_PRODUCTION.join(" ");
    expect(production).toMatch(/Don't invent a completion date/);
    expect(CATEGORY_GUIDANCE.PRINTING_QUALITY.join(" ")).toMatch(
      /once the defect is verified, with the reprint taking 5–7 business days/,
    );
    expect(CATEGORY_GUIDANCE.DISTRIBUTION_AVAILABILITY.join(" ")).toMatch(
      /24–48 hours/,
    );
  });

  it("is small: well under the size of a few thousand tokens", () => {
    const everything =
      JSON.stringify(KB_SECTIONS) + JSON.stringify(CATEGORY_GUIDANCE);
    expect(everything.length).toBeLessThan(8_000); // ~2k tokens at most
  });
});
