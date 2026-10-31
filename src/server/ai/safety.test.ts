import { describe, expect, it } from "vitest";

import type { DraftContext } from "./draft-context";
import { checkDraft } from "./safety";

// A small hand-made context, as buildDraftContext would produce it.
const context: DraftContext = {
  category: "ROYALTY_PAYMENTS",
  authorFirstName: "Meera",
  blocks: {
    ticket:
      "Subject: Royalty not received\nDescription:\nNothing paid after 6 months. Email me at [email].",
    previous_replies: "No replies yet.",
    verified_facts: [
      "Title: Monsoon Letters",
      "ISBN: 978-93-5XXXX-01-1",
      "Copies sold: 34",
      "Royalty earned: ₹850",
      "Royalty pending: ₹850",
      "Next royalty payout deadline under the policy: 14 Nov 2026 (for the quarter ending 30 Sept 2026).",
    ].join("\n"),
    knowledge_base: [
      "- The minimum payout is ₹1,000.",
      "- Royalties are calculated every quarter and paid within 45 days after the quarter ends.",
      "- The author receives 80% of the net profit per book; BookLeaf keeps 20%.",
      "- Re-sync takes 24–48 hours. Printing takes 5–7 business days.",
    ].join("\n"),
  },
};

const wrap = (body: string) =>
  `Dear Meera,\n\n${body}\n\nWarm regards,\nBookLeaf Author Support`;

describe("checkDraft", () => {
  it("passes a draft that only uses supplied figures and timelines", () => {
    const reply = wrap(
      "You've sold 34 copies and earned ₹850, which is below the ₹1,000 minimum, so it rolls over. Payouts are made within 45 days of the quarter's end; the next deadline is 14 Nov 2026 for the quarter ending 30 Sept 2026. You receive 80% of net profit. I'll check your payout status and get back to you within 48 hours. ISBN 978-93-5XXXX-01-1 is on record. A reprint takes 5 to 7 business days.",
    );
    expect(checkDraft(reply, context)).toEqual([]);
  });

  it("flags an invented amount and a completed action", () => {
    const warnings = checkDraft(
      wrap("₹5,000 has been credited to your account."),
      context,
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/amount "₹5,000"/);
    expect(warnings[1]).toMatch(
      /"has been credited" says an action already happened/,
    );
  });

  it("flags invented numbers and durations", () => {
    expect(
      checkDraft(wrap("You'll hear from us within 72 hours."), context),
    ).toEqual([expect.stringMatching(/number "72"/)]);
  });

  it("flags links, emails and phone numbers that weren't supplied", () => {
    const warnings = checkDraft(
      wrap(
        "Visit https://bookleaf-payments.example/claim or www.example.org, write to help@bookleaf.example or call +91 98765 43210.",
      ),
      context,
    );
    expect(warnings).toEqual([
      expect.stringMatching(
        /link "https:\/\/bookleaf-payments\.example\/claim"/,
      ),
      expect.stringMatching(/link "www\.example\.org,?"/),
      expect.stringMatching(/email address "help@bookleaf\.example"/),
      expect.stringMatching(/phone number "\+91 98765 43210"/),
    ]);
  });

  it("flags 'already happened' phrasing in its common forms", () => {
    for (const phrase of [
      "We have reprinted your copies.",
      "I've escalated this to production.",
      "Your royalty has already been paid.",
      "The listing was already re-synced.",
    ]) {
      expect(checkDraft(wrap(phrase), context), phrase).toEqual([
        expect.stringMatching(/says an action already happened/),
      ]);
    }
  });

  it("doesn't flag future commitments or ordinary uses of the same words", () => {
    for (const phrase of [
      "I'll escalate this to our production team.",
      "We will arrange a reprint once verified.",
      "Your book has been selling steadily.",
      "Once your payment is processed, you'll see it in your account.",
    ]) {
      expect(checkDraft(wrap(phrase), context), phrase).toEqual([]);
    }
  });

  it("flags calling a payment overdue or late", () => {
    expect(checkDraft(wrap("Your payment is overdue."), context)).toEqual([
      expect.stringMatching(/can't confirm/),
    ]);
  });

  it("flags a leftover privacy placeholder", () => {
    expect(checkDraft(wrap("We'll write to [email] soon."), context)).toEqual([
      expect.stringMatching(/privacy placeholder/),
    ]);
  });
});
