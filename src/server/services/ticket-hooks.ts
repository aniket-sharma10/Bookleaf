import "server-only";

import { scheduleBackground } from "@/server/ai/background";
import { classifyTicket } from "@/server/ai/classify";

/**
 * Called after a ticket is stored: schedules AI classification to run after
 * the response, so creation never waits for (or fails because of) the AI
 * (TICKET-05, AI-07). Exactly one classification call per new ticket (AI-08).
 */
export function onTicketCreated(ticketId: string): void {
  scheduleBackground(`classify ticket ${ticketId}`, () =>
    classifyTicket(ticketId),
  );
}
