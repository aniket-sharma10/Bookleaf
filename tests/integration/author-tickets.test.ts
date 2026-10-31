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

import { POST as createTicket } from "@/app/api/author/tickets/route";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthorTicket } from "@/lib/api-types";
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
