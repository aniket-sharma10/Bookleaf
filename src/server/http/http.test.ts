import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";

import {
  AiUnavailableError,
  ConflictError,
  errorResponse,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "./errors";
import { dataResponse, withApi } from "./handler";
import { parseJson, parseQuery } from "./request";

const BASE = "http://localhost:3000";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("prisma failure", {
    code,
    clientVersion: "test",
  });
}

async function body(response: Response) {
  return (await response.json()) as {
    data?: unknown;
    error?: { code: string; message: string; details?: unknown };
  };
}

afterEach(() => vi.restoreAllMocks());

describe("errorResponse", () => {
  it.each([
    [new ValidationError("Bad input."), 400, "VALIDATION_ERROR"],
    [new UnauthenticatedError(), 401, "UNAUTHENTICATED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError("Ticket not found."), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [new AiUnavailableError(), 503, "AI_UNAVAILABLE"],
  ])("maps %s to its status and code", async (error, status, code) => {
    const response = errorResponse(error);
    expect(response.status).toBe(status);
    expect((await body(response)).error).toEqual({
      code,
      message: error.message,
    });
  });

  it("includes details only when provided", async () => {
    const response = errorResponse(
      new ValidationError("Bad input.", [{ path: "x", message: "m" }]),
    );
    expect((await body(response)).error?.details).toEqual([
      { path: "x", message: "m" },
    ]);
  });

  it("maps a ZodError to 400 with field-level details", async () => {
    const result = z
      .object({
        subject: z.string().min(1),
        book: z.object({ id: z.string() }),
      })
      .safeParse({ subject: "", book: {} });
    const response = errorResponse(result.error);
    const { error } = await body(response);
    expect(response.status).toBe(400);
    expect(error?.code).toBe("VALIDATION_ERROR");
    expect(error?.details).toEqual([
      { path: "subject", message: expect.any(String) },
      { path: "book.id", message: expect.any(String) },
    ]);
  });

  it("maps Prisma not-found (P2025) to 404 and unique violations (P2002) to 409", async () => {
    expect(errorResponse(prismaError("P2025")).status).toBe(404);
    expect((await body(errorResponse(prismaError("P2025")))).error?.code).toBe(
      "NOT_FOUND",
    );
    expect(errorResponse(prismaError("P2002")).status).toBe(409);
  });

  it("logs unexpected errors and returns a generic 500 without internals", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(
      new Error("connection to db.internal:5432 failed for user admin"),
    );
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toMatch(/db\.internal|admin/);
    expect(log).toHaveBeenCalledOnce();
  });

  it("treats other Prisma errors as unexpected (500)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(errorResponse(prismaError("P1001")).status).toBe(500);
  });
});

describe("parseJson", () => {
  const schema = z.object({ subject: z.string().min(1) });
  const post = (body: string, contentType = "application/json") =>
    new Request(`${BASE}/api/x`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });

  it("returns the validated body", async () => {
    await expect(parseJson(post('{"subject":"Hi"}'), schema)).resolves.toEqual({
      subject: "Hi",
    });
    await expect(
      parseJson(
        post('{"subject":"Hi"}', "application/json; charset=utf-8"),
        schema,
      ),
    ).resolves.toEqual({ subject: "Hi" });
  });

  it("rejects a non-JSON content type", async () => {
    await expect(
      parseJson(post("subject=Hi", "text/plain"), schema),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects malformed JSON", async () => {
    await expect(parseJson(post("{oops"), schema)).rejects.toThrow(
      "Request body is not valid JSON.",
    );
  });

  it("throws a ZodError for a body that fails the schema", async () => {
    await expect(
      parseJson(post('{"subject":""}'), schema),
    ).rejects.toBeInstanceOf(z.ZodError);
  });
});

describe("parseQuery", () => {
  const schema = z.object({
    status: z.union([z.string(), z.array(z.string())]).optional(),
    page: z.coerce.number().int().positive().optional(),
  });

  it("keeps single values as strings and repeated keys as arrays", () => {
    expect(parseQuery(`${BASE}/api/x?page=2&status=OPEN`, schema)).toEqual({
      page: 2,
      status: "OPEN",
    });
    expect(
      parseQuery(new URL(`${BASE}/api/x?status=OPEN&status=CLOSED`), schema),
    ).toEqual({ status: ["OPEN", "CLOSED"] });
  });

  it("throws a ZodError for invalid query values", () => {
    expect(() => parseQuery(`${BASE}/api/x?page=-1`, schema)).toThrow(
      z.ZodError,
    );
  });
});

describe("withApi", () => {
  const context = <P extends Record<string, string>>(params: P) => ({
    params: Promise.resolve(params),
  });

  it("passes awaited route params to the handler and returns its response", async () => {
    const route = withApi<{ id: string }>((_request, { params }) =>
      dataResponse({ id: params.id }),
    );
    const response = await route(
      new Request(`${BASE}/api/x/7`),
      context({ id: "7" }),
    );
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ data: { id: "7" } });
  });

  it("turns thrown errors into the error envelope", async () => {
    const route = withApi(() => {
      throw new NotFoundError("Ticket not found.");
    });
    const response = await route(new Request(`${BASE}/api/x`), context({}));
    expect(response.status).toBe(404);
    expect((await body(response)).error).toEqual({
      code: "NOT_FOUND",
      message: "Ticket not found.",
    });
  });

  it("refuses a cross-origin POST with 403 before running the handler", async () => {
    const handler = vi.fn(() => dataResponse("ran"));
    const route = withApi(handler);
    const request = new Request(`${BASE}/api/x`, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    const response = await route(request, context({}));
    expect(response.status).toBe(403);
    expect((await body(response)).error?.code).toBe("FORBIDDEN");
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["PUT", "PATCH", "DELETE"])(
    "refuses a cross-origin %s",
    async (method) => {
      const route = withApi(() => dataResponse("ran"));
      const request = new Request(`${BASE}/api/x`, {
        method,
        headers: { origin: "https://evil.example" },
      });
      expect((await route(request, context({}))).status).toBe(403);
    },
  );

  it("refuses an opaque 'null' origin on mutations", async () => {
    const route = withApi(() => dataResponse("ran"));
    const request = new Request(`${BASE}/api/x`, {
      method: "POST",
      headers: { origin: "null" },
    });
    expect((await route(request, context({}))).status).toBe(403);
  });

  it("allows same-origin and Origin-less mutations, and cross-origin reads", async () => {
    const route = withApi(() => dataResponse("ran"));
    const sameOrigin = new Request(`${BASE}/api/x`, {
      method: "POST",
      headers: { origin: BASE },
    });
    const noOrigin = new Request(`${BASE}/api/x`, { method: "POST" });
    const crossOriginGet = new Request(`${BASE}/api/x`, {
      headers: { origin: "https://evil.example" },
    });
    for (const request of [sameOrigin, noOrigin, crossOriginGet]) {
      expect((await route(request, context({}))).status).toBe(200);
    }
  });
});

describe("dataResponse", () => {
  it("wraps data in the success envelope with the given status", async () => {
    const response = dataResponse({ id: 1 }, 201);
    expect(response.status).toBe(201);
    expect(await body(response)).toEqual({ data: { id: 1 } });
  });
});
