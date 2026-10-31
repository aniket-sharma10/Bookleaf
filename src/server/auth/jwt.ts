import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { requireEnv } from "@/server/env";

// Session token (ADR-0002): an HS256 JWT carried only in the HttpOnly session
// cookie. Its payload is readable by whoever holds it, so it carries IDs and
// the role only, never personal data.

export const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours; no refresh, log in again
const ISSUER = "bookleaf-portal";
const AUDIENCE = "bookleaf-portal";
const ALGORITHM = "HS256";

export type AuthUser =
  | { id: string; role: "AUTHOR"; authorId: string }
  | { id: string; role: "ADMIN"; authorId: null };
export type AuthorUser = Extract<AuthUser, { role: "AUTHOR" }>;
export type AdminUser = Extract<AuthUser, { role: "ADMIN" }>;

// An AUTHOR must carry the author it acts for; an ADMIN never does. Anything
// else is rejected, even if correctly signed.
const claimsSchema = z.union([
  z.object({
    sub: z.string().min(1),
    role: z.literal("AUTHOR"),
    authorId: z.string().min(1),
  }),
  z.object({
    sub: z.string().min(1),
    role: z.literal("ADMIN"),
    authorId: z.null(),
  }),
]);

function secretKey(): Uint8Array {
  // Throws if the secret is missing or too short: a misconfigured server must
  // fail loudly, not treat every request as logged out.
  return new TextEncoder().encode(requireEnv("AUTH_JWT_SECRET"));
}

export async function signAuthToken(user: AuthUser): Promise<string> {
  // async, so a missing secret surfaces as a rejected promise, like verify.
  return new SignJWT({ role: user.role, authorId: user.authorId })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Returns the user for a valid token, or null for a missing, malformed,
 * tampered, expired or otherwise invalid one. The algorithm is pinned so a
 * token can't choose how it is checked (e.g. `alg: none`).
 */
export async function verifyAuthToken(
  token: string | undefined,
): Promise<AuthUser | null> {
  if (!token) return null;
  const key = secretKey();
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ["sub", "iat", "exp"],
    }));
  } catch {
    return null;
  }
  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) return null;
  const { sub, role, authorId } = claims.data;
  return role === "AUTHOR"
    ? { id: sub, role, authorId }
    : { id: sub, role, authorId: null };
}
