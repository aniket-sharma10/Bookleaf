import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Ticket creation would schedule AI classification; not needed here.
vi.mock("@/server/services/ticket-hooks", () => ({ onTicketCreated: vi.fn() }));

import { POST as retryClassification } from "@/app/api/admin/tickets/[id]/classification/route";
import { POST as postDraft } from "@/app/api/admin/tickets/[id]/drafts/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as createTicket } from "@/app/api/author/tickets/route";
import type { PrismaClient } from "@/generated/prisma/client";
import { RateLimitedError } from "@/server/http/errors";
import {
  clientIp,
  consumeRateLimit,
  RATE_LIMITS,
  type RateLimitRule,
  refundRateLimit,
} from "@/server/http/rate-limit";
import { seedDataset } from "../../prisma/dataset";
import { seedUsers } from "../../prisma/users";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { requestAs, testAdmin, testAuthor } from "../helpers/auth";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Rate limiting (ADR-0009) against bookleaf_test, synthetic accounts only.
const passwords = {
  authorPassword: "author-pass-123",
  adminPassword: "admin-pass-123",
};
const AUTHOR_EMAIL = "author@example.test";
const noParams = { params: Promise.resolve({}) };
const RULE: RateLimitRule = {
  name: "test",
  limit: 3,
  windowSeconds: 60,
  message: (seconds) => `Wait ${seconds}s.`,
};

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
  const dataset = toDataset(edgeCaseRawDataset());
  await seedDataset(db, dataset);
  await seedUsers(db, dataset, passwords);
});
beforeEach(async () => {
  await db.rateLimit.deleteMany();
});
afterAll(() => db.$disconnect());

/** Puts a rule's counter for `subject` at `count`, in the current window. */
function setCount(rule: RateLimitRule, subject: string, count: number) {
  const key = `${rule.name}:${subject}`;
  const windowStart = new Date();
  return db.rateLimit.upsert({
    where: { key },
    create: { key, count, windowStart },
    update: { count, windowStart },
  });
}

async function countOf(rule: RateLimitRule, subject: string) {
  const row = await db.rateLimit.findUnique({
    where: { key: `${rule.name}:${subject}` },
  });
  return row?.count ?? 0;
}

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe("consumeRateLimit", () => {
  it("allows up to the limit, then throws a 429 with the time left", async () => {
    for (let i = 0; i < RULE.limit; i++) {
      await consumeRateLimit(RULE, "subject-a");
    }
    const error = await consumeRateLimit(RULE, "subject-a").catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(RULE.windowSeconds);
    expect(error.message).toBe(`Wait ${error.retryAfterSeconds}s.`);

    // Another subject has its own counter.
    await expect(consumeRateLimit(RULE, "subject-b")).resolves.toBeUndefined();
  });

  it("starts a new window once the old one has ended", async () => {
    await setCount(RULE, "subject-a", RULE.limit);
    await db.rateLimit.update({
      where: { key: "test:subject-a" },
      data: { windowStart: new Date(Date.now() - 61_000) },
    });
    await expect(consumeRateLimit(RULE, "subject-a")).resolves.toBeUndefined();
    expect(await countOf(RULE, "subject-a")).toBe(1);
  });

  it("is atomic: parallel requests can't exceed the limit", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: RULE.limit + 5 }, () =>
        consumeRateLimit(RULE, "subject-a"),
      ),
    );
    const allowed = results.filter((r) => r.status === "fulfilled");
    expect(allowed).toHaveLength(RULE.limit);
  });

  it("refunds one request, never below zero", async () => {
    await setCount(RULE, "subject-a", 2);
    await refundRateLimit(RULE, "subject-a");
    expect(await countOf(RULE, "subject-a")).toBe(1);
    await refundRateLimit(RULE, "subject-a");
    await refundRateLimit(RULE, "subject-a");
    expect(await countOf(RULE, "subject-a")).toBe(0);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry, or 'unknown'", () => {
    const withIp = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(withIp)).toBe("203.0.113.7");
    expect(clientIp(new Request("http://localhost/"))).toBe("unknown");
  });
});

describe("POST /api/auth/login", () => {
  function attempt(password: string, ip: string) {
    return login(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({ email: AUTHOR_EMAIL, password }),
      }),
      noParams,
    );
  }

  it("blocks an IP after 10 failed sign-ins, even with the right password", async () => {
    const ip = "203.0.113.10";
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) {
      expect((await attempt("wrong-password", ip)).status).toBe(401);
    }
    const blocked = await attempt(passwords.authorPassword, ip);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.headers.getSetCookie()).toEqual([]);
    expect(await errorCode(blocked)).toBe("RATE_LIMITED");

    // A different IP is unaffected.
    expect(
      (await attempt(passwords.authorPassword, "203.0.113.11")).status,
    ).toBe(200);
  });

  it("doesn't count successful sign-ins", async () => {
    const ip = "203.0.113.20";
    await setCount(RATE_LIMITS.login, ip, RATE_LIMITS.login.limit - 1);
    expect((await attempt(passwords.authorPassword, ip)).status).toBe(200);
    expect(await countOf(RATE_LIMITS.login, ip)).toBe(
      RATE_LIMITS.login.limit - 1,
    );
  });

  it("doesn't count requests that fail validation", async () => {
    const ip = "203.0.113.30";
    const response = await login(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email: "not-an-email", password: "" }),
      }),
      noParams,
    );
    expect(response.status).toBe(400);
    expect(await countOf(RATE_LIMITS.login, ip)).toBe(0);
  });
});

describe("POST /api/author/tickets", () => {
  async function raise(user: typeof testAuthor) {
    return createTicket(
      await requestAs(user, "http://localhost:3000/api/author/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookId: null,
          subject: "Account question",
          description: "A question about my account settings.",
        }),
      }),
      noParams,
    );
  }

  it("refuses new tickets over the per-author limit, without creating one", async () => {
    await db.ticket.deleteMany();
    const rule = RATE_LIMITS.ticketCreate;
    await setCount(rule, testAuthor.authorId, rule.limit);

    const blocked = await raise(testAuthor);
    expect(blocked.status).toBe(429);
    expect(await errorCode(blocked)).toBe("RATE_LIMITED");
    expect(await db.ticket.count({ where: { authorId: "A1" } })).toBe(0);

    // Another author's limit is separate.
    const other = { ...testAuthor, id: "user-author-2", authorId: "A2" };
    expect((await raise(other)).status).toBe(201);
  });
});

describe("AI endpoints (per admin)", () => {
  const id = "no-such-ticket";
  const context = { params: Promise.resolve({ id }) };
  const url = (path: string) =>
    `http://localhost:3000/api/admin/tickets/${id}/${path}`;

  it("share one limit for drafts and classification retries", async () => {
    const rule = RATE_LIMITS.ai;
    await setCount(rule, testAdmin.id, rule.limit - 1);

    // Under the limit, the request reaches the service (unknown ticket: 404).
    const draft = await postDraft(
      await requestAs(testAdmin, url("drafts"), { method: "POST" }),
      context,
    );
    expect(draft.status).toBe(404);

    // Now over it: both endpoints are refused before any AI call.
    for (const [route, path] of [
      [postDraft, "drafts"],
      [retryClassification, "classification"],
    ] as const) {
      const response = await route(
        await requestAs(testAdmin, url(path), { method: "POST" }),
        context,
      );
      expect(response.status).toBe(429);
      expect(await errorCode(response)).toBe("RATE_LIMITED");
    }
  });
});
