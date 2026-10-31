import "server-only";

import { getEnv } from "@/server/env";

import { TOKEN_TTL_SECONDS } from "./jwt";

export const AUTH_COOKIE = "bl_session";

type CookieOptions = { secure?: boolean };

// HttpOnly: never readable by client JavaScript. SameSite=Lax: not sent on
// cross-site POSTs (CSRF). Secure in production: HTTPS only. Local
// development runs on http://localhost, so Secure is off there.
function sessionCookie(value: string, maxAge: number, secure: boolean): string {
  return [
    `${AUTH_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/** Adds the session cookie to a response (any Response, incl. NextResponse). */
export function setAuthCookie(
  response: Response,
  token: string,
  { secure = isProduction() }: CookieOptions = {},
): void {
  response.headers.append(
    "Set-Cookie",
    sessionCookie(token, TOKEN_TTL_SECONDS, secure),
  );
}

/** Logout: tells the browser to delete the session cookie immediately. */
export function clearAuthCookie(
  response: Response,
  { secure = isProduction() }: CookieOptions = {},
): void {
  response.headers.append("Set-Cookie", sessionCookie("", 0, secure));
}
