import bcrypt from "bcryptjs";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import type { PrismaClient } from "@/generated/prisma/client";
import { AUTH_COOKIE } from "@/server/auth/cookie";
import { TOKEN_TTL_SECONDS, verifyAuthToken } from "@/server/auth/jwt";
import { seedDataset } from "../../prisma/dataset";
import { ADMIN_ACCOUNTS, seedUsers } from "../../prisma/users";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { requestAs, testAuthor } from "../helpers/auth";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Login, logout and me against bookleaf_test, with synthetic accounts only:
// authors A1 (author@example.test) and A2, plus the two seeded admins.
const passwords = {
  authorPassword: "author-pass-123",
  adminPassword: "admin-pass-123",
};
const AUTHOR_EMAIL = "author@example.test";
const ADMIN_EMAIL = ADMIN_ACCOUNTS[0].email;
const BASE = "http://localhost:3000/api/auth";
const noParams = { params: Promise.resolve({}) };

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
  const dataset = toDataset(edgeCaseRawDataset());
  await seedDataset(db, dataset);
  await seedUsers(db, dataset, passwords);
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(() => db.$disconnect());

function loginRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request(`${BASE}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

/** The single Set-Cookie header, split into `name=value` and attributes. */
function setCookieOf(response: Response) {
  const headers = response.headers.getSetCookie();
  expect(headers).toHaveLength(1);
  const [pair, ...attributes] = headers[0]!.split("; ");
  return { pair: pair!, attributes, value: pair!.split("=")[1]! };
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: Record<string, unknown> }).error;
}

describe("POST /api/auth/login", () => {
  it("logs an author in: user in the body, token only in the HttpOnly cookie", async () => {
    const response = await login(
      loginRequest({ email: AUTHOR_EMAIL, password: passwords.authorPassword }),
      noParams,
    );
    expect(response.status).toBe(200);

    const { pair, attributes, value } = setCookieOf(response);
    expect(pair.startsWith(`${AUTH_COOKIE}=`)).toBe(true);
    expect(attributes).toEqual([
      "Path=/",
      `Max-Age=${TOKEN_TTL_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
      // No Secure: NODE_ENV is "test" (production adds it; see cookie.test.ts).
    ]);

    const body = await response.text();
    expect(body).not.toContain(value);
    const { data } = JSON.parse(body) as { data: Record<string, unknown> };
    expect(data).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      role: "AUTHOR",
      authorId: "A1",
    });
    await expect(verifyAuthToken(value)).resolves.toEqual({
      id: data.id,
      role: "AUTHOR",
      authorId: "A1",
    });
  });

  it("logs an admin in, accepting surrounding spaces and any letter case", async () => {
    const response = await login(
      loginRequest({
        email: `  ${ADMIN_EMAIL.toUpperCase()} `,
        password: passwords.adminPassword,
      }),
      noParams,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      role: "ADMIN",
      authorId: null,
      name: ADMIN_ACCOUNTS[0].name,
    });
  });

  it("rejects a wrong password with a generic 401 and no cookie", async () => {
    const response = await login(
      loginRequest({ email: AUTHOR_EMAIL, password: "wrong-password" }),
      noParams,
    );
    expect(response.status).toBe(401);
    expect(await errorOf(response)).toEqual({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password.",
    });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("answers an unknown email exactly like a wrong password, after a real bcrypt compare", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    const response = await login(
      loginRequest({ email: "nobody@example.test", password: "whatever-123" }),
      noParams,
    );
    expect(response.status).toBe(401);
    expect(await errorOf(response)).toEqual({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password.",
    });
    expect(response.headers.getSetCookie()).toEqual([]);
    // The dummy compare keeps timing the same as for a real account.
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0]![1]).toMatch(/^\$2b\$12\$/);
  });

  it("rejects malformed bodies with 400 and field details", async () => {
    const badEmail = await login(
      loginRequest({ email: "not-an-email", password: "x" }),
      noParams,
    );
    expect(badEmail.status).toBe(400);
    expect(await errorOf(badEmail)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ path: "email", message: "Enter a valid email address." }],
    });

    const missingPassword = await login(
      loginRequest({ email: AUTHOR_EMAIL }),
      noParams,
    );
    expect(missingPassword.status).toBe(400);
    expect((await errorOf(missingPassword)).details).toEqual([
      expect.objectContaining({ path: "password" }),
    ]);

    const invalidJson = await login(loginRequest("{not json"), noParams);
    expect(invalidJson.status).toBe(400);

    const notJson = await login(
      loginRequest(`email=${AUTHOR_EMAIL}&password=x`, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      noParams,
    );
    expect(notJson.status).toBe(400);
    expect(notJson.headers.getSetCookie()).toEqual([]);
  });

  it("refuses a cross-origin login", async () => {
    const response = await login(
      loginRequest(
        { email: AUTHOR_EMAIL, password: passwords.authorPassword },
        {
          headers: {
            "content-type": "application/json",
            origin: "https://evil.example",
          },
        },
      ),
      noParams,
    );
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("GET /api/auth/me and POST /api/auth/logout", () => {
  /** Logs in and returns the Cookie header a browser would then send. */
  async function signIn(email: string, password: string): Promise<string> {
    const response = await login(loginRequest({ email, password }), noParams);
    return setCookieOf(response).pair;
  }

  it("me returns the signed-in user's role and authorId", async () => {
    const cookie = await signIn(AUTHOR_EMAIL, passwords.authorPassword);
    const response = await me(
      new Request(`${BASE}/me`, { headers: { cookie } }),
      noParams,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      role: "AUTHOR",
      authorId: "A1",
      name: expect.any(String),
    });

    const adminCookie = await signIn(ADMIN_EMAIL, passwords.adminPassword);
    const asAdmin = await me(
      new Request(`${BASE}/me`, { headers: { cookie: adminCookie } }),
      noParams,
    );
    expect((await asAdmin.json()).data).toMatchObject({
      role: "ADMIN",
      authorId: null,
    });
  });

  it("me returns 401 without a session, or for a user that no longer exists", async () => {
    expect(
      (await me(await requestAs(null, `${BASE}/me`), noParams)).status,
    ).toBe(401);
    // Validly signed, but the user ID isn't in the database.
    expect(
      (await me(await requestAs(testAuthor, `${BASE}/me`), noParams)).status,
    ).toBe(401);
  });

  it("logout clears the cookie, and the browser is then signed out", async () => {
    const cookie = await signIn(AUTHOR_EMAIL, passwords.authorPassword);
    const response = await logout(
      new Request(`${BASE}/logout`, { method: "POST", headers: { cookie } }),
      noParams,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { loggedOut: true } });

    const { pair, attributes } = setCookieOf(response);
    expect(pair).toBe(`${AUTH_COOKIE}=`);
    expect(attributes).toContain("Max-Age=0");
    expect(attributes).toEqual(
      expect.arrayContaining(["Path=/", "HttpOnly", "SameSite=Lax"]),
    );

    // Max-Age=0 makes the browser drop the cookie, so the next call has none.
    const after = await me(new Request(`${BASE}/me`), noParams);
    expect(after.status).toBe(401);
    expect((await errorOf(after)).code).toBe("UNAUTHENTICATED");
  });

  it("logout requires a session", async () => {
    const response = await logout(
      new Request(`${BASE}/logout`, { method: "POST" }),
      noParams,
    );
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
