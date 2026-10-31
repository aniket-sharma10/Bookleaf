import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  AdminTicketDetail,
  InternalNote,
  Page,
  QueueTicket,
} from "@/lib/api-types";
import type {
  CreateNoteInput,
  QueueQuery,
  UpdateTicketInput,
} from "@/lib/schemas/tickets";
import { getDb } from "@/server/db";
import { NotFoundError } from "@/server/http/errors";

import { bookSelect, toAuthorBook } from "./books";

// Admin-facing ticket service. Admins see every author's tickets; access is
// enforced by the routes (withApi access "ADMIN").

/** Open and In Progress: what the queue shows by default (QUEUE-03). */
const UNRESOLVED = ["OPEN", "IN_PROGRESS"] as const;

const queueSelect = {
  id: true,
  subject: true,
  status: true,
  category: true,
  priority: true,
  classificationStatus: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  book: { select: { id: true, title: true } },
  assignee: { select: { id: true, name: true } },
} as const;

/** Start of a `YYYY-MM-DD` day, and of the day after, in UTC. */
function dayRange(day: string): { start: Date; next: Date } {
  const start = new Date(`${day}T00:00:00.000Z`);
  return { start, next: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function queueWhere(
  query: QueueQuery,
  adminId: string,
): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {
    status: { in: query.status ?? [...UNRESOLVED] },
  };
  if (query.category) where.category = query.category;
  if (query.priority) where.priority = query.priority;
  // "Needs triage": no effective category or priority yet (QUEUE-04).
  if (query.unclassified === true) {
    where.OR = [{ category: null }, { priority: null }];
  } else if (query.unclassified === false) {
    where.AND = [{ category: { not: null } }, { priority: { not: null } }];
  }
  if (query.assignee === "me") where.assigneeId = adminId;
  if (query.assignee === "none") where.assigneeId = null;
  // Created-date range, inclusive of both whole days (UTC).
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: dayRange(query.from).start } : {}),
      ...(query.to ? { lt: dayRange(query.to).next } : {}),
    };
  }
  return where;
}

/**
 * The support queue (QUEUE-01 to QUEUE-05). Order: unprioritised tickets
 * first (they need triage), then Critical → Low (the enum's declared order),
 * then oldest first, so the most urgent and longest-waiting are on top.
 */
export async function listQueue(
  query: QueueQuery,
  adminId: string,
): Promise<Page<QueueTicket>> {
  const db = getDb();
  const where = queueWhere(query, adminId);
  const [rows, total] = await db.$transaction([
    db.ticket.findMany({
      where,
      select: queueSelect,
      orderBy: [
        { priority: { sort: "asc", nulls: "first" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.ticket.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

const detailSelect = {
  id: true,
  subject: true,
  description: true,
  status: true,
  category: true,
  priority: true,
  aiCategory: true,
  aiPriority: true,
  aiRationale: true,
  classificationStatus: true,
  classifiedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true, city: true } },
  book: { select: bookSelect },
  assignee: { select: { id: true, name: true } },
  messages: {
    select: {
      id: true,
      body: true,
      aiDraftId: true,
      createdAt: true,
      sender: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  internalNotes: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.TicketSelect;

/** One ticket with its full context for the admin view (QUEUE-01, MGMT-02). */
export async function getTicketForAdmin(
  ticketId: string,
): Promise<AdminTicketDetail> {
  const row = await getDb().ticket.findUnique({
    where: { id: ticketId },
    select: detailSelect,
  });
  if (!row) throw new NotFoundError("Ticket not found.");

  const { internalNotes, messages, book, ...ticket } = row;
  return {
    ...ticket,
    classifiedAt: ticket.classifiedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    book: book ? toAuthorBook(book) : null,
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    notes: internalNotes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    latestDraft: null,
  };
}

/**
 * Admin changes to a ticket (MGMT-01, MGMT-03, AI-03, AI-04). Category and
 * priority overwrite the effective values only; the AI's suggestion fields
 * are never touched, so overrides stay visible. `assignToMe` assigns the
 * calling admin; there is no way to assign anyone else. An unknown ID is a
 * 404 (Prisma P2025).
 */
export async function updateTicket(
  ticketId: string,
  { status, category, priority, assignToMe }: UpdateTicketInput,
  adminId: string,
): Promise<AdminTicketDetail> {
  await getDb().ticket.update({
    where: { id: ticketId },
    data: {
      status,
      category,
      priority,
      ...(assignToMe ? { assigneeId: adminId } : {}),
    },
  });
  return getTicketForAdmin(ticketId);
}

async function assertTicketExists(ticketId: string): Promise<void> {
  const ticket = await getDb().ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw new NotFoundError("Ticket not found.");
}

/**
 * Adds an internal note (MGMT-02). Notes live in their own table that no
 * author query selects. The ticket's updatedAt is deliberately left alone:
 * authors can see it, and internal activity must not show through.
 */
export async function addInternalNote(
  ticketId: string,
  { body }: CreateNoteInput,
  adminId: string,
): Promise<InternalNote> {
  await assertTicketExists(ticketId);
  const note = await getDb().internalNote.create({
    data: { ticketId, createdById: adminId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });
  return { ...note, createdAt: note.createdAt.toISOString() };
}
