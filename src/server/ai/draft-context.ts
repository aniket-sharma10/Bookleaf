import "server-only";

import type { TicketCategory } from "@/generated/prisma/enums";
import { isInProduction, productionStage } from "@/lib/books";
import { formatCount, formatDate, formatInr } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import { getDb } from "@/server/db";
import {
  isBelowPayoutThreshold,
  MIN_PAYOUT_INR,
  neverPaid,
  payoutDeadlineFor,
} from "@/server/policies/royalty";
import { toAuthorBook } from "@/server/services/books";

import { guidanceForCategory, sectionsForCategory } from "./knowledge-base";
import { clip, type KnownNames, redact, stripDelimiters } from "./redact";

// Builds the minimal, verified context for one draft (DRAFT-04, DRAFT-07,
// architecture §6.4 and §6.6). Everything sent to Gemini is assembled here
// from an allow-list:
// - the ticket and up to 3 recent replies, redacted and clipped;
// - the referenced book's figures (or a compact list for General tickets);
// - policy facts computed in code (payout deadline, threshold, stage);
// - the category's KB sections and handling guidance.
// Never sent: the author's name (substituted after generation), email,
// phone, city, any IDs, internal notes, the assignee, or staff names.

export const DATA_TAGS = [
  "ticket",
  "previous_replies",
  "verified_facts",
  "knowledge_base",
] as const;

const LIMITS = { subject: 200, description: 3_000, reply: 800, replies: 3 };

export type DraftContext = {
  category: TicketCategory | null;
  /** For the greeting placeholder; substituted after generation, never sent. */
  authorFirstName: string;
  /** Each block's text, exactly as placed in the prompt. */
  blocks: Record<(typeof DATA_TAGS)[number], string>;
};

type BookFacts = ReturnType<typeof toAuthorBook>;

function bookLines(book: BookFacts): string[] {
  const stage = productionStage(book.status);
  return [
    `Title: ${book.title}`,
    `Status: ${book.status}`,
    ...(stage ? [`Current production stage: ${stage}`] : []),
    `ISBN: ${book.isbn}`,
    `Genre: ${book.genre}`,
    `Publication date: ${formatDate(book.publicationDate, "not yet published")}`,
    `MRP: ${formatInr(book.mrp, "not set yet")}`,
    `Royalty per copy: ${formatInr(book.authorRoyaltyPerCopy, "not set yet")}`,
    `Copies sold: ${formatCount(book.totalCopiesSold)}`,
    `Royalty earned: ${formatInr(book.totalRoyaltyEarned)}`,
    `Royalty paid: ${formatInr(book.royaltyPaid)}`,
    `Royalty pending: ${formatInr(book.royaltyPending)}`,
    `Last royalty payout: ${formatDate(book.lastRoyaltyPayoutDate, "no payout has been made yet")}`,
    ...(neverPaid(book)
      ? ["No royalty has been paid out for this book yet."]
      : []),
    `Available on: ${book.availableOn.length ? book.availableOn.join(", ") : "not listed on any platform yet"}`,
    `Print partner: ${book.printPartner ?? "not assigned yet"}`,
  ];
}

function knowledgeText(category: TicketCategory | null): string {
  const sections = sectionsForCategory(category).map(
    (section) =>
      `## ${section.title}\n${section.facts.map((fact) => `- ${fact}`).join("\n")}`,
  );
  const guidance = guidanceForCategory(category);
  if (guidance.length) {
    sections.push(
      `## How to handle this kind of query\n${guidance.map((g) => `- ${g}`).join("\n")}`,
    );
  }
  return sections.join("\n\n");
}

/** Builds the context for a ticket's draft, or null if the ticket is gone. */
export async function buildDraftContext(
  ticketId: string,
  today: Date = new Date(),
): Promise<DraftContext | null> {
  const db = getDb();
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      description: true,
      status: true,
      category: true,
      bookId: true,
      authorId: true,
      author: { select: { name: true } },
      messages: {
        select: {
          body: true,
          createdAt: true,
          sender: { select: { name: true, role: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LIMITS.replies,
      },
    },
  });
  if (!ticket) return null;

  // Only the ticket author's own books, never anyone else's (AUTH-06).
  const books = (
    await db.book.findMany({
      where: { authorId: ticket.authorId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        isbn: true,
        genre: true,
        publicationDate: true,
        status: true,
        mrp: true,
        authorRoyaltyPerCopy: true,
        totalCopiesSold: true,
        totalRoyaltyEarned: true,
        royaltyPaid: true,
        royaltyPending: true,
        lastRoyaltyPayoutDate: true,
        printPartner: true,
        availableOn: true,
      },
    })
  ).map(toAuthorBook);

  const names: KnownNames = {
    author: ticket.author.name,
    staff: [
      ...new Set(
        ticket.messages
          .filter((m) => m.sender.role === "ADMIN")
          .map((m) => m.sender.name),
      ),
    ],
  };
  const clean = (text: string, max: number) =>
    stripDelimiters(clip(redact(text, names), max), [...DATA_TAGS]);

  const ticketBlock = [
    `Subject: ${clean(ticket.subject, LIMITS.subject)}`,
    `Ticket status: ${STATUS_LABELS[ticket.status]}`,
    "Description:",
    clean(ticket.description, LIMITS.description),
  ].join("\n");

  const repliesBlock = ticket.messages.length
    ? [...ticket.messages]
        .reverse()
        .map(
          (m) =>
            `${m.sender.role === "ADMIN" ? "BookLeaf Support" : "[AUTHOR]"} (${formatDate(m.createdAt)}): ${clean(m.body, LIMITS.reply)}`,
        )
        .join("\n\n")
    : "No replies yet.";

  const book = books.find((b) => b.id === ticket.bookId) ?? null;
  const totalPending = books.reduce((sum, b) => sum + b.royaltyPending, 0);
  const deadline = payoutDeadlineFor(today);
  const facts = [
    `Today's date: ${formatDate(today.toISOString().slice(0, 10))}`,
    ...(book
      ? ["The ticket is about this book:", ...bookLines(book)]
      : [
          "The ticket is a general / account question. The author's books:",
          ...books.map(
            (b) =>
              `- ${b.title}: ${b.status}; royalty pending ${formatInr(b.royaltyPending)}${isInProduction(b.status) ? "" : `; last payout ${formatDate(b.lastRoyaltyPayoutDate, "none yet")}`}`,
          ),
        ]),
    `Next royalty payout deadline under the policy: ${formatDate(deadline.deadline)} (for the quarter ending ${formatDate(deadline.quarterEnd)}). This is the policy deadline, not a record of any payment.`,
    `Author's total pending royalties across all books: ${formatInr(totalPending)}.`,
    ...(isBelowPayoutThreshold(totalPending)
      ? [
          `That is below the ${formatInr(MIN_PAYOUT_INR)} minimum payout, so it rolls over to the next quarter.`,
        ]
      : []),
    "Not available to support: bank account details, payout transaction records and per-platform sales breakdowns.",
  ].join("\n");

  return {
    category: ticket.category,
    authorFirstName: ticket.author.name.trim().split(/\s+/)[0] ?? "",
    blocks: {
      ticket: ticketBlock,
      previous_replies: repliesBlock,
      verified_facts: facts,
      knowledge_base: knowledgeText(ticket.category),
    },
  };
}

/** The user turn: each block wrapped in its tag. */
export function renderDraftUserTurn(context: DraftContext): string {
  return DATA_TAGS.map(
    (tag) => `<${tag}>\n${context.blocks[tag]}\n</${tag}>`,
  ).join("\n\n");
}
