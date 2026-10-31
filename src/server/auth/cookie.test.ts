import { describe, expect, it } from "vitest";

import { AUTH_COOKIE, clearAuthCookie, setAuthCookie } from "./cookie";
import { TOKEN_TTL_SECONDS } from "./jwt";

function cookieOf(response: Response) {
  const [header] = response.headers.getSetCookie();
  const [pair, ...attributes] = header!.split("; ");
  return { pair, attributes };
}

describe("setAuthCookie", () => {
  it("sets an HttpOnly, SameSite=Lax, Secure session cookie in production", () => {
    const response = Response.json({ data: "ok" });
    setAuthCookie(response, "token.value.sig", { secure: true });
    const { pair, attributes } = cookieOf(response);
    expect(pair).toBe(`${AUTH_COOKIE}=token.value.sig`);
    expect(attributes).toEqual([
      "Path=/",
      `Max-Age=${TOKEN_TTL_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
    ]);
  });

  it("omits Secure in development (http://localhost) but keeps the rest", () => {
    const response = Response.json({ data: "ok" });
    setAuthCookie(response, "token.value.sig", { secure: false });
    expect(cookieOf(response).attributes).toEqual([
      "Path=/",
      `Max-Age=${TOKEN_TTL_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
    ]);
  });

  it("decides Secure from NODE_ENV by default (test here, so not Secure)", () => {
    const response = Response.json({ data: "ok" });
    setAuthCookie(response, "token.value.sig");
    expect(cookieOf(response).attributes).not.toContain("Secure");
  });

  it("keeps the response body and other headers intact", async () => {
    const response = Response.json({ data: "ok" });
    setAuthCookie(response, "token.value.sig", { secure: true });
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(await response.json()).toEqual({ data: "ok" });
  });
});

describe("clearAuthCookie", () => {
  it("expires the cookie immediately with the same attributes", () => {
    const response = Response.json({ data: "ok" });
    clearAuthCookie(response, { secure: true });
    const { pair, attributes } = cookieOf(response);
    expect(pair).toBe(`${AUTH_COOKIE}=`);
    expect(attributes).toEqual([
      "Path=/",
      "Max-Age=0",
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
    ]);
  });
});
