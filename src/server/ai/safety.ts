import "server-only";

import type { DraftContext } from "./draft-context";

// Deterministic post-check of a draft (DRAFT-05, architecture §6.4). Every
// claim is compared with the context we actually sent (ticket, replies,
// verified facts, knowledge base), so legitimate figures such as "48 hours",
// "₹1,000" or the book's own amounts pass. Findings are warnings shown to the
// admin above the editor; they never block sending, because the admin is the
// reviewer and the checks are heuristics.

const MONEY = /(?:₹|\brs\.?|\binr)\s?(\d[\d,]*(?:\.\d+)?)/gi;
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const LINK = /\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\(?\d[\d ().-]{8,}\d/g;
const PLACEHOLDER = /\[(?:email|phone|number|AUTHOR|STAFF)\]/;

const ACTION_VERBS =
  "refunded|credited|paid|transferred|reprinted|re-?synced|escalated|resolved|fixed|corrected|processed|sent|dispatched|updated|replaced";
const COMPLETED_ACTION = [
  new RegExp(`\\b(?:has|have) (?:already )?been (?:${ACTION_VERBS})\\b`, "gi"),
  new RegExp(
    `\\b(?:we|I)(?:'ve| have) (?:already )?(?:${ACTION_VERBS})\\b`,
    "gi",
  ),
  new RegExp(`\\balready (?:been )?(?:${ACTION_VERBS})\\b`, "gi"),
];
// The app never knows that a payment is late, so the draft mustn't say so.
const OVERDUE =
  /\b(?:is|are|was|were|now|already) (?:now )?(?:overdue|late)\b/gi;

function digitsOf(value: string): string {
  return value.replace(/[^\d.]/g, "").replace(/\.0+$/, "");
}

function allMatches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[0]);
}

const PAYMENT_VERB = /\b(?:paid|credited|transferred)\b/i;
const RECORDED_PAYMENT = /Royalty paid: ₹([\d,]+)/g;

/**
 * A "has been paid" phrase restates a fact when the ₹ amount just before it
 * equals a payment the verified facts record (e.g. "₹6,000 has been paid"
 * with "Royalty paid: ₹6,000"). Anything else is still flagged.
 */
function isRecordedPayment(
  reply: string,
  start: number,
  phrase: string,
  paidAmounts: Set<string>,
): boolean {
  if (!PAYMENT_VERB.test(phrase)) return false;
  const before = reply.slice(Math.max(0, start - 40), start);
  const amounts = [...before.matchAll(MONEY)].map((m) => digitsOf(m[1]!));
  const nearest = amounts.at(-1);
  return nearest !== undefined && nearest !== "0" && paidAmounts.has(nearest);
}

/** "Already happened" phrases, each reported once (longest overlapping match). */
function completedActionPhrases(
  reply: string,
  paidAmounts: Set<string>,
): string[] {
  const found = COMPLETED_ACTION.flatMap((pattern) =>
    [...reply.matchAll(pattern)].map((m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
    })),
  ).sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: typeof found = [];
  for (const match of found) {
    const last = kept.at(-1);
    if (!last || match.start >= last.end) kept.push(match);
  }
  return kept
    .filter((m) => !isRecordedPayment(reply, m.start, m.text, paidAmounts))
    .map((match) => match.text);
}

/** Returns warnings for the admin; an empty list means nothing was found. */
export function checkDraft(reply: string, context: DraftContext): string[] {
  const source = Object.values(context.blocks).join("\n");
  const sourceNumbers = new Set(allMatches(source, NUMBER).map(digitsOf));
  const lowerSource = source.toLowerCase();
  const warnings = new Set<string>();

  // Amounts first, so the generic number check doesn't report them twice.
  let rest = reply;
  for (const match of reply.matchAll(MONEY)) {
    if (!sourceNumbers.has(digitsOf(match[1]!))) {
      warnings.add(
        `The amount "${match[0].trim()}" isn't in the ticket, facts or knowledge base. Check it before sending.`,
      );
    }
    rest = rest.replace(match[0], " ");
  }

  for (const link of allMatches(rest, LINK)) {
    if (!lowerSource.includes(link.toLowerCase())) {
      warnings.add(
        `The link "${link}" isn't from the ticket or BookLeaf's policies. Remove it or check it.`,
      );
    }
    rest = rest.replace(link, " ");
  }
  for (const email of allMatches(rest, EMAIL)) {
    if (!lowerSource.includes(email.toLowerCase())) {
      warnings.add(
        `The email address "${email}" isn't from the ticket. Remove it or check it.`,
      );
    }
    rest = rest.replace(email, " ");
  }
  for (const phone of allMatches(rest, PHONE)) {
    if (digitsOf(phone).length >= 10 && !sourceNumbers.has(digitsOf(phone))) {
      warnings.add(
        `The phone number "${phone.trim()}" isn't from the ticket. Remove it or check it.`,
      );
      rest = rest.replace(phone, " ");
    }
  }

  for (const number of allMatches(rest, NUMBER)) {
    if (!sourceNumbers.has(digitsOf(number))) {
      warnings.add(
        `The number "${number}" isn't in the ticket, facts or knowledge base. Check it before sending.`,
      );
    }
  }

  const paidAmounts = new Set(
    [...context.blocks.verified_facts.matchAll(RECORDED_PAYMENT)].map((m) =>
      digitsOf(m[1]!),
    ),
  );
  for (const phrase of completedActionPhrases(reply, paidAmounts)) {
    warnings.add(
      `"${phrase}" says an action already happened, but the app has no record of it. Rephrase it as a commitment, or confirm it was done.`,
    );
  }
  for (const phrase of allMatches(reply, OVERDUE)) {
    warnings.add(
      `"${phrase}" describes a payment's status, which the app can't confirm. Check the payout status first.`,
    );
  }
  if (PLACEHOLDER.test(reply)) {
    warnings.add(
      "The reply contains a privacy placeholder such as [email] or [phone]. Replace or remove it.",
    );
  }
  return [...warnings];
}
