import type { AdminUser, AuthorUser } from "@/server/auth/jwt";
import { AUTH_COOKIE } from "@/server/auth/cookie";
import { signAuthToken } from "@/server/auth/jwt";

// Auth-cookie factory: builds the `Cookie` header a signed-in browser would
// send, using the real token signing (with the test-only secret).

export const testAuthor: AuthorUser = {
  id: "user-author-1",
  role: "AUTHOR",
  authorId: "A1",
};

export const testAdmin: AdminUser = {
  id: "user-admin-1",
  role: "ADMIN",
  authorId: null,
};

export async function authCookie(
  user: AuthorUser | AdminUser,
): Promise<string> {
  return `${AUTH_COOKIE}=${await signAuthToken(user)}`;
}

/** A request carrying the given user's session cookie (or none). */
export async function requestAs(
  user: AuthorUser | AdminUser | null,
  url = "http://localhost:3000/api/test",
  init: RequestInit = {},
): Promise<Request> {
  const headers = new Headers(init.headers);
  if (user) headers.set("cookie", await authCookie(user));
  return new Request(url, { ...init, headers });
}
