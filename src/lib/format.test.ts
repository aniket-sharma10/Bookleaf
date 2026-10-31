import { describe, expect, it } from "vitest";

import {
  EMPTY,
  formatCount,
  formatDate,
  formatDateTime,
  formatInr,
} from "./format";

describe("formatInr", () => {
  it("formats whole rupees with Indian digit grouping", () => {
    expect(formatInr(57744)).toBe("₹57,744");
    expect(formatInr(1234567)).toBe("₹12,34,567");
    expect(formatInr(999)).toBe("₹999");
  });

  it("shows zero as ₹0, not as blank", () => {
    expect(formatInr(0)).toBe("₹0");
  });

  it("renders missing or invalid amounts as the fallback", () => {
    expect(formatInr(null)).toBe("—");
    expect(formatInr(undefined)).toBe(EMPTY);
    expect(formatInr(Number.NaN)).toBe(EMPTY);
    expect(formatInr(null, "Not yet published")).toBe("Not yet published");
  });
});

describe("formatCount", () => {
  it("groups digits the Indian way and is null-safe", () => {
    expect(formatCount(125000)).toBe("1,25,000");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(null)).toBe(EMPTY);
  });
});

describe("formatDate (calendar dates)", () => {
  it("formats an ISO date or a UTC-midnight Date as d Mon yyyy", () => {
    expect(formatDate("2024-03-05")).toBe("5 Mar 2024");
    expect(formatDate(new Date("2024-03-05T00:00:00.000Z"))).toBe("5 Mar 2024");
    // As the API serialises a @db.Date value.
    expect(formatDate("2023-12-31T00:00:00.000Z")).toBe("31 Dec 2023");
  });

  it("renders missing or invalid dates as the fallback, never 'Invalid Date'", () => {
    expect(formatDate(null)).toBe(EMPTY);
    expect(formatDate(undefined)).toBe(EMPTY);
    expect(formatDate("")).toBe(EMPTY);
    expect(formatDate("not a date")).toBe(EMPTY);
    expect(formatDate(null, "No payout yet")).toBe("No payout yet");
  });
});

describe("formatDateTime (timestamps)", () => {
  it("shows the time in IST, labelled", () => {
    expect(formatDateTime("2026-10-31T09:30:00.000Z")).toBe(
      "31 Oct 2026, 3:00 pm IST",
    );
    // Late UTC evening is already the next day in India.
    expect(formatDateTime(new Date("2026-10-31T20:00:00.000Z"))).toBe(
      "1 Nov 2026, 1:30 am IST",
    );
  });

  it("is null-safe", () => {
    expect(formatDateTime(null)).toBe(EMPTY);
    expect(formatDateTime("garbage")).toBe(EMPTY);
  });
});
