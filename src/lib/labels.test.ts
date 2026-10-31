import { describe, expect, it } from "vitest";

import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "./labels";

describe("labels", () => {
  it("label every enum value, with the wording from requirements §11", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual(
      Object.values(TicketCategory).sort(),
    );
    expect(Object.keys(PRIORITY_LABELS).sort()).toEqual(
      Object.values(TicketPriority).sort(),
    );
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(
      Object.values(TicketStatus).sort(),
    );
    expect(CATEGORY_LABELS.ISBN_METADATA).toBe("ISBN & Metadata Issues");
    expect(STATUS_LABELS.IN_PROGRESS).toBe("In Progress");
  });
});
