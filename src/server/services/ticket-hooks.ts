import "server-only";

/**
 * Called after a ticket is stored. A no-op for now; AI classification is
 * scheduled from here later (T5.4). Callers must not let a failure in here
 * fail ticket creation (TICKET-05).
 */
export function onTicketCreated(ticketId: string): void {
  void ticketId;
}
