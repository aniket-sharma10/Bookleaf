import "server-only";

import type { AdminUser, AuthorUser, AuthUser } from "@/server/auth/jwt";
import { getUserFromRequest } from "@/server/auth/session";

import { errorResponse, ForbiddenError, UnauthenticatedError } from "./errors";

type RouteParams = Record<string, string | string[]>;

/** Next.js passes route params as a Promise (Next 15+). */
type RouteContext<P extends RouteParams> = { params: Promise<P> };

type Route<P extends RouteParams> = (
  request: Request,
  context: RouteContext<P>,
) => Promise<Response>;

export type ApiHandler<P extends RouteParams, U> = (
  request: Request,
  context: { params: P; user: U },
) => Response | Promise<Response>;

/**
 * Who may call a route. Required on every route, so nothing is public by
 * accident:
 * - PUBLIC: anyone (login only); `user` is null.
 * - AUTHENTICATED: any signed-in user (logout, me).
 * - AUTHOR / ADMIN: that role only; others get 403.
 */
export type Access = "PUBLIC" | "AUTHENTICATED" | "AUTHOR" | "ADMIN";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence in depth (API-05), alongside the SameSite=Lax session cookie.
 * Browsers always send Origin on cross-site requests that change state, so a
 * mismatching Origin is refused. Requests without Origin (curl, server-to-
 * server) can't carry a victim's browser cookies cross-site, so they pass.
 */
function assertSameOrigin(request: Request): void {
  if (!MUTATING_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    throw new ForbiddenError("Cross-origin requests are not allowed.");
  }
}

/** The access check: 401 without a valid session, 403 for the wrong role. */
async function authorize(
  request: Request,
  access: Access,
): Promise<AuthUser | null> {
  if (access === "PUBLIC") return null;
  const user = await getUserFromRequest(request);
  if (!user) throw new UnauthenticatedError();
  if (access !== "AUTHENTICATED" && user.role !== access) {
    throw new ForbiddenError();
  }
  return user;
}

/**
 * Wraps every Route Handler and is the API's security boundary:
 *   1. same-origin check for mutations,
 *   2. authentication and role check (`access`),
 *   3. awaited route params,
 *   4. one place that turns thrown errors into the error envelope.
 * The handler receives `user` typed by access level; for AUTHOR routes
 * `user.authorId` is always present and comes only from the verified token.
 */
export function withApi<P extends RouteParams = Record<string, never>>(
  handler: ApiHandler<P, null>,
  options: { access: "PUBLIC" },
): Route<P>;
export function withApi<P extends RouteParams = Record<string, never>>(
  handler: ApiHandler<P, AuthUser>,
  options: { access: "AUTHENTICATED" },
): Route<P>;
export function withApi<P extends RouteParams = Record<string, never>>(
  handler: ApiHandler<P, AuthorUser>,
  options: { access: "AUTHOR" },
): Route<P>;
export function withApi<P extends RouteParams = Record<string, never>>(
  handler: ApiHandler<P, AdminUser>,
  options: { access: "ADMIN" },
): Route<P>;
export function withApi<P extends RouteParams>(
  // `never`: each overload above pins the exact user type its handler gets.
  handler: ApiHandler<P, never>,
  { access }: { access: Access },
): Route<P> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      const user = await authorize(request, access);
      const params = await context.params;
      // Safe: authorize() returned the user type the overload promised.
      return await handler(request, { params, user: user as never });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Standard success envelope: `{ data }`. */
export function dataResponse(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}
