import { describe, expect, it } from "vitest";

import { isInProduction, productionStage } from "./books";

describe("book status helpers", () => {
  it("recognise in-production statuses and their stage", () => {
    expect(isInProduction("In Production - Cover Design")).toBe(true);
    expect(productionStage("In Production - Cover Design")).toBe(
      "Cover Design",
    );
    expect(productionStage("In Production - Typesetting")).toBe("Typesetting");
    expect(productionStage("In Production")).toBeNull();
  });

  it("treat other statuses as published (no stage)", () => {
    expect(isInProduction("Published & Live")).toBe(false);
    expect(productionStage("Published & Live")).toBeNull();
  });
});
