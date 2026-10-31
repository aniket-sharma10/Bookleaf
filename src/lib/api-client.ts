// Browser-side client for the app's own `/api/**` routes. Unwraps the
// `{ data }` envelope and turns the `{ error }` envelope into ApiClientError.

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

export async function apiRequest<T>(
  path: string,
  { method = "GET", body }: RequestOptions = {},
): Promise<T> {
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
  if (response.ok) return (payload as { data: T }).data;

  const error = (payload as ErrorEnvelope | null)?.error;
  throw new ApiClientError(
    response.status,
    error?.code ?? "INTERNAL_ERROR",
    error?.message ?? UNKNOWN_ERROR,
    error?.details,
  );
}

/** SWR fetcher: `useSWR<T>("/api/...", fetcher)`. Errors are ApiClientError. */
export function fetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}
