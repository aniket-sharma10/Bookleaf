// Near-real-time updates by polling (ADR-0003, architecture §7). SWR pauses
// polling while the tab is hidden and refreshes when it regains focus.

export const POLL_MS = {
  /** Author ticket list and detail: an admin reply shows within ~5 s (RT-01). */
  authorTickets: 5_000,
  /** Admin ticket page: replies, notes and status from colleagues. */
  adminTicket: 10_000,
  /** Admin queue: new tickets show within ~15 s (RT-02). */
  adminQueue: 15_000,
} as const;
