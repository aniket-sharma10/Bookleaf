import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// The post-create hook is where AI classification will be scheduled; mock it
// to check it's called and that a failure there can't fail the request.
vi.mock("@/server/services/ticket-hooks", () => ({ onTicketCreated: vi.fn() }));

import { GET as getTicket } from "@/app/api/author/tickets/[id]/route";
import {
  POST as createTicket,
  GET as listTickets,
} from "@/app/api/author/tickets/route";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthorTicket, AuthorTicketDetail } from "@/lib/api-types";
import { onTicketCreated } from "@/server/services/ticket-hooks";
import { seedDataset } from "../../prisma/dataset";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { requestAs, testAdmin } from "../helpers/auth";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Author ticket APIs against bookleaf_test, synthetic data only.
// A1 owns B1 (published) and B2 (in production); A2 owns B3.
const BASE = "http://localhost:3000/api/author/tickets";
const noParams = { params: Promise.resolve({}) };
const authorA1 = { id: "user-a1", role: "AUTHOR" as const, authorId: "A1" };

const validTicket = {
  bookId: "B1",
  subject: "Royalty not received",
  description: "My royalty for last quarter hasn't arrived yet.",
};

async function postTicket(
  body: unknown,
  user: Parameters<typeof requestAs>[0] = authorA1,
) {
  return createTicket(
    await requestAs(user, BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    noParams,
  );
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: Record<string, unknown> }).error;
}

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
  await seedDataset(db, toDataset(edgeCaseRawDataset()));
});
beforeEach(async () => {
  await db.ticket.deleteMany();
});
afterEach(() => {
  vi.mocked(onTicketCreated).mockReset();
  vi.restoreAllMocks();
});
afterAll(() => db.$disconnect());

describe("POST /api/author/tickets", () => {
  it("creates an Open ticket about the author's own book (201)", async () => {
    const response = await postTicket(validTicket);
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: AuthorTicket };
    expect(data).toEqual({
      id: expect.any(String),
      subject: validTicket.subject,
      description: validTicket.description,
      status: "OPEN",
      book: { id: "B1", title: "Example Title" },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const stored = await db.ticket.findUniqueOrThrow({
      where: { id: data.id },
    });
    expect(stored).toMatchObject({
      authorId: "A1",
      bookId: "B1",
      status: "OPEN",
      classificationStatus: "PENDING",
      category: null,
      priority: null,
      assigneeId: null,
    });
    expect(onTicketCreated).toHaveBeenCalledWith(data.id);
  });

  it("accepts an in-production book and General / Account Level (bookId null)", async () => {
    expect((await postTicket({ ...validTicket, bookId: "B2" })).status).toBe(
      201,
    );
    const general = await postTicket({ ...validTicket, bookId: null });
    expect(general.status).toBe(201);
    expect(((await general.json()) as { data: AuthorTicket }).data.book).toBe(
      null,
    );
  });

  it("rejects another author's book, or an unknown one, with the same field error (AUTH-06)", async () => {
    for (const bookId of ["B3", "NO-SUCH-BOOK"]) {
      const response = await postTicket({ ...validTicket, bookId });
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toEqual({
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
        details: [
          {
            path: "bookId",
            message: "Choose one of your books, or General / Account Level.",
          },
        ],
      });
    }
    expect(await db.ticket.count()).toBe(0);
  });

  it("rejects an empty subject, a short description and unknown fields (400)", async () => {
    const emptySubject = await postTicket({ ...validTicket, subject: "   " });
    expect(emptySubject.status).toBe(400);
    expect((await errorOf(emptySubject)).details).toEqual([
      expect.objectContaining({ path: "subject" }),
    ]);

    const shortDescription = await postTicket({
      ...validTicket,
      description: "Help",
    });
    expect((await errorOf(shortDescription)).details).toEqual([
      expect.objectContaining({ path: "description" }),
    ]);

    // The author comes from the session; a body can't name one.
    expect((await postTicket({ ...validTicket, authorId: "A2" })).status).toBe(
      400,
    );
    expect(await db.ticket.count()).toBe(0);
  });

  it("still creates the ticket when the post-create hook fails (TICKET-05)", async () => {
    vi.mocked(onTicketCreated).mockImplementation(() => {
      throw new Error("AI scheduling unavailable");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postTicket(validTicket);
    expect(response.status).toBe(201);
    expect(await db.ticket.count()).toBe(1);
    expect(logged).toHaveBeenCalled();
  });

  it("refuses admins (403) and anonymous callers (401)", async () => {
    expect((await postTicket(validTicket, testAdmin)).status).toBe(403);
    expect((await postTicket(validTicket, null)).status).toBe(401);
    expect(await db.ticket.count()).toBe(0);
  });
});

describe("GET /api/author/tickets and /api/author/tickets/:id", () => {
  let adminId: string;
  beforeAll(async () => {
    const admin = await db.user.upsert({
      where: { email: "reader-admin@example.test" },
      update: {},
      create: {
        email: "reader-admin@example.test",
        passwordHash: "not-used",
        role: "ADMIN",
        name: "Support Person",
      },
    });
    adminId = admin.id;
  });

  async function list(user: Parameters<typeof requestAs>[0] = authorA1) {
    return listTickets(await requestAs(user, BASE), noParams);
  }

  async function detail(
    id: string,
    user: Parameters<typeof requestAs>[0] = authorA1,
  ) {
    return getTicket(await requestAs(user, `${BASE}/${id}`), {
      params: Promise.resolve({ id }),
    });
  }

  it("lists only the author's tickets, most recently updated first", async () => {
    const older = await db.ticket.create({
      data: {
        authorId: "A1",
        bookId: "B1",
        subject: "Older",
        description: "Older ticket body.",
        createdAt: new Date("2026-01-01T10:00:00Z"),
        updatedAt: new Date("2026-01-01T10:00:00Z"),
      },
    });
    const newer = await db.ticket.create({
      data: {
        authorId: "A1",
        bookId: null,
        subject: "Newer",
        description: "Newer ticket body.",
        status: "IN_PROGRESS",
        createdAt: new Date("2026-01-02T10:00:00Z"),
        updatedAt: new Date("2026-01-03T10:00:00Z"),
      },
    });
    await db.ticket.create({
      data: {
        authorId: "A2",
        bookId: "B3",
        subject: "Someone else's",
        description: "Another author's ticket.",
      },
    });

    const response = await list();
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: AuthorTicket[] };
    expect(data.map((t) => t.id)).toEqual([newer.id, older.id]);
    expect(data[0]).toMatchObject({
      subject: "Newer",
      status: "IN_PROGRESS",
      book: null,
      updatedAt: "2026-01-03T10:00:00.000Z",
    });
    expect(data[1]!.book).toEqual({ id: "B1", title: "Example Title" });
  });

  it("returns an empty list for an author with no tickets", async () => {
    const response = await list();
    expect(((await response.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it("returns the ticket with its replies, oldest first", async () => {
    const ticket = await db.ticket.create({
      data: {
        authorId: "A1",
        bookId: "B1",
        subject: "Where is my royalty?",
        description: "It has been months.",
      },
    });
    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: adminId,
        body: "Second reply",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    });
    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: adminId,
        body: "First reply",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await detail(ticket.id);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: AuthorTicketDetail };
    expect(data).toMatchObject({
      id: ticket.id,
      subject: "Where is my royalty?",
      description: "It has been months.",
      status: "OPEN",
      book: { id: "B1", title: "Example Title" },
    });
    expect(data.messages).toEqual([
      {
        id: expect.any(String),
        body: "First reply",
        sender: { name: "Support Person", role: "ADMIN" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      expect.objectContaining({ body: "Second reply" }),
    ]);
  });

  it("answers 404 for another author's ticket or an unknown ID (AUTH-06)", async () => {
    const theirs = await db.ticket.create({
      data: {
        authorId: "A2",
        bookId: "B3",
        subject: "Private",
        description: "Belongs to A2.",
      },
    });
    for (const id of [theirs.id, "no-such-ticket"]) {
      const response = await detail(id);
      expect(response.status).toBe(404);
      expect((await errorOf(response)).code).toBe("NOT_FOUND");
    }
  });

  it("never exposes notes, drafts, priority, category, AI fields or assignee (TICKET-08)", async () => {
    const ticket = await db.ticket.create({
      data: {
        authorId: "A1",
        bookId: "B1",
        subject: "Visible subject",
        description: "Visible description.",
        category: "ROYALTY_PAYMENTS",
        priority: "CRITICAL",
        aiCategory: "ROYALTY_PAYMENTS",
        aiPriority: "HIGH",
        aiRationale: "SECRET-RATIONALE",
        classificationStatus: "SUCCEEDED",
        classifiedAt: new Date(),
        assigneeId: adminId,
      },
    });
    await db.internalNote.create({
      data: { ticketId: ticket.id, createdById: adminId, body: "SECRET-NOTE" },
    });
    const draft = await db.aiDraft.create({
      data: {
        ticketId: ticket.id,
        body: "SECRET-DRAFT",
        commitments: ["SECRET-COMMITMENT"],
        needsVerification: [],
        warnings: [],
        model: "SECRET-MODEL",
        promptVersion: "v1",
        createdById: adminId,
      },
    });
    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: adminId,
        body: "Visible reply",
        aiDraftId: draft.id,
      },
    });

    const forbiddenKeys = [
      "authorId",
      "priority",
      "category",
      "aiCategory",
      "aiPriority",
      "aiRationale",
      "classificationStatus",
      "classifiedAt",
      "assignee",
      "assigneeId",
      "internalNotes",
      "aiDrafts",
      "aiDraftId",
    ];
    for (const response of [await list(), await detail(ticket.id)]) {
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toMatch(/SECRET-/);
      expect(text).toContain("Visible subject");
      for (const key of forbiddenKeys) {
        expect(text, key).not.toContain(`"${key}"`);
      }
    }
  });

  it("refuses admins (403) and anonymous callers (401)", async () => {
    expect((await list(testAdmin)).status).toBe(403);
    expect((await list(null)).status).toBe(401);
    expect((await detail("any", testAdmin)).status).toBe(403);
    expect((await detail("any", null)).status).toBe(401);
  });
});
