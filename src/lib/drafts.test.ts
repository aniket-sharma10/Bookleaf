import { describe, expect, it } from "vitest";

import type { AdminTicketMessage, AiDraft } from "./api-types";
import { shouldAutoDraft, usableDraft } from "./drafts";

const draft: AiDraft = {
  id: "draft-1",
  body: "Dear Example, …",
  commitments: [],
  needsVerification: [],
  model: "fake-model",
  promptVersion: "draft-v2",
  createdAt: "2026-10-31T10:00:00.000Z",
  stale: false,
};

const reply: AdminTicketMessage = {
  id: "message-1",
  body: "Thanks, we're on it.",
  sender: { id: "admin-1", name: "Support Lead", role: "ADMIN" },
  aiDraftId: null,
  createdAt: "2026-10-31T11:00:00.000Z",
};

/** An unanswered Open ticket with no draft yet. */
const fresh: Parameters<typeof shouldAutoDraft>[0] = {
  status: "OPEN",
  messages: [],
  latestDraft: null,
};

describe("shouldAutoDraft", () => {
  it("drafts by itself on the first open of an unanswered Open or In Progress ticket", () => {
    expect(shouldAutoDraft(fresh)).toBe(true);
    expect(shouldAutoDraft({ ...fresh, status: "IN_PROGRESS" })).toBe(true);
  });

  it("doesn't once a draft exists, even a stale one", () => {
    expect(shouldAutoDraft({ ...fresh, latestDraft: draft })).toBe(false);
    expect(
      shouldAutoDraft({
        ...fresh,
        messages: [reply],
        latestDraft: { ...draft, stale: true },
      }),
    ).toBe(false);
  });

  it("doesn't after a reply has been sent, with or without a draft", () => {
    expect(shouldAutoDraft({ ...fresh, messages: [reply] })).toBe(false);
  });

  it("doesn't for Resolved or Closed tickets", () => {
    expect(shouldAutoDraft({ ...fresh, status: "RESOLVED" })).toBe(false);
    expect(shouldAutoDraft({ ...fresh, status: "CLOSED" })).toBe(false);
  });
});

describe("usableDraft", () => {
  it("returns the latest draft unless a message came after it", () => {
    expect(usableDraft({ ...fresh, latestDraft: draft })).toBe(draft);
    expect(
      usableDraft({ ...fresh, latestDraft: { ...draft, stale: true } }),
    ).toBeNull();
    expect(usableDraft(fresh)).toBeNull();
  });
});
