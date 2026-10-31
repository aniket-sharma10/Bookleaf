import "server-only";
import type { z } from "zod";

import { ValidationError } from "./errors";

/**
 * Reads and validates a JSON request body. Requiring the JSON content type
 * also means a plain cross-site HTML form can't submit to these endpoints.
 * Schema failures throw a ZodError, which errorResponse maps to 400.
 */
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ValidationError(
      "Expected a JSON request body (Content-Type: application/json).",
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body is not valid JSON.");
  }
  return schema.parse(body);
}

/**
 * Validates the URL's query string. A key that appears once becomes a string,
 * a repeated key (e.g. `?status=OPEN&status=CLOSED`) becomes an array.
 */
export function parseQuery<T extends z.ZodType>(
  url: string | URL,
  schema: T,
): z.infer<T> {
  const params = new URL(url).searchParams;
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0]! : values;
  }
  return schema.parse(query);
}
