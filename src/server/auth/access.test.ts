import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authCookie,
  requestAs,
  testAdmin,
  testAuthor,
} from "../../../tests/helpers/auth";

// Page guards call Next's cookies() and redirect(), which only work inside a
// real request; replace them with a fake cookie jar and a throwing redirect.
const next = vi.hoisted(() => {
  class Redirected extends Error {
    constructor(readonly path: string) {
      super(`redirect to ${path}`);
    }
  }
  return { cookie: undefined as string | undefined, Redirected };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "bl_session" && next.cookie !== undefined
        ? { name, value: next.cookie }
        : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new next.Redirected(path);
  },
}));

import { dataResponse, withApi } from "@/server/http/handler";

import { AUTH_COOKIE } from "./cookie";
import { getUserFromCookies, requireUser } from "./guards";
import { signAuthToken, TOKEN_TTL_SECONDS } from "./jwt";
import { getUserFromRequest, readCookie } from "./session";

const noParams = { params: Promise.resolve({}) };

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe("readCookie", () => {
  it("finds one cookie among several, ignoring spacing", () => {
    expect(
      readCookie("theme=dark; bl_session=abc.def.ghi;lang=en", "bl_session"),
    ).toBe("abc.def.ghi");
    expect(readCookie("a=b=c", "a")).toBe("b=c");
  });

  it("returns undefined when the header or cookie is absent", () => {
    expect(readCookie(null, "bl_session")).toBeUndefined();
    expect(readCookie("theme=dark", "bl_session")).toBeUndefined();
    expect(readCookie("xbl_session=1", "bl_session")).toBeUndefined();
  });
});

describe("getUserFromRequest", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the user for a valid session cookie", async () => {
    await expect(
      getUserFromRequest(await requestAs(testAuthor)),
    ).resolves.toEqual(testAuthor);
  });

  it("returns null without a cookie or with a tampered or expired one", async () => {
    await expect(getUserFromRequest(await requestAs(null))).resolves.toBeNull();

    const cookie = await authCookie(testAuthor);
    const tampered = new Request("http://localhost/api/x", {
      headers: { cookie: `${cookie.slice(0, -3)}xyz` },
    });
    await expect(getUserFromRequest(tampered)).resolves.toBeNull();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T09:00:00Z"));
    const old = await requestAs(testAuthor);
    vi.setSystemTime(Date.now() + (TOKEN_TTL_SECONDS + 1) * 1000);
    await expect(getUserFromRequest(old)).resolves.toBeNull();
  });
});

describe("withApi access control", () => {
  const handler = vi.fn((_request: Request, { user }: { user: unknown }) =>
    dataResponse({ user }),
  );
  // Block body: a hook that returns a function is run as teardown by Vitest.
  beforeEach(() => {
    handler.mockClear();
  });

  it("ADMIN route: 401 without a session, 403 for an author, 200 for an admin", async () => {
    const route = withApi(handler, { access: "ADMIN" });

    const anonymous = await route(await requestAs(null), noParams);
    expect(anonymous.status).toBe(401);
    expect(await errorCode(anonymous)).toBe("UNAUTHENTICATED");

    const asAuthor = await route(await requestAs(testAuthor), noParams);
    expect(asAuthor.status).toBe(403);
    expect(await errorCode(asAuthor)).toBe("FORBIDDEN");
    expect(handler).not.toHaveBeenCalled();

    const asAdmin = await route(await requestAs(testAdmin), noParams);
    expect(asAdmin.status).toBe(200);
    expect(await asAdmin.json()).toEqual({ data: { user: testAdmin } });
  });

  it("AUTHOR route: 403 for an admin; the author's authorId comes only from the token", async () => {
    const route = withApi<{ authorId: string }>(
      (_request, { user }) => dataResponse({ authorId: user.authorId }),
      { access: "AUTHOR" },
    );
    const urlParams = { params: Promise.resolve({ authorId: "A2" }) };
    expect((await route(await requestAs(testAdmin), urlParams)).status).toBe(
      403,
    );

    // A different author ID in the URL changes nothing: the token decides.
    const response = await route(
      await requestAs(testAuthor, "http://localhost/api/author/x?authorId=A2"),
      urlParams,
    );
    expect(await response.json()).toEqual({ data: { authorId: "A1" } });
  });

  it("AUTHENTICATED route: any signed-in user, 401 otherwise", async () => {
    const route = withApi(handler, { access: "AUTHENTICATED" });
    expect((await route(await requestAs(testAuthor), noParams)).status).toBe(
      200,
    );
    expect((await route(await requestAs(testAdmin), noParams)).status).toBe(
      200,
    );
    expect((await route(await requestAs(null), noParams)).status).toBe(401);
  });

  it("PUBLIC route: runs without a session and never exposes one", async () => {
    const route = withApi(handler, { access: "PUBLIC" });
    const response = await route(await requestAs(testAdmin), noParams);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { user: null } });
  });

  it("rejects an invalid session cookie with 401", async () => {
    const route = withApi(handler, { access: "AUTHENTICATED" });
    const forged = new Request("http://localhost/api/x", {
      headers: { cookie: `${AUTH_COOKIE}=not.a.token` },
    });
    expect((await route(forged, noParams)).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("still refuses cross-origin mutations from a signed-in user", async () => {
    const route = withApi(handler, { access: "ADMIN" });
    const request = await requestAs(testAdmin, "http://localhost/api/x", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect((await route(request, noParams)).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("page guards", () => {
  afterEach(() => {
    next.cookie = undefined;
  });

  it("getUserFromCookies reads the session cookie", async () => {
    await expect(getUserFromCookies()).resolves.toBeNull();
    next.cookie = await signAuthToken(testAdmin);
    await expect(getUserFromCookies()).resolves.toEqual(testAdmin);
  });

  it("requireUser sends logged-out visitors (or bad cookies) to /login", async () => {
    await expect(requireUser("AUTHOR")).rejects.toMatchObject({
      path: "/login",
    });
    next.cookie = "garbage";
    await expect(requireUser("ADMIN")).rejects.toMatchObject({
      path: "/login",
    });
  });

  it("requireUser sends a user in the wrong portal to their own", async () => {
    next.cookie = await signAuthToken(testAuthor);
    await expect(requireUser("ADMIN")).rejects.toMatchObject({
      path: "/author",
    });
    next.cookie = await signAuthToken(testAdmin);
    await expect(requireUser("AUTHOR")).rejects.toMatchObject({
      path: "/admin",
    });
  });

  it("requireUser returns the user in the right portal", async () => {
    next.cookie = await signAuthToken(testAuthor);
    await expect(requireUser("AUTHOR")).resolves.toEqual(testAuthor);
  });
});
