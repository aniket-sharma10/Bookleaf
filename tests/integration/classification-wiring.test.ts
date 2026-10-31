import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { StructuredGenerator } from "@/server/ai/provider";

// Ticket creation → background classification, and the admin retry endpoint.
// The AI is a fake; background tasks are collected so tests can await them.
const ai = vi.hoisted(() => ({
  generator: undefined as unknown as StructuredGenerator,
  pending: [] as Promise<unknown>[],
}));
vi.mock("@/server/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/ai/client")>()),
  getGenerator: () => ai.generator,
}));
vi.mock("@/server/ai/background", () => ({
  scheduleBackground: (_name: string, task: () => Promise<unknown>) => {
    ai.pending.push(task());
  },
}));

import { POST as retry } from "@/app/api/admin/tickets/[id]/classification/route";
import { POST as createTicket } from "@/app/api/author/tickets/route";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AdminTicketDetail, AuthorTicket } from "@/lib/api-types";
import { seedDataset } from "../../prisma/dataset";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { requestAs, testAdmin, testAuthor } from "../helpers/auth";
import { fakeGenerator } from "../helpers/fake-ai";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

const SUGGESTION = {
  category: "ISBN_METADATA",
  priority: "HIGH",
  rationale: "ISBN differs between store and print.",
};
const authorA1 = { id: "user-a1", role: "AUTHOR" as const, authorId: "A1" };

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
  await seedDataset(db, toDataset(edgeCaseRawDataset()));
});
beforeEach(async () => {
  ai.pending = [];
  await db.aiCallLog.deleteMany();
  await db.ticket.deleteMany();
});
afterAll(() => db.$disconnect());

async function raiseTicket(): Promise<{ status: number; id: string }> {
  const response = await createTicket(
    await requestAs(authorA1, "http://localhost:3000/api/author/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: "B1",
        subject: "Wrong ISBN on the store",
        description: "The store page shows a different ISBN from my copies.",
      }),
    }),
    { params: Promise.resolve({}) },
  );
  const { data } = (await response.json()) as { data: AuthorTicket };
  return { status: response.status, id: data.id };
}

async function retryAs(user: Parameters<typeof requestAs>[0], id: string) {
  return retry(
    await requestAs(
      user,
      `http://localhost:3000/api/admin/tickets/${id}/classification`,
      {
        method: "POST",
      },
    ),
    { params: Promise.resolve({ id }) },
  );
}

describe("classification on ticket creation", () => {
  it("returns 201 first, then classifies in the background with exactly one AI call", async () => {
    ai.generator = fakeGenerator({ data: SUGGESTION });
    const { status, id } = await raiseTicket();
    expect(status).toBe(201);

    await Promise.all(ai.pending);
    expect(ai.pending).toHaveLength(1);
    expect(
      (ai.generator as ReturnType<typeof fakeGenerator>).calls,
    ).toHaveLength(1);
    expect(await db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      classificationStatus: "SUCCEEDED",
      category: "ISBN_METADATA",
      priority: "HIGH",
    });
  });

  it("still creates the ticket when the AI fails, leaving it for triage (TICKET-05, AI-07)", async () => {
    ai.generator = fakeGenerator("RATE_LIMITED");
    const { status, id } = await raiseTicket();
    expect(status).toBe(201);
    await Promise.all(ai.pending);
    expect(await db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "OPEN",
      classificationStatus: "FAILED",
      category: null,
      priority: null,
    });
    expect((await db.aiCallLog.findFirstOrThrow()).outcome).toBe(
      "RATE_LIMITED",
    );
  });
});

describe("POST /api/admin/tickets/:id/classification", () => {
  it("classifies a failed ticket now and returns the updated ticket", async () => {
    ai.generator = fakeGenerator("TIMEOUT");
    const { id } = await raiseTicket();
    await Promise.all(ai.pending);

    ai.generator = fakeGenerator({ data: SUGGESTION });
    const response = await retryAs(testAdmin, id);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: AdminTicketDetail };
    expect(data).toMatchObject({
      id,
      classificationStatus: "SUCCEEDED",
      category: "ISBN_METADATA",
      priority: "HIGH",
      aiCategory: "ISBN_METADATA",
      aiRationale: SUGGESTION.rationale,
    });
  });

  it("keeps an admin's category and priority when retried", async () => {
    ai.generator = fakeGenerator("DISABLED");
    const { id } = await raiseTicket();
    await Promise.all(ai.pending);
    await db.ticket.update({
      where: { id },
      data: { category: "GENERAL_INQUIRY", priority: "LOW" },
    });

    ai.generator = fakeGenerator({ data: SUGGESTION });
    const { data } = (await (await retryAs(testAdmin, id)).json()) as {
      data: AdminTicketDetail;
    };
    expect(data).toMatchObject({
      category: "GENERAL_INQUIRY",
      priority: "LOW",
      aiCategory: "ISBN_METADATA",
      aiPriority: "HIGH",
    });
  });

  it("answers 503 AI_UNAVAILABLE with an actionable message when the AI fails", async () => {
    ai.generator = fakeGenerator("RATE_LIMITED");
    const { id } = await raiseTicket();
    await Promise.all(ai.pending);

    const response = await retryAs(testAdmin, id);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "AI_UNAVAILABLE",
        message:
          "The AI service is busy right now. Try again in a minute, or continue manually.",
      },
    });
    expect(
      (await db.ticket.findUniqueOrThrow({ where: { id } }))
        .classificationStatus,
    ).toBe("FAILED");
  });

  it("answers 404 for an unknown ticket and 403 for an author", async () => {
    ai.generator = fakeGenerator({ data: SUGGESTION });
    expect((await retryAs(testAdmin, "no-such-ticket")).status).toBe(404);
    expect((await retryAs(testAuthor, "any")).status).toBe(403);
    expect((await retryAs(null, "any")).status).toBe(401);
  });
});
