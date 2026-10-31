import "server-only";

import type { TicketCategory } from "@/generated/prisma/enums";

// BookLeaf's knowledge base as a small structured module (requirements §14).
// Facts are summarised in our own words, never copied from the brief, and no
// policy is added. Retrieval is a fixed category → section map: the whole KB
// is about 1k tokens, so no embeddings or search are needed.
//
// Every figure here was checked against the brief: 80/20 of net profit;
// quarterly, paid within 45 days of quarter end; ₹1,000 minimum with
// roll-over; printing 5–7 business days; new listings 7–10 business days;
// re-sync 24–48 hours; listing changes 3–5 business days; 48 hours as the
// investigation example.

export type KbSectionId =
  | "company"
  | "tone"
  | "royalty"
  | "isbn"
  | "printing"
  | "distribution"
  | "production"
  | "metadata";

export type KbSection = { id: KbSectionId; title: string; facts: string[] };

export const KB_SECTIONS: Record<KbSectionId, KbSection> = {
  company: {
    id: "company",
    title: "About BookLeaf",
    facts: [
      "BookLeaf Publishing is a self-publishing company working with authors in India and the US.",
      "Two packages: Standard Free, with nothing to pay upfront, and the paid Bestseller Breakthrough, which adds marketing and distribution extras.",
      "BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.",
      "Printing and warehousing are in-house in Delhi; print partners are Repro India and Epitome Books.",
    ],
  },
  tone: {
    id: "tone",
    title: "How BookLeaf writes to authors",
    facts: [
      "Be empathetic and professional: authors are partners, not customers to be managed.",
      "Acknowledge the author's concern before offering solutions.",
      "Be specific: use the actual numbers, dates and statuses provided, not vague reassurance.",
      "If something is BookLeaf's fault (such as a delayed royalty or an ISBN error), own it directly without deflecting.",
      "When something needs escalation or investigation, give a clear timeline instead of an open-ended promise (for example, getting back to the author within 48 hours).",
      "Finish every reply by saying what happens next, for the author, for BookLeaf, or for both.",
    ],
  },
  royalty: {
    id: "royalty",
    title: "Royalties",
    facts: [
      "Royalty split: the author receives 80% of the net profit per book; BookLeaf keeps 20%.",
      "Net profit is the MRP less the printing cost, the platform's commission (e.g. Amazon, Flipkart) and shipping.",
      "Royalties are calculated every quarter and paid within 45 days after the quarter ends.",
      "The minimum payout is ₹1,000. If an author's accumulated royalties are below that, they roll over to the next quarter.",
      "Payouts are made by bank transfer to the bank account linked in the author's dashboard.",
      "In their dashboard, authors can see a detailed royalty breakdown with sales per platform.",
    ],
  },
  isbn: {
    id: "isbn",
    title: "ISBNs",
    facts: [
      "Every book published with BookLeaf gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.",
      "An author who wants an ISBN under their own imprint has to obtain it themselves.",
      "Reported ISBN errors (a duplicate ISBN, or an ISBN linked to the wrong book) are high priority and are escalated to the production team.",
    ],
  },
  printing: {
    id: "printing",
    title: "Printing and quality",
    facts: [
      "Most orders are printed in-house; overflow or special formats go to Repro India or Epitome Books.",
      "Standard print turnaround is 5–7 business days from order confirmation.",
      "For a reported quality problem (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verifying it; the author may be asked for photos of the defective copy.",
    ],
  },
  distribution: {
    id: "distribution",
    title: "Distribution and availability",
    facts: [
      "Books are sold on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.",
      "A newly published book typically appears on the platforms 7–10 business days after publication finishes.",
      "A book listed as unavailable is usually caused by a stock sync problem; BookLeaf can request a re-sync, which takes 24–48 hours.",
    ],
  },
  production: {
    id: "production",
    title: "Production stages",
    facts: [
      "Stages, in order: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.",
      "Authors receive an email update at each stage.",
      "Delays most often happen at Cover Design (waiting for the author's approval) and Proofreading (revision rounds).",
    ],
  },
  metadata: {
    id: "metadata",
    title: "Listing (metadata) changes",
    facts: [
      "Once a book is live, changes to its listing (such as the description) can be requested via the dashboard or by email to the BookLeaf team.",
      "Such changes usually show on the platforms within 3–5 business days.",
    ],
  },
};

/** Always sent with a draft: who BookLeaf is and how it writes. */
const ALWAYS: KbSectionId[] = ["company", "tone"];

/** Policy sections that can come up in any ticket. */
const POLICY: KbSectionId[] = [
  "royalty",
  "isbn",
  "printing",
  "distribution",
  "production",
  "metadata",
];

// General inquiries can touch any policy, so they get all of them; the KB is
// small enough that this costs little.
const SECTIONS_BY_CATEGORY: Record<TicketCategory, KbSectionId[]> = {
  ROYALTY_PAYMENTS: ["royalty"],
  ISBN_METADATA: ["isbn", "metadata"],
  PRINTING_QUALITY: ["printing"],
  DISTRIBUTION_AVAILABILITY: ["distribution", "production"],
  BOOK_STATUS_PRODUCTION: ["production"],
  GENERAL_INQUIRY: POLICY,
};

/**
 * KB sections for a draft: company and tone always, then the category's
 * policy sections. Unclassified tickets (null) get every policy section.
 */
export function sectionsForCategory(
  category: TicketCategory | null,
): KbSection[] {
  const policy = category ? SECTIONS_BY_CATEGORY[category] : POLICY;
  return [...ALWAYS, ...policy].map((id) => KB_SECTIONS[id]);
}

/**
 * How BookLeaf handles each kind of query: our summary of the brief's
 * examples, keeping their conditions. Timelines are only promised where the
 * brief ties them to that situation.
 */
export const CATEGORY_GUIDANCE: Record<TicketCategory, string[]> = {
  ROYALTY_PAYMENTS: [
    "Acknowledge the concern, then explain the quarterly cycle and that payment is due within 45 days of the quarter's end.",
    "If the facts give the next payout deadline, state it as the date by which the payout is due.",
    "Payout details aren't visible to us: ask the author to confirm their bank account is linked, and list the bank details and the payout status under needsVerification.",
    "Never say a payment is overdue, scheduled, sent or received unless the facts say so. Offer to check the payout status; only a confirmed overdue payment justifies promising resolution within 48 hours.",
    "If the author thinks the amount is too low, explain the net-profit formula without being defensive and offer a detailed line-by-line breakdown.",
    "If pending royalties are below the ₹1,000 minimum, explain that they roll over to the next quarter.",
  ],
  ISBN_METADATA: [
    "Treat a reported ISBN error (duplicate, or linked to the wrong book) as serious and high priority.",
    "For such an error, commit to escalating it to the production team, with resolution within 48 hours.",
    "For questions about using the author's own imprint, explain that BookLeaf assigns ISBNs under its imprint and an own-imprint ISBN must be obtained by the author.",
    "For listing changes such as a description, explain how to request them and that they take 3–5 business days to show.",
  ],
  PRINTING_QUALITY: [
    "Apologise sincerely for the quality problem.",
    "Request photos of the affected copies.",
    "Commit to arranging a free reprint once the defect is verified, with the reprint taking 5–7 business days.",
  ],
  DISTRIBUTION_AVAILABILITY: [
    "For a published book showing as unavailable, explain that this is usually a stock sync issue.",
    "Commit to requesting a re-sync with the distribution team, and set the expectation of 24–48 hours for the book to be available again.",
    "For a newly published book, explain that it typically appears on the platforms 7–10 business days after publication finishes.",
    "If the facts show the book is still in production, explain that it can't be listed until it is published.",
  ],
  BOOK_STATUS_PRODUCTION: [
    "State the book's actual current stage from the facts.",
    "If it seems delayed, explain the common reasons honestly (cover approval, proofreading rounds) without blaming the author; frame it as working together.",
    "Don't invent a completion date: commit to checking with the production team and list the updated timeline under needsVerification.",
    "Mention that the author receives an email update at each stage.",
  ],
  GENERAL_INQUIRY: [
    "Answer from the policies provided; if they don't cover the question, say the team will look into it rather than guessing.",
    "For listing changes after a book is live, explain the request routes (dashboard or email) and that changes show within 3–5 business days.",
  ],
};

/** Handling guidance for a draft; none until the ticket has a category. */
export function guidanceForCategory(category: TicketCategory | null): string[] {
  return category ? CATEGORY_GUIDANCE[category] : [];
}
