// Display formatting shared by the server and the browser (BOOK-06). Every
// helper is null-safe: a missing value renders as "—" (or a given fallback),
// never as "null", "NaN" or "Invalid Date" (BOOK-02).

export const EMPTY = "—";

// Whole rupees (money is stored as integer rupees), Indian digit grouping:
// 1234567 → "₹12,34,567".
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const count = new Intl.NumberFormat("en-IN");

// Dataset dates are calendar dates stored as UTC midnight (`@db.Date`), so
// they are formatted in UTC; any other zone could show the previous day.
const calendarDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Timestamps (ticket activity) use one fixed zone, BookLeaf's (India), so the
// server render and the browser always agree and every user sees the same
// time, labelled "IST".
const timestamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
  timeZoneName: "short",
});

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 57744 → "₹57,744"; 0 → "₹0"; null → fallback. */
export function formatInr(
  amount: number | null | undefined,
  fallback = EMPTY,
): string {
  return isNumber(amount) ? inr.format(amount) : fallback;
}

/** 125000 → "1,25,000"; null → fallback. */
export function formatCount(
  value: number | null | undefined,
  fallback = EMPTY,
): string {
  return isNumber(value) ? count.format(value) : fallback;
}

/** A calendar date: "2024-03-05" → "5 Mar 2024"; null → fallback. */
export function formatDate(value: DateInput, fallback = EMPTY): string {
  const date = toDate(value);
  return date ? calendarDate.format(date) : fallback;
}

/** A moment in time: → "31 Oct 2026, 3:00 pm IST"; null → fallback. */
export function formatDateTime(value: DateInput, fallback = EMPTY): string {
  const date = toDate(value);
  return date ? timestamp.format(date) : fallback;
}
