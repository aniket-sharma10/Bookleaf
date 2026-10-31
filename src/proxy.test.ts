import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { authCookie, testAdmin, testAuthor } from "../tests/helpers/auth";
import { AUTH_COOKIE } from "./server/auth/cookie";
import { config, proxy } from "./proxy";

async function visit(path: string, cookie?: string) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const response = await proxy(request);
  return response.headers.get("location");
}

describe("proxy (UX redirects)", () => {
  it("only runs on the portal paths", () => {
    expect(config.matcher).toEqual(["/author/:path*", "/admin/:path*"]);
  });

  it("sends logged-out visitors and invalid cookies to /login", async () => {
    expect(await visit("/author")).toBe("http://localhost:3000/login");
    expect(await visit("/admin/tickets/t1", `${AUTH_COOKIE}=garbage`)).toBe(
      "http://localhost:3000/login",
    );
  });

  it("sends a signed-in user in the other portal to their own", async () => {
    expect(await visit("/admin", await authCookie(testAuthor))).toBe(
      "http://localhost:3000/author",
    );
    expect(await visit("/author/tickets", await authCookie(testAdmin))).toBe(
      "http://localhost:3000/admin",
    );
  });

  it("lets a user through to their own portal", async () => {
    expect(await visit("/author", await authCookie(testAuthor))).toBeNull();
    expect(
      await visit("/admin/tickets/t1", await authCookie(testAdmin)),
    ).toBeNull();
  });
});
