import "server-only";

import type { AuthorTicket, AuthorTicketDetail } from "@/lib/api-types";
import type { CreateTicketInput } from "@/lib/schemas/tickets";
import { getDb } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/http/errors";

import { onTicketCreated } from "./ticket-hooks";

// Author-facing ticket service. Every function takes the authorId from the
// verified session (AUTH-06) and every query filters by it.

/**
 * Explicit select for author responses: no priority, category, AI fields,
 * assignee, notes or drafts (TICKET-08).
 */
export const authorTicketSelect = {
  id: true,
  subject: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  book: { select: { id: true, title: true } },
} as const;

type AuthorTicketRow = {
  id: string;
  subject: string;
  description: string;
  status: AuthorTicket["status"];
  createdAt: Date;
  updatedAt: Date;
  book: { id: string; title: string } | null;
};

export function toAuthorTicket(row: AuthorTicketRow): AuthorTicket {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Creates an Open ticket for the author. A bookId that isn't one of the
 * author's books (or doesn't exist) is a field error, worded the same either
 * way so it doesn't reveal other authors' book IDs.
 */
export async function createTicket(
  authorId: string,
  { bookId, subject, description }: CreateTicketInput,
): Promise<AuthorTicket> {
  const db = getDb();
  if (bookId !== null) {
    const ownBook = await db.book.findFirst({
      where: { id: bookId, authorId },
      select: { id: true },
    });
    if (!ownBook) {
      throw new ValidationError("Invalid request.", [
        {
          path: "bookId",
          message: "Choose one of your books, or General / Account Level.",
        },
      ]);
    }
  }

  const row = await db.ticket.create({
    // status OPEN and classificationStatus PENDING are the schema defaults.
    data: { authorId, bookId, subject, description },
    select: authorTicketSelect,
  });

  // The ticket is already stored: a failing hook (e.g. AI scheduling) is
  // logged, never turned into a failed request (TICKET-05).
  try {
    onTicketCreated(row.id);
  } catch (error) {
    console.error(`Ticket ${row.id}: post-create hook failed:`, error);
  }
  return toAuthorTicket(row);
}

/** The author's tickets, most recently updated first (TICKET-06). */
export async function listTicketsForAuthor(
  authorId: string,
): Promise<AuthorTicket[]> {
  const rows = await getDb().ticket.findMany({
    where: { authorId },
    select: authorTicketSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return rows.map(toAuthorTicket);
}

/**
 * One of the author's tickets with its reply thread (TICKET-07). Another
 * author's ticket is reported as not found, so IDs don't leak (AUTH-06).
 * Messages expose only the body, sender name and role, and time: never the
 * AI draft a reply started from.
 */
export async function getTicketForAuthor(
  authorId: string,
  ticketId: string,
): Promise<AuthorTicketDetail> {
  const row = await getDb().ticket.findFirst({
    where: { id: ticketId, authorId },
    select: {
      ...authorTicketSelect,
      messages: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          sender: { select: { name: true, role: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!row) throw new NotFoundError("Ticket not found.");

  const { messages, ...ticket } = row;
  return {
    ...toAuthorTicket(ticket),
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
