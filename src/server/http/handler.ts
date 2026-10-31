import "server-only";

import { errorResponse, ForbiddenError } from "./errors";

type RouteParams = Record<string, string | string[]>;

/** Next.js passes route params as a Promise (Next 15+). */
type RouteContext<P extends RouteParams> = { params: Promise<P> };

export type ApiHandler<P extends RouteParams> = (
  request: Request,
  context: { params: P },
) => Response | Promise<Response>;

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

/**
 * Wraps every Route Handler: same-origin check for mutations, awaited route
 * params, and one place that turns thrown errors into the standard error
 * response. Role-based authentication is added here in T2.4.
 */
export function withApi<P extends RouteParams = Record<string, never>>(
  handler: ApiHandler<P>,
) {
  return async (
    request: Request,
    context: RouteContext<P>,
  ): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const params = await context.params;
      return await handler(request, { params });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Standard success envelope: `{ data }`. */
export function dataResponse(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}
