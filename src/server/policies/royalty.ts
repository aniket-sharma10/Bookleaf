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
