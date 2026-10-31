import type { AdminTicketDetail, AiDraft } from "@/lib/api-types";

type DraftState = Pick<
  AdminTicketDetail,
  "status" | "messages" | "latestDraft"
>;

/** The stored draft the editor can start from: none, if a message came after it. */
export function usableDraft(ticket: DraftState): AiDraft | null {
  return ticket.latestDraft && !ticket.latestDraft.stale
    ? ticket.latestDraft
    : null;
}

/**
 * Whether opening this ticket should request an AI draft by itself
 * (DRAFT-01). Only for the first response: no reply sent yet, no draft
 * generated yet, and the ticket still Open or In Progress. Otherwise the
 * admin asks for one, so reopening a ticket never spends an AI call alone.
 */
export function shouldAutoDraft(ticket: DraftState): boolean {
  return (
    ticket.latestDraft === null &&
    ticket.messages.length === 0 &&
    (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS")
  );
}
