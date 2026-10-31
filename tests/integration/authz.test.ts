import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { AUTH_COOKIE } from "@/server/auth/cookie";
import {
  type AdminUser,
  type AuthorUser,
  signAuthToken,
  TOKEN_TTL_SECONDS,
} from "@/server/auth/jwt";
import { seedDataset } from "../../prisma/dataset";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Authorization matrix (AUTH-04, AUTH-05): every API route and method, called
// with no session, as an author and as an admin. Every route file must appear
// here; later tasks add their routes (the completeness test enforces it).

type Identity = "anonymous" | "author" | "admin";

type MatrixEntry = {
  /** Route file under src/app/api, without `/route.ts`, e.g. "auth/me". */
  route: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Request URL path; defaults to `/api/<route>`. */
  path?: string;
  /** Route params passed to the handler, for dynamic segments. */
  params?: Record<string, string>;
  /** JSON body for routes that read one. */
  body?: unknown;
  expected: Record<Identity, number>;
};

const MATRIX: MatrixEntry[] = [
  // Login is the only PUBLIC route: an empty body reaches validation (400)
  // whoever calls it, so no session check stands in front of it.
  {
    route: "auth/login",
    method: "POST",
    body: {},
    expected: { anonymous: 400, author: 400, admin: 400 },
  },
  {
    route: "auth/logout",
    method: "POST",
    expected: { anonymous: 401, author: 200, admin: 200 },
  },
  {
    route: "auth/me",
    method: "GET",
    expected: { anonymous: 401, author: 200, admin: 200 },
  },
  {
    route: "author/books",
    method: "GET",
    expected: { anonymous: 401, author: 200, admin: 403 },
  },
];

const API_DIR = resolve(process.cwd(), "src/app/api");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/** Every route file under src/app/api, as "auth/me"-style names. */
function discoverRoutes(): string[] {
  return readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith("route.ts"))
    .map((file) => file.replace(/[\\/]?route\.ts$/, "").replaceAll("\\", "/"))
    .sort();
}

async function loadRoute(route: string): Promise<Record<string, unknown>> {
  return (await import(join(API_DIR, route, "route.ts"))) as Record<
    string,
    unknown
  >;
}

async function call(entry: MatrixEntry, cookie?: string): Promise<number> {
  const handler = (await loadRoute(entry.route))[entry.method] as RouteHandler;
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (entry.body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(
    `http://localhost:3000${entry.path ?? `/api/${entry.route}`}`,
    {
      method: entry.method,
      headers,
      body: entry.body === undefined ? undefined : JSON.stringify(entry.body),
    },
  );
  const response = await handler(request, {
    params: Promise.resolve(entry.params ?? {}),
  });
  return response.status;
}

const sessionCookie = (token: string) => `${AUTH_COOKIE}=${token}`;

let db: PrismaClient;
const cookies: Record<Identity, string | undefined> = {
  anonymous: undefined,
  author: undefined,
  admin: undefined,
};
let badTokens: Record<string, string>;

beforeAll(async () => {
  // Real users, because some routes (e.g. /me) load the signed-in user.
  db = await connectTestDb();
  await truncateAllTables(db);
  await seedDataset(db, toDataset(edgeCaseRawDataset()));
  const authorRow = await db.user.create({
    data: {
      email: "matrix-author@example.test",
      passwordHash: "not-used-in-this-test",
      role: "AUTHOR",
      name: "Matrix Author",
      authorId: "A1",
    },
  });
  const adminRow = await db.user.create({
    data: {
      email: "matrix-admin@example.test",
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
      name: "Matrix Admin",
    },
  });
  const author: AuthorUser = {
    id: authorRow.id,
    role: "AUTHOR",
    authorId: "A1",
  };
  const admin: AdminUser = { id: adminRow.id, role: "ADMIN", authorId: null };
  cookies.author = sessionCookie(await signAuthToken(author));
  cookies.admin = sessionCookie(await signAuthToken(admin));

  // Invalid sessions for a real user: each must count as no session at all.
  const valid = await signAuthToken(admin);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() - (TOKEN_TTL_SECONDS + 60) * 1000);
  const expired = await signAuthToken(admin);
  vi.useRealTimers();
  const wrongSecret = await new SignJWT({ role: "ADMIN", authorId: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuer("bookleaf-portal")
    .setAudience("bookleaf-portal")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("another-secret-of-at-least-32-chars!"));
  badTokens = {
    tampered: `${valid.slice(0, -4)}AAAA`,
    expired,
    "wrong secret": wrongSecret,
  };
});
afterAll(() => db.$disconnect());

describe("authorization matrix", () => {
  it("covers every route file and every method it exports", async () => {
    const exported: string[] = [];
    for (const route of discoverRoutes()) {
      const exports = await loadRoute(route);
      for (const method of HTTP_METHODS) {
        if (typeof exports[method] === "function") {
          exported.push(`${method} ${route}`);
        }
      }
    }
    const inMatrix = MATRIX.map(({ method, route }) => `${method} ${route}`);
    expect(inMatrix.sort()).toEqual(exported.sort());
  });

  for (const entry of MATRIX) {
    describe(`${entry.method} /api/${entry.route}`, () => {
      for (const identity of ["anonymous", "author", "admin"] as const) {
        it(`as ${identity} → ${entry.expected[identity]}`, async () => {
          expect(await call(entry, cookies[identity])).toBe(
            entry.expected[identity],
          );
        });
      }

      // AUTH-04: a tampered, expired or wrongly signed token is no session.
      it("treats invalid tokens exactly like no session", async () => {
        for (const [kind, token] of Object.entries(badTokens)) {
          expect(await call(entry, sessionCookie(token)), `${kind} token`).toBe(
            entry.expected.anonymous,
          );
        }
      });
    });
  }
});
