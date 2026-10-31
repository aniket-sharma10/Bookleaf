import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Page, QueueTicket } from "@/lib/api-types";
import type { QueueQuery } from "@/lib/schemas/tickets";
import { getDb } from "@/server/db";

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
