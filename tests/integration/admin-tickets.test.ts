import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as listQueue } from "@/app/api/admin/tickets/route";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Page, QueueTicket } from "@/lib/api-types";
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
