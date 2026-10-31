import { z } from "zod";

import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

// Request schemas shared by the forms and the API (TICKET-04, API-02).
// Bodies are strict: an unknown key (e.g. `authorId`, `assigneeId`) is a 400,
// so identity and assignment can never be smuggled in through the body.

export const LIMITS = {
  subject: { min: 3, max: 150 },
  description: { min: 10, max: 5000 },
  /** Admin replies and internal notes. */
  body: { max: 5000 },
  pageSize: { default: 20, max: 100 },
} as const;

/** A record ID: dataset IDs (e.g. a book ID) or generated cuids. */
const recordId = z.string().trim().min(1, "Required.").max(64, "Invalid ID.");

const statusSchema = z.enum(TicketStatus);
const categorySchema = z.enum(TicketCategory);
const prioritySchema = z.enum(TicketPriority);

function text(min: number, max: number, minMessage: string) {
  return z
    .string()
    .trim()
    .min(min, minMessage)
    .max(max, `Keep this under ${max.toLocaleString("en-IN")} characters.`);
}

/** Author: POST /api/author/tickets. `bookId: null` = General / Account Level. */
export const createTicketSchema = z.strictObject({
  bookId: recordId.nullable(),
  subject: text(
    LIMITS.subject.min,
    LIMITS.subject.max,
    `Enter a subject of at least ${LIMITS.subject.min} characters.`,
  ),
  description: text(
    LIMITS.description.min,
    LIMITS.description.max,
    `Describe your query in at least ${LIMITS.description.min} characters.`,
  ),
});

/**
 * Admin: PATCH /api/admin/tickets/:id. `assignToMe` can only be `true` and
 * assigns the caller (MGMT-03); there is no field to assign anyone else.
 */
export const updateTicketSchema = z
  .strictObject({
    status: statusSchema.optional(),
    category: categorySchema.optional(),
    priority: prioritySchema.optional(),
    assignToMe: z.literal(true).optional(),
  })
  .refine((update) => Object.values(update).some((v) => v !== undefined), {
    message: "Provide at least one change.",
  });

/** Admin: POST /api/admin/tickets/:id/messages (an author-visible reply). */
export const createMessageSchema = z.strictObject({
  body: text(1, LIMITS.body.max, "Write a reply before sending."),
  /** Set when the reply started from an AI draft. */
  aiDraftId: recordId.optional(),
  /** Optional new status; otherwise an Open ticket moves to In Progress. */
  status: statusSchema.optional(),
});

/** Admin: POST /api/admin/tickets/:id/notes (never visible to authors). */
export const createNoteSchema = z.strictObject({
  body: text(1, LIMITS.body.max, "Write a note before saving."),
});

/** A query value that may repeat (`?status=OPEN&status=CLOSED`) → array. */
function oneOrMany<T extends z.ZodType>(schema: T) {
  return z
    .union([schema, z.array(schema)])
    .transform((value) => (Array.isArray(value) ? value : [value]));
}

/**
 * Admin: GET /api/admin/tickets query (QUEUE-02, QUEUE-05). Parsed with
 * parseQuery, so values arrive as strings. Unknown parameters are ignored.
 */
export const queueQuerySchema = z
  .object({
    status: oneOrMany(statusSchema).optional(),
    category: categorySchema.optional(),
    priority: prioritySchema.optional(),
    /** Only tickets the AI hasn't classified yet ("Needs triage"). */
    unclassified: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    assignee: z.enum(["me", "none"]).optional(),
    /** Created-date range, inclusive, as YYYY-MM-DD. */
    from: z.iso.date("Use a date like 2026-01-31.").optional(),
    to: z.iso.date("Use a date like 2026-01-31.").optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIMITS.pageSize.max)
      .default(LIMITS.pageSize.default),
  })
  // ISO dates compare correctly as strings.
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "The start date must be on or before the end date.",
    path: ["to"],
  });

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type QueueQuery = z.infer<typeof queueQuerySchema>;
