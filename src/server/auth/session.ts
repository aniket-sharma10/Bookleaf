import "server-only";

import { AUTH_COOKIE } from "./cookie";
import { type AuthUser, verifyAuthToken } from "./jwt";

/** Value of one cookie from a raw `Cookie` request header, if present. */
export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

/**
 * The signed-in user for an API request, or null. Reads the session cookie
 * straight from the request headers, so it works in route handlers and in
 * tests without Next's request scope.
 */
export function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  return verifyAuthToken(
    readCookie(request.headers.get("cookie"), AUTH_COOKIE),
  );
}
