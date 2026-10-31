import { describe, expect, it } from "vitest";

import {
  createMessageSchema,
  createNoteSchema,
  createTicketSchema,
  LIMITS,
  queueQuerySchema,
  updateTicketSchema,
} from "./tickets";

/** Field paths of the issues, for compact assertions. */
function issuePaths(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return result.success
    ? []
    : result.error!.issues.map((issue) => issue.path.join("."));
}

const validTicket = {
  bookId: "BK1",
  subject: "Royalty missing",
  description: "My royalty for last quarter hasn't arrived yet.",
};

describe("createTicketSchema", () => {
  it("accepts a valid ticket and trims text", () => {
    const result = createTicketSchema.parse({
      ...validTicket,
      subject: "  Royalty missing  ",
    });
    expect(result.subject).toBe("Royalty missing");
  });

  it("accepts bookId null for General / Account Level, but requires the key", () => {
    expect(
      createTicketSchema.safeParse({ ...validTicket, bookId: null }).success,
    ).toBe(true);
    const withoutBook = {
      subject: validTicket.subject,
      description: validTicket.description,
    };
    expect(issuePaths(createTicketSchema.safeParse(withoutBook))).toEqual([
      "bookId",
    ]);
  });

  it("enforces subject and description limits (after trimming)", () => {
    const cases: [Partial<typeof validTicket>, string][] = [
      [{ subject: "ab" }, "subject"],
      [{ subject: "  ab  " }, "subject"],
      [{ subject: "x".repeat(LIMITS.subject.max + 1) }, "subject"],
      [{ description: "too short" }, "description"],
      [{ description: "x".repeat(LIMITS.description.max + 1) }, "description"],
    ];
    for (const [override, path] of cases) {
      expect(
        issuePaths(
          createTicketSchema.safeParse({ ...validTicket, ...override }),
        ),
      ).toEqual([path]);
    }
    // Exactly at the limits is fine.
    expect(
      createTicketSchema.safeParse({
        ...validTicket,
        subject: "x".repeat(LIMITS.subject.max),
        description: "x".repeat(LIMITS.description.max),
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys such as authorId", () => {
    const result = createTicketSchema.safeParse({
      ...validTicket,
      authorId: "A2",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTicketSchema", () => {
  it("accepts any combination of status, category, priority and assignToMe", () => {
    expect(
      updateTicketSchema.parse({
        status: "RESOLVED",
        category: "ISBN_METADATA",
        priority: "HIGH",
        assignToMe: true,
      }),
    ).toEqual({
      status: "RESOLVED",
      category: "ISBN_METADATA",
      priority: "HIGH",
      assignToMe: true,
    });
  });

  it("rejects an empty update, unknown values and any way to assign others", () => {
    expect(updateTicketSchema.safeParse({}).success).toBe(false);
    expect(updateTicketSchema.safeParse({ status: "DONE" }).success).toBe(
      false,
    );
    expect(updateTicketSchema.safeParse({ assignToMe: false }).success).toBe(
      false,
    );
    expect(
      updateTicketSchema.safeParse({ assigneeId: "someone-else" }).success,
    ).toBe(false);
  });
});

describe("createMessageSchema and createNoteSchema", () => {
  it("require a non-blank body within the limit", () => {
    expect(createMessageSchema.safeParse({ body: "Thanks!" }).success).toBe(
      true,
    );
    expect(issuePaths(createMessageSchema.safeParse({ body: "   " }))).toEqual([
      "body",
    ]);
    expect(
      issuePaths(
        createNoteSchema.safeParse({ body: "x".repeat(LIMITS.body.max + 1) }),
      ),
    ).toEqual(["body"]);
  });

  it("message accepts an optional draft ID and status; note accepts body only", () => {
    expect(
      createMessageSchema.safeParse({
        body: "Reply",
        aiDraftId: "draft1",
        status: "RESOLVED",
      }).success,
    ).toBe(true);
    expect(
      createNoteSchema.safeParse({ body: "Note", status: "OPEN" }).success,
    ).toBe(false);
  });
});

describe("queueQuerySchema", () => {
  it("applies defaults for an empty query", () => {
    expect(queueQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("normalises status to an array and converts strings", () => {
    expect(
      queueQuerySchema.parse({
        status: "OPEN",
        unclassified: "true",
        assignee: "me",
        page: "2",
        pageSize: "50",
      }),
    ).toEqual({
      status: ["OPEN"],
      unclassified: true,
      assignee: "me",
      page: 2,
      pageSize: 50,
    });
    expect(
      queueQuerySchema.parse({ status: ["OPEN", "IN_PROGRESS"] }).status,
    ).toEqual(["OPEN", "IN_PROGRESS"]);
  });

  it("rejects bad values with the offending field", () => {
    expect(issuePaths(queueQuerySchema.safeParse({ status: "DONE" }))).toEqual([
      "status",
    ]);
    expect(issuePaths(queueQuerySchema.safeParse({ pageSize: "101" }))).toEqual(
      ["pageSize"],
    );
    expect(issuePaths(queueQuerySchema.safeParse({ page: "0" }))).toEqual([
      "page",
    ]);
    expect(
      issuePaths(queueQuerySchema.safeParse({ from: "31/01/2026" })),
    ).toEqual(["from"]);
    expect(
      issuePaths(
        queueQuerySchema.safeParse({ from: "2026-02-01", to: "2026-01-31" }),
      ),
    ).toEqual(["to"]);
  });

  it("accepts an inclusive same-day range", () => {
    expect(
      queueQuerySchema.safeParse({ from: "2026-01-31", to: "2026-01-31" })
        .success,
    ).toBe(true);
  });
});
