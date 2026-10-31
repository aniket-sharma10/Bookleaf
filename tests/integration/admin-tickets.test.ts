import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  GET as getTicket,
  PATCH as patchTicket,
} from "@/app/api/admin/tickets/[id]/route";
import { POST as postMessage } from "@/app/api/admin/tickets/[id]/messages/route";
import { POST as postNote } from "@/app/api/admin/tickets/[id]/notes/route";
import { GET as listQueue } from "@/app/api/admin/tickets/route";
import { GET as getAuthorTicket } from "@/app/api/author/tickets/[id]/route";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  AdminTicketDetail,
  InternalNote,
  Page,
  QueueTicket,
  SentReply,
} from "@/lib/api-types";
import { seedDataset } from "../../prisma/dataset";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { requestAs, testAuthor } from "../helpers/auth";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Admin ticket APIs against bookleaf_test, synthetic data only.
// A1 owns B1 and B2; A2 owns B3.
const BASE = "http://localhost:3000/api/admin/tickets";
const noParams = { params: Promise.resolve({}) };

let db: PrismaClient;
let me: { id: string; role: "ADMIN"; authorId: null };
let otherAdminId: string;
/** Ticket IDs by fixture name. */
const t: Record<string, string> = {};

type Fixture = {
  name: string;
  createdAt: string;
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  category?:
    | "ROYALTY_PAYMENTS"
    | "ISBN_METADATA"
    | "PRINTING_QUALITY"
    | "DISTRIBUTION_AVAILABILITY"
    | "GENERAL_INQUIRY";
  priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  assignee?: "me" | "other";
  authorId?: string;
};

const FIXTURES: Fixture[] = [
  {
    name: "critical",
    createdAt: "2026-01-05T23:30:00Z",
    category: "ROYALTY_PAYMENTS",
    priority: "CRITICAL",
  },
  {
    name: "highOld",
    createdAt: "2026-01-01T10:00:00Z",
    category: "ISBN_METADATA",
    priority: "HIGH",
  },
  {
    name: "highMine",
    createdAt: "2026-01-03T10:00:00Z",
    status: "IN_PROGRESS",
    category: "PRINTING_QUALITY",
    priority: "HIGH",
    assignee: "me",
    authorId: "A2",
  },
  {
    name: "lowOther",
    createdAt: "2026-01-02T00:00:00Z",
    category: "GENERAL_INQUIRY",
    priority: "LOW",
    assignee: "other",
  },
  { name: "unclassified", createdAt: "2026-01-10T10:00:00Z" },
  {
    name: "noPriority",
    createdAt: "2026-01-07T10:00:00Z",
    category: "GENERAL_INQUIRY",
  },
  {
    name: "resolved",
    createdAt: "2026-01-04T10:00:00Z",
    status: "RESOLVED",
    category: "DISTRIBUTION_AVAILABILITY",
    priority: "MEDIUM",
  },
  {
    name: "closed",
    createdAt: "2026-01-06T10:00:00Z",
    status: "CLOSED",
    category: "GENERAL_INQUIRY",
    priority: "LOW",
  },
];

async function queue(search = ""): Promise<Page<QueueTicket>> {
  const response = await listQueue(
    await requestAs(me, `${BASE}${search}`),
    noParams,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Page<QueueTicket>;
}

/** Fixture names of the queue rows, in order. */
async function names(search = ""): Promise<string[]> {
  const byId = Object.fromEntries(Object.entries(t).map(([k, v]) => [v, k]));
  return (await queue(search)).data.map((row) => byId[row.id]!);
}

beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
  await seedDataset(db, toDataset(edgeCaseRawDataset()));
  const admin = await db.user.create({
    data: {
      email: "me@example.test",
      passwordHash: "x",
      role: "ADMIN",
      name: "Me Admin",
    },
  });
  const other = await db.user.create({
    data: {
      email: "other@example.test",
      passwordHash: "x",
      role: "ADMIN",
      name: "Other Admin",
    },
  });
  me = { id: admin.id, role: "ADMIN", authorId: null };
  otherAdminId = other.id;

  for (const f of FIXTURES) {
    const authorId = f.authorId ?? "A1";
    const ticket = await db.ticket.create({
      data: {
        authorId,
        bookId: authorId === "A1" ? "B1" : "B3",
        subject: `Ticket ${f.name}`,
        description: "Fixture ticket.",
        status: f.status ?? "OPEN",
        category: f.category ?? null,
        priority: f.priority ?? null,
        classificationStatus: f.category && f.priority ? "SUCCEEDED" : "FAILED",
        assigneeId:
          f.assignee === "me"
            ? me.id
            : f.assignee === "other"
              ? otherAdminId
              : null,
        createdAt: new Date(f.createdAt),
      },
    });
    t[f.name] = ticket.id;
  }
});
afterAll(() => db.$disconnect());

describe("GET /api/admin/tickets", () => {
  it("defaults to unresolved tickets: triage first, then Critical → Low, oldest first", async () => {
    expect(await names()).toEqual([
      "noPriority",
      "unclassified",
      "critical",
      "highOld",
      "highMine",
      "lowOther",
    ]);
  });

  it("returns the queue row shape with author, book and assignee", async () => {
    const page = await queue("?priority=HIGH&assignee=me");
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(page.data[0]).toEqual({
      id: t.highMine,
      subject: "Ticket highMine",
      status: "IN_PROGRESS",
      category: "PRINTING_QUALITY",
      priority: "HIGH",
      classificationStatus: "SUCCEEDED",
      author: { id: "A2", name: "Second Author" },
      book: { id: "B3", title: "Café’s Ünusual Notes" },
      assignee: { id: me.id, name: "Me Admin" },
      createdAt: "2026-01-03T10:00:00.000Z",
      updatedAt: expect.any(String),
    });
  });

  it("filters by one or several statuses", async () => {
    expect(await names("?status=RESOLVED")).toEqual(["resolved"]);
    expect(await names("?status=OPEN&status=CLOSED")).toEqual([
      "noPriority",
      "unclassified",
      "critical",
      "highOld",
      "lowOther",
      "closed",
    ]);
  });

  it("filters by category and priority", async () => {
    expect(await names("?category=GENERAL_INQUIRY")).toEqual([
      "noPriority",
      "lowOther",
    ]);
    expect(await names("?priority=HIGH")).toEqual(["highOld", "highMine"]);
  });

  it("filters to tickets that need triage, or to classified ones", async () => {
    expect(await names("?unclassified=true")).toEqual([
      "noPriority",
      "unclassified",
    ]);
    expect(await names("?unclassified=false")).toEqual([
      "critical",
      "highOld",
      "highMine",
      "lowOther",
    ]);
  });

  it("filters by assignee: me or nobody", async () => {
    expect(await names("?assignee=me")).toEqual(["highMine"]);
    expect(await names("?assignee=none")).toEqual([
      "noPriority",
      "unclassified",
      "critical",
      "highOld",
    ]);
  });

  it("filters by created date, including both whole days (UTC)", async () => {
    // 2 Jan 00:00 and 5 Jan 23:30 are inside; 1 Jan and 7 Jan are not.
    expect(await names("?from=2026-01-02&to=2026-01-05")).toEqual([
      "critical",
      "highMine",
      "lowOther",
    ]);
    expect(await names("?from=2026-01-07")).toEqual([
      "noPriority",
      "unclassified",
    ]);
  });

  it("combines filters", async () => {
    expect(await names("?priority=HIGH&assignee=none")).toEqual(["highOld"]);
    expect(
      await names(
        "?status=OPEN&status=CLOSED&category=GENERAL_INQUIRY&priority=LOW&from=2026-01-03",
      ),
    ).toEqual(["closed"]);
  });

  it("paginates with a total", async () => {
    const page = await queue("?pageSize=2&page=2");
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 6 });
    expect(page.data.map((row) => row.id)).toEqual([t.critical, t.highOld]);
    expect((await queue("?pageSize=2&page=9")).data).toEqual([]);
  });

  it("rejects invalid queries with 400 and the offending field", async () => {
    for (const [search, field] of [
      ["?status=DONE", "status"],
      ["?category=nope", "category"],
      ["?pageSize=101", "pageSize"],
      ["?page=0", "page"],
      ["?assignee=someone", "assignee"],
      ["?from=2026-02-01&to=2026-01-01", "to"],
    ] as const) {
      const response = await listQueue(
        await requestAs(me, `${BASE}${search}`),
        noParams,
      );
      expect(response.status, search).toBe(400);
      const { error } = (await response.json()) as {
        error: { details: { path: string }[] };
      };
      expect(
        error.details.map((d) => d.path),
        search,
      ).toContain(field);
    }
  });

  it("refuses authors (403) and anonymous callers (401)", async () => {
    expect(
      (await listQueue(await requestAs(testAuthor, BASE), noParams)).status,
    ).toBe(403);
    expect(
      (await listQueue(await requestAs(null, BASE), noParams)).status,
    ).toBe(401);
  });
});

async function detail(id: string, user: Parameters<typeof requestAs>[0] = me) {
  return getTicket(await requestAs(user, `${BASE}/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/admin/tickets/:id", () => {
  it("returns the ticket with author, book, thread, notes and AI metadata", async () => {
    const id = t.critical!;
    await db.ticket.update({
      where: { id },
      data: {
        aiCategory: "ROYALTY_PAYMENTS",
        aiPriority: "HIGH",
        aiRationale: "Royalty not received for months.",
        classifiedAt: new Date("2026-01-05T23:31:00Z"),
      },
    });
    await db.ticketMessage.create({
      data: { ticketId: id, senderId: me.id, body: "We're looking into it." },
    });
    await db.internalNote.create({
      data: {
        ticketId: id,
        createdById: otherAdminId,
        body: "Check bank details.",
      },
    });

    const response = await detail(id);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: AdminTicketDetail };
    expect(data).toMatchObject({
      id,
      subject: "Ticket critical",
      description: "Fixture ticket.",
      status: "OPEN",
      category: "ROYALTY_PAYMENTS",
      priority: "CRITICAL",
      aiCategory: "ROYALTY_PAYMENTS",
      aiPriority: "HIGH",
      aiRationale: "Royalty not received for months.",
      classificationStatus: "SUCCEEDED",
      classifiedAt: "2026-01-05T23:31:00.000Z",
      createdAt: "2026-01-05T23:30:00.000Z",
      author: {
        id: "A1",
        name: "Example Author",
        email: "author@example.test",
        city: "Example City",
      },
      assignee: null,
      latestDraft: null,
    });
    // The full book record, with calendar dates as YYYY-MM-DD.
    expect(data.book).toMatchObject({
      id: "B1",
      title: "Example Title",
      publicationDate: "2024-02-29",
      royaltyPending: 30,
      lastRoyaltyPayoutDate: null,
    });
    expect(data.messages).toEqual([
      {
        id: expect.any(String),
        body: "We're looking into it.",
        sender: { id: me.id, name: "Me Admin", role: "ADMIN" },
        aiDraftId: null,
        createdAt: expect.any(String),
      },
    ]);
    expect(data.notes).toEqual([
      {
        id: expect.any(String),
        body: "Check bank details.",
        createdBy: { id: otherAdminId, name: "Other Admin" },
        createdAt: expect.any(String),
      },
    ]);
  });

  it("returns book null for a General / Account Level ticket", async () => {
    const general = await db.ticket.create({
      data: { authorId: "A1", subject: "General", description: "No book." },
    });
    const { data } = (await (await detail(general.id)).json()) as {
      data: AdminTicketDetail;
    };
    expect(data.book).toBeNull();
    await db.ticket.delete({ where: { id: general.id } });
  });

  it("answers 404 for an unknown ID and 403 for an author", async () => {
    const missing = await detail("no-such-ticket");
    expect(missing.status).toBe(404);
    expect((await detail(t.critical!, testAuthor)).status).toBe(403);
    expect((await detail(t.critical!, null)).status).toBe(401);
  });
});

describe("PATCH /api/admin/tickets/:id", () => {
  let id: string;
  beforeAll(async () => {
    const ticket = await db.ticket.create({
      data: {
        authorId: "A1",
        bookId: "B1",
        subject: "To be updated",
        description: "Fixture ticket.",
        category: "GENERAL_INQUIRY",
        priority: "LOW",
        aiCategory: "GENERAL_INQUIRY",
        aiPriority: "LOW",
        aiRationale: "Looks like a general question.",
        classificationStatus: "SUCCEEDED",
      },
    });
    id = ticket.id;
  });

  async function patch(
    body: unknown,
    user: Parameters<typeof requestAs>[0] = me,
    ticketId = id,
  ) {
    return patchTicket(
      await requestAs(user, `${BASE}/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: ticketId }) },
    );
  }

  async function dataOf(response: Response) {
    expect(response.status).toBe(200);
    return ((await response.json()) as { data: AdminTicketDetail }).data;
  }

  it("updates the status (MGMT-01)", async () => {
    expect((await dataOf(await patch({ status: "IN_PROGRESS" }))).status).toBe(
      "IN_PROGRESS",
    );
    expect((await dataOf(await patch({ status: "RESOLVED" }))).status).toBe(
      "RESOLVED",
    );
  });

  it("overrides category and priority but keeps the AI's suggestion (AI-03, AI-04)", async () => {
    const data = await dataOf(
      await patch({ category: "ISBN_METADATA", priority: "CRITICAL" }),
    );
    expect(data).toMatchObject({
      category: "ISBN_METADATA",
      priority: "CRITICAL",
      aiCategory: "GENERAL_INQUIRY",
      aiPriority: "LOW",
      aiRationale: "Looks like a general question.",
    });
  });

  it("assigns the ticket to the calling admin only (MGMT-03)", async () => {
    const data = await dataOf(await patch({ assignToMe: true }));
    expect(data.assignee).toEqual({ id: me.id, name: "Me Admin" });
    // Only one field changed; the earlier overrides are untouched.
    expect(data.priority).toBe("CRITICAL");
  });

  it("rejects other assignees, unknown fields, bad values and an empty body (400)", async () => {
    for (const body of [
      { assigneeId: otherAdminId },
      { assignToMe: false },
      { status: "DONE" },
      { priority: null },
      {},
    ]) {
      const response = await patch(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    const stored = await db.ticket.findUniqueOrThrow({ where: { id } });
    expect(stored.assigneeId).toBe(me.id);
  });

  it("answers 404 for an unknown ticket, 403 for an author, 401 without a session", async () => {
    expect((await patch({ status: "OPEN" }, me, "no-such-ticket")).status).toBe(
      404,
    );
    expect((await patch({ status: "OPEN" }, testAuthor)).status).toBe(403);
    expect((await patch({ status: "OPEN" }, null)).status).toBe(401);
  });
});

/** POST helper for the per-ticket admin sub-routes. */
async function postTo(
  handler: typeof postNote,
  ticketId: string,
  body: unknown,
  user: Parameters<typeof requestAs>[0] = me,
) {
  return handler(
    await requestAs(user, `${BASE}/${ticketId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ticketId }) },
  );
}

/** The ticket as its author (A1) sees it, as raw JSON text. */
async function authorViewText(ticketId: string): Promise<string> {
  const response = await getAuthorTicket(
    await requestAs(
      { id: "user-a1", role: "AUTHOR", authorId: "A1" },
      `http://localhost:3000/api/author/tickets/${ticketId}`,
    ),
    { params: Promise.resolve({ id: ticketId }) },
  );
  expect(response.status).toBe(200);
  return response.text();
}

describe("POST /api/admin/tickets/:id/notes", () => {
  it("adds a note that admins see and the author never does (MGMT-02, TICKET-08)", async () => {
    const ticket = await db.ticket.create({
      data: {
        authorId: "A1",
        subject: "Notes",
        description: "Fixture ticket.",
      },
    });
    const before = ticket.updatedAt.toISOString();

    const response = await postTo(postNote, ticket.id, {
      body: "  INTERNAL: author called twice  ",
    });
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: InternalNote };
    expect(data).toEqual({
      id: expect.any(String),
      body: "INTERNAL: author called twice",
      createdBy: { id: me.id, name: "Me Admin" },
      createdAt: expect.any(String),
    });

    const admin = (await (await detail(ticket.id)).json()) as {
      data: AdminTicketDetail;
    };
    expect(admin.data.notes.map((n) => n.body)).toEqual([
      "INTERNAL: author called twice",
    ]);
    // Internal activity doesn't show through the author-visible timestamp.
    expect(admin.data.updatedAt).toBe(before);

    const authorText = await authorViewText(ticket.id);
    expect(authorText).not.toContain("INTERNAL");
    expect(authorText).not.toContain('"notes"');
  });

  it("rejects a blank or oversized body and extra fields (400)", async () => {
    for (const body of [
      { body: "   " },
      { body: "x".repeat(5001) },
      { body: "ok", status: "CLOSED" },
    ]) {
      expect((await postTo(postNote, t.critical!, body)).status).toBe(400);
    }
  });

  it("answers 404 for an unknown ticket and 403 for an author", async () => {
    expect(
      (await postTo(postNote, "no-such-ticket", { body: "x" })).status,
    ).toBe(404);
    expect(
      (await postTo(postNote, t.critical!, { body: "x" }, testAuthor)).status,
    ).toBe(403);
  });
});

describe("POST /api/admin/tickets/:id/messages", () => {
  async function openTicket(status: "OPEN" | "RESOLVED" = "OPEN") {
    return db.ticket.create({
      data: {
        authorId: "A1",
        bookId: "B1",
        subject: "Reply to me",
        description: "Fixture ticket.",
        status,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
  }

  async function reply(ticketId: string, body: unknown) {
    const response = await postTo(postMessage, ticketId, body);
    return { response, json: (await response.json()) as { data: SentReply } };
  }

  it("sends a reply the author sees; Open moves to In Progress (MGMT-05, DRAFT-03)", async () => {
    const ticket = await openTicket();
    const { response, json } = await reply(ticket.id, {
      body: "Thanks, we're on it.",
    });
    expect(response.status).toBe(201);
    expect(json.data).toEqual({
      message: {
        id: expect.any(String),
        body: "Thanks, we're on it.",
        aiDraftId: null,
        sender: { id: me.id, name: "Me Admin", role: "ADMIN" },
        createdAt: expect.any(String),
      },
      status: "IN_PROGRESS",
    });

    const stored = await db.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(stored.status).toBe("IN_PROGRESS");
    // The reply counts as activity on the author's list.
    expect(stored.updatedAt.getTime()).toBeGreaterThan(
      ticket.updatedAt.getTime(),
    );

    const authorText = await authorViewText(ticket.id);
    expect(authorText).toContain("Thanks, we're on it.");
    expect(authorText).toContain('"status":"IN_PROGRESS"');
  });

  it("uses the admin's chosen status, and leaves other statuses alone by default", async () => {
    const chosen = await openTicket();
    expect(
      (await reply(chosen.id, { body: "Done.", status: "RESOLVED" })).json.data
        .status,
    ).toBe("RESOLVED");

    const resolved = await openTicket("RESOLVED");
    expect(
      (await reply(resolved.id, { body: "One more note." })).json.data.status,
    ).toBe("RESOLVED");
  });

  it("links a draft of this ticket, and rejects another ticket's draft without saving anything", async () => {
    const ticket = await openTicket();
    const other = await openTicket();
    const draftFor = (ticketId: string) =>
      db.aiDraft.create({
        data: {
          ticketId,
          body: "Draft body",
          commitments: [],
          needsVerification: [],
          warnings: [],
          model: "test-model",
          promptVersion: "test",
          createdById: me.id,
        },
      });
    const ownDraft = await draftFor(ticket.id);
    const otherDraft = await draftFor(other.id);

    const linked = await reply(ticket.id, {
      body: "Edited draft.",
      aiDraftId: ownDraft.id,
    });
    expect(linked.response.status).toBe(201);
    expect(linked.json.data.message.aiDraftId).toBe(ownDraft.id);

    const fresh = await openTicket();
    const rejected = await postTo(postMessage, fresh.id, {
      body: "Wrong draft.",
      aiDraftId: otherDraft.id,
    });
    expect(rejected.status).toBe(400);
    expect(
      ((await rejected.json()) as { error: { details: unknown } }).error
        .details,
    ).toEqual([
      { path: "aiDraftId", message: "That draft isn't for this ticket." },
    ]);
    expect(
      await db.ticketMessage.count({ where: { ticketId: fresh.id } }),
    ).toBe(0);
    expect(
      (await db.ticket.findUniqueOrThrow({ where: { id: fresh.id } })).status,
    ).toBe("OPEN");
  });

  it("rejects bad bodies (400), unknown tickets (404) and authors (403)", async () => {
    for (const body of [
      { body: "  " },
      { body: "x", status: "DONE" },
      { body: "x", assigneeId: "y" },
    ]) {
      expect((await postTo(postMessage, t.critical!, body)).status).toBe(400);
    }
    expect(
      (await postTo(postMessage, "no-such-ticket", { body: "x" })).status,
    ).toBe(404);
    expect(
      (await postTo(postMessage, t.critical!, { body: "x" }, testAuthor))
        .status,
    ).toBe(403);
  });
});
