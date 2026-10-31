import "server-only";

// Royalty policy facts from the BookLeaf knowledge base, as code, so the UI
// and (later) the AI context use the same deterministic numbers.

/** Accumulated royalties below this roll over to the next quarter. */
export const MIN_PAYOUT_INR = 1000;

/**
 * True when some royalty is pending but not enough to be paid out yet.
 * Nothing pending (0) is not "below the threshold": there is nothing to wait for.
 */
export function isBelowPayoutThreshold(pendingInr: number): boolean {
  return pendingInr > 0 && pendingInr < MIN_PAYOUT_INR;
}

/** Days after a quarter's end within which its royalties are paid (KB). */
export const PAYOUT_DAYS_AFTER_QUARTER = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The last day of the quarter (UTC) that `year`/`quarter` (0–3) denotes. */
function quarterEnd(year: number, quarter: number): Date {
  // Day 0 of the month after the quarter = the quarter's last day.
  return new Date(Date.UTC(year, quarter * 3 + 3, 0));
}

export type PayoutDeadline = {
  /** Last day of the quarter the payout covers, YYYY-MM-DD. */
  quarterEnd: string;
  /** Date by which that quarter's royalties are due, YYYY-MM-DD. */
  deadline: string;
};

/**
 * The next payout deadline on or after `today` (requirements §14.1): 45 days
 * after a quarter's end, which falls on 15 May, 14 Aug, 14 Nov and 14 Feb.
 * Once a deadline has passed, the next quarter's applies. This is the policy
 * deadline only; it says nothing about whether a payment was made.
 */
export function payoutDeadlineFor(today: Date): PayoutDeadline {
  const day = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const year = today.getUTCFullYear();
  // Quarter ends from the previous year to this one, oldest first.
  for (const y of [year - 1, year]) {
    for (let q = 0; q < 4; q++) {
      const end = quarterEnd(y, q);
      const deadline = end.getTime() + PAYOUT_DAYS_AFTER_QUARTER * DAY_MS;
      if (deadline >= day) {
        return {
          quarterEnd: end.toISOString().slice(0, 10),
          deadline: new Date(deadline).toISOString().slice(0, 10),
        };
      }
    }
  }
  // Unreachable: this year's Q4 deadline (14 Feb next year) is always ahead.
  throw new Error("No payout deadline found.");
}

/** Nothing has ever been paid out for this book. */
export function neverPaid(book: {
  royaltyPaid: number;
  lastRoyaltyPayoutDate: string | Date | null;
}): boolean {
  return book.royaltyPaid === 0 && book.lastRoyaltyPayoutDate === null;
}
