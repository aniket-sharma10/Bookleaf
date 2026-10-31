// Browser-side client for the app's own `/api/**` routes. Unwraps the
// `{ data }` envelope and turns the `{ error }` envelope into ApiClientError.

import type { Page } from "./api-types";

export type FieldIssue = { path: string; message: string };

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: FieldIssue[],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ErrorEnvelope = {
  error?: { code?: string; message?: string; details?: FieldIssue[] };
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

const NETWORK_ERROR =
  "We can't reach BookLeaf right now. Check your internet connection and try again.";
const UNKNOWN_ERROR = "Something went wrong. Please try again.";

/** Where a signed-out browser is sent; the login page explains why. */
export const SESSION_EXPIRED_URL = "/login?expired=1";

/**
 * A 401 from the API means the session has ended (expired, or signed out in
 * another tab), so send the browser to sign in again. The login request
 * itself is excluded: there a 401 just means wrong credentials.
 */
function redirectToLogin(path: string): void {
  if (typeof window === "undefined" || path.startsWith("/api/auth/login")) {
    return;
  }
  // A full page load on purpose: it drops every cached page and SWR entry from
  // the session that ended, which a client-side router.push would keep.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(SESSION_EXPIRED_URL);
}

/** Sends a request; resolves to the parsed success body, or throws. */
async function send(
  path: string,
  { method = "GET", body }: RequestOptions = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", NETWORK_ERROR);
  }

  // A proxy or crash page may not be JSON; treat that as an unknown error.
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload;
  if (response.status === 401) redirectToLogin(path);

  const error = (payload as ErrorEnvelope | null)?.error;
  throw new ApiClientError(
    response.status,
    error?.code ?? "INTERNAL_ERROR",
    error?.message ?? UNKNOWN_ERROR,
    error?.details,
  );
}

/** Calls the API and returns the `data` of the `{ data }` envelope. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return ((await send(path, options)) as { data: T }).data;
}

/** SWR fetcher: `useSWR<T>("/api/...", fetcher)`. Errors are ApiClientError. */
export function fetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** SWR fetcher for paginated lists: the whole `{ data, page, pageSize, total }`. */
export async function pageFetcher<T>(path: string): Promise<Page<T>> {
  return (await send(path)) as Page<T>;
}
