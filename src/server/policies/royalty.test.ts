import { describe, expect, it } from "vitest";

import {
  isBelowPayoutThreshold,
  MIN_PAYOUT_INR,
  neverPaid,
  payoutDeadlineFor,
} from "./royalty";

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

describe("payoutDeadlineFor", () => {
  const next = (day: string) => payoutDeadlineFor(new Date(`${day}T10:00:00Z`));

  it("gives the deadline 45 days after the latest quarter end", () => {
    expect(next("2026-10-27")).toEqual({
      quarterEnd: "2026-09-30",
      deadline: "2026-11-14",
    });
  });

  it("moves to the next quarter once a deadline has passed", () => {
    expect(next("2026-12-10")).toEqual({
      quarterEnd: "2026-12-31",
      deadline: "2027-02-14",
    });
  });

  it("falls on 15 May, 14 Aug, 14 Nov and 14 Feb, counting the deadline day itself", () => {
    expect(next("2027-02-14").deadline).toBe("2027-02-14");
    expect(next("2027-02-15").deadline).toBe("2027-05-15");
    expect(next("2027-05-16").deadline).toBe("2027-08-14");
    expect(next("2027-08-15").deadline).toBe("2027-11-14");
    expect(next("2027-01-05")).toEqual({
      quarterEnd: "2026-12-31",
      deadline: "2027-02-14",
    });
  });

  it("handles a leap year's February without drifting", () => {
    expect(next("2028-01-10")).toEqual({
      quarterEnd: "2027-12-31",
      deadline: "2028-02-14",
    });
    expect(next("2028-02-20").deadline).toBe("2028-05-15");
  });
});

describe("neverPaid", () => {
  it("is true only when nothing was paid and there is no payout date", () => {
    expect(neverPaid({ royaltyPaid: 0, lastRoyaltyPayoutDate: null })).toBe(
      true,
    );
    expect(
      neverPaid({ royaltyPaid: 0, lastRoyaltyPayoutDate: "2025-11-15" }),
    ).toBe(false);
    expect(neverPaid({ royaltyPaid: 500, lastRoyaltyPayoutDate: null })).toBe(
      false,
    );
  });
});
