import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiRequest, SESSION_EXPIRED_URL } from "./api-client";

// The browser API client with a stubbed fetch and window.location.

const assign = vi.fn();

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("window", { location: { assign } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("returns the data of a successful response", async () => {
    respond(200, { data: { ok: true } });
    await expect(apiRequest("/api/author/tickets")).resolves.toEqual({
      ok: true,
    });
  });

  it("sends a signed-out browser to /login when any API call returns 401", async () => {
    respond(401, {
      error: { code: "UNAUTHENTICATED", message: "Authentication required." },
    });
    await expect(apiRequest("/api/author/tickets")).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(assign).toHaveBeenCalledWith(SESSION_EXPIRED_URL);
  });

  it("doesn't redirect for a failed login (wrong credentials)", async () => {
    respond(401, {
      error: { code: "UNAUTHENTICATED", message: "Invalid email or password." },
    });
    await expect(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: "a@b.c", password: "x" },
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password.",
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("turns other errors into ApiClientError without redirecting", async () => {
    respond(503, { error: { code: "AI_UNAVAILABLE", message: "AI is busy." } });
    await expect(
      apiRequest("/api/admin/tickets/t1/drafts", { method: "POST" }),
    ).rejects.toMatchObject({
      status: 503,
      code: "AI_UNAVAILABLE",
      message: "AI is busy.",
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("reports a network failure as NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(apiRequest("/api/author/books")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });
});
