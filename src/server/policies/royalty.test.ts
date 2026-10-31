import { describe, expect, it } from "vitest";

import { isBelowPayoutThreshold, MIN_PAYOUT_INR } from "./royalty";

describe("isBelowPayoutThreshold", () => {
  it("is true only for a pending amount between ₹1 and ₹999", () => {
    expect(MIN_PAYOUT_INR).toBe(1000);
    expect(isBelowPayoutThreshold(0)).toBe(false);
    expect(isBelowPayoutThreshold(1)).toBe(true);
    expect(isBelowPayoutThreshold(999)).toBe(true);
    expect(isBelowPayoutThreshold(1000)).toBe(false);
    expect(isBelowPayoutThreshold(5400)).toBe(false);
  });
});
