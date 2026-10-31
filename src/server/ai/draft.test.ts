import { describe, expect, it } from "vitest";

import { personalise } from "./draft";

const SIGN_OFF = "Warm regards,\nBookLeaf Author Support";

describe("personalise", () => {
  it("adds our greeting with the first name and our sign-off", () => {
    expect(personalise("Thanks for writing.", "Meera")).toBe(
      `Dear Meera,\n\nThanks for writing.\n\n${SIGN_OFF}`,
    );
  });

  it("replaces a greeting or sign-off the model added anyway", () => {
    expect(
      personalise(
        "Dear Author,\n\nThanks for writing.\n\nKind regards,\nThe Team",
        "Meera",
      ),
    ).toBe(`Dear Meera,\n\nThanks for writing.\n\n${SIGN_OFF}`);
    expect(personalise("Hi there!\nThanks.", "Meera")).toBe(
      `Dear Meera,\n\nThanks.\n\n${SIGN_OFF}`,
    );
  });

  it("turns a copied [AUTHOR] placeholder into the name, and falls back without one", () => {
    expect(personalise("Yes, [AUTHOR], we will.", "Meera")).toContain(
      "Yes, Meera, we will.",
    );
    expect(personalise("Thanks.", "  ")).toMatch(/^Dear Author,/);
  });

  it("keeps paragraphs that merely mention regards", () => {
    expect(
      personalise("With regards to your ISBN, we will check.", "Meera"),
    ).toContain("With regards to your ISBN, we will check.");
  });
});
