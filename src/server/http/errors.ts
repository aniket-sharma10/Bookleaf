import "server-only";
import { ZodError } from "zod";

import { Prisma } from "@/generated/prisma/client";

// Error envelope and status codes: docs/architecture.md §4.
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR";

/** An expected failure that maps directly to an HTTP status and error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Invalid request.", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message = "Authentication required.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You don't have permission to do that.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "This conflicts with existing data.") {
    super(409, "CONFLICT", message);
  }
}

export class AiUnavailableError extends ApiError {
  constructor(
    message = "The AI service is unavailable. Please try again or continue manually.",
  ) {
    super(503, "AI_UNAVAILABLE", message);
  }
}

type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: unknown };
};

function errorJson(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = {
    error:
      details === undefined ? { code, message } : { code, message, details },
  };
  return Response.json(body, { status });
}

/**
 * Converts any thrown value into the standard error response. Expected
 * failures keep their status and message; anything unexpected is logged on
 * the server and returned as a generic 500, so internals never reach clients.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return errorJson(error.status, error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    // Field-level details let forms show messages next to the right input.
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return errorJson(400, "VALIDATION_ERROR", "Invalid request.", details);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025: the record to read/update/delete doesn't exist.
    if (error.code === "P2025") {
      return errorJson(404, "NOT_FOUND", "Not found.");
    }
    // P2002: a unique constraint would be violated.
    if (error.code === "P2002") {
      return errorJson(409, "CONFLICT", "This conflicts with existing data.");
    }
  }
  console.error("Unhandled API error:", error);
  return errorJson(
    500,
    "INTERNAL_ERROR",
    "Something went wrong. Please try again.",
  );
}
