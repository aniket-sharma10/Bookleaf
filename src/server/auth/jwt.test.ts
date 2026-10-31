import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = vi.hoisted(() => {
  // Must be set before any module reads the environment.
  const secret = "test-secret-at-least-32-characters-long!!";
  process.env.AUTH_JWT_SECRET = secret;
  return secret;
});

import {
  type AuthUser,
  signAuthToken,
  TOKEN_TTL_SECONDS,
  verifyAuthToken,
} from "./jwt";

const author: AuthUser = { id: "user-1", role: "AUTHOR", authorId: "A1" };
const admin: AuthUser = { id: "user-2", role: "ADMIN", authorId: null };
const key = (secret = SECRET) => new TextEncoder().encode(secret);

/** Builds a token with full control over header and claims. */
function craft(
  claims: Record<string, unknown>,
  {
    alg = "HS256",
    secret = SECRET,
    issuer = "bookleaf-portal",
    audience = "bookleaf-portal",
    exp = "1h" as string | null,
  } = {},
) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt();
  if (exp) jwt.setExpirationTime(exp);
  return jwt.sign(key(secret));
}

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("signAuthToken / verifyAuthToken", () => {
  it("round-trips an author and an admin", async () => {
    await expect(verifyAuthToken(await signAuthToken(author))).resolves.toEqual(
      author,
    );
    await expect(verifyAuthToken(await signAuthToken(admin))).resolves.toEqual(
      admin,
    );
  });

  it("issues an HS256 token with issuer, audience and an 8-hour expiry", async () => {
    // Decode header and payload only; the third part is the signature.
    const [header, payload] = (await signAuthToken(author))
      .split(".")
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, "base64url").toString()));
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload).toMatchObject({
      sub: "user-1",
      role: "AUTHOR",
      authorId: "A1",
      iss: "bookleaf-portal",
      aud: "bookleaf-portal",
    });
    expect(payload.exp - payload.iat).toBe(TOKEN_TTL_SECONDS);
    expect(TOKEN_TTL_SECONDS).toBe(8 * 60 * 60);
    // Only IDs and the role: nothing personal in a readable payload.
    expect(Object.keys(payload).sort()).toEqual(
      ["aud", "authorId", "exp", "iat", "iss", "role", "sub"].sort(),
    );
  });

  it("returns null for a missing, empty or malformed token", async () => {
    await expect(verifyAuthToken(undefined)).resolves.toBeNull();
    await expect(verifyAuthToken("")).resolves.toBeNull();
    await expect(verifyAuthToken("not.a.jwt")).resolves.toBeNull();
  });

  it("rejects a tampered signature or payload", async () => {
    const [header, payload, signature] = (await signAuthToken(author)).split(
      ".",
    );
    const flipped = `${signature!.slice(0, -2)}${signature!.endsWith("AA") ? "BB" : "AA"}`;
    await expect(
      verifyAuthToken(`${header}.${payload}.${flipped}`),
    ).resolves.toBeNull();

    const escalated = base64url({
      ...JSON.parse(Buffer.from(payload!, "base64url").toString()),
      role: "ADMIN",
      authorId: null,
    });
    await expect(
      verifyAuthToken(`${header}.${escalated}.${signature}`),
    ).resolves.toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const forged = await craft(
      { sub: "user-1", role: "ADMIN", authorId: null },
      { secret: "a-different-secret-that-is-32-chars-long!" },
    );
    await expect(verifyAuthToken(forged)).resolves.toBeNull();
  });

  it("rejects alg: none and any algorithm other than HS256", async () => {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
      sub: "user-2",
      role: "ADMIN",
      authorId: null,
      iss: "bookleaf-portal",
      aud: "bookleaf-portal",
      iat: now,
      exp: now + 3600,
    })}.`;
    await expect(verifyAuthToken(unsigned)).resolves.toBeNull();

    const hs512 = await craft(
      { sub: "user-2", role: "ADMIN", authorId: null },
      { alg: "HS512" },
    );
    await expect(verifyAuthToken(hs512)).resolves.toBeNull();
  });

  it("accepts a token until it expires and rejects it afterwards", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const issuedAt = new Date("2026-01-01T09:00:00Z");
    vi.setSystemTime(issuedAt);
    const token = await signAuthToken(author);

    vi.setSystemTime(issuedAt.getTime() + (TOKEN_TTL_SECONDS - 60) * 1000);
    await expect(verifyAuthToken(token)).resolves.toEqual(author);

    vi.setSystemTime(issuedAt.getTime() + (TOKEN_TTL_SECONDS + 1) * 1000);
    await expect(verifyAuthToken(token)).resolves.toBeNull();
  });

  it("rejects a token without an expiry", async () => {
    const noExp = await craft(
      { sub: "user-1", role: "AUTHOR", authorId: "A1" },
      { exp: null },
    );
    await expect(verifyAuthToken(noExp)).resolves.toBeNull();
  });

  it("rejects a wrong issuer or audience", async () => {
    const claims = { sub: "user-1", role: "AUTHOR", authorId: "A1" };
    await expect(
      verifyAuthToken(await craft(claims, { issuer: "someone-else" })),
    ).resolves.toBeNull();
    await expect(
      verifyAuthToken(await craft(claims, { audience: "another-app" })),
    ).resolves.toBeNull();
  });

  it.each([
    ["an unknown role", { sub: "user-1", role: "SUPERUSER", authorId: null }],
    [
      "an AUTHOR without authorId",
      { sub: "user-1", role: "AUTHOR", authorId: null },
    ],
    ["an AUTHOR with authorId missing", { sub: "user-1", role: "AUTHOR" }],
    [
      "an ADMIN with an authorId",
      { sub: "user-2", role: "ADMIN", authorId: "A1" },
    ],
    ["a missing subject", { role: "ADMIN", authorId: null }],
  ])("rejects a correctly signed token with %s", async (_label, claims) => {
    await expect(verifyAuthToken(await craft(claims))).resolves.toBeNull();
  });

  it("fails loudly (not as 'logged out') when the secret is not configured", async () => {
    vi.resetModules();
    vi.stubEnv("AUTH_JWT_SECRET", "");
    const jwt = await import("./jwt");
    await expect(jwt.signAuthToken(author)).rejects.toThrow(
      /Missing required environment variable AUTH_JWT_SECRET/,
    );
    await expect(jwt.verifyAuthToken("any.token.value")).rejects.toThrow(
      /AUTH_JWT_SECRET/,
    );
  });
});
