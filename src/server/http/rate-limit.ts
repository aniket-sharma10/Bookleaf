import "server-only";

import { getDb } from "@/server/db";

import { RateLimitedError } from "./errors";

// Basic rate limiting (architecture §5): fixed-window counters in Postgres, so every
// server instance shares them without extra infrastructure. Limits are
// generous: they stop scripted abuse (password guessing, ticket spam, burning
// the AI quota), not normal use by several people sharing a demo account.

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
  message: (retryAfterSeconds: number) => string;
};

function inMinutes(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export const RATE_LIMITS = {
  /** Failed sign-ins per client IP (successful ones are refunded). */
  login: {
    name: "login",
    limit: 10,
    windowSeconds: 15 * 60,
    message: (retryAfter) =>
      `Too many sign-in attempts. Please try again in ${inMinutes(retryAfter)}.`,
  },
  /** New tickets per author. */
  ticketCreate: {
    name: "ticket-create",
    limit: 10,
    windowSeconds: 10 * 60,
    message: (retryAfter) =>
      `You've raised several queries in a short time. Please try again in ${inMinutes(retryAfter)}.`,
  },
  /** AI drafts and classification retries per admin. */
  ai: {
    name: "ai",
    limit: 30,
    windowSeconds: 10 * 60,
    message: (retryAfter) =>
      `AI requests are limited for a while. Try again in ${inMinutes(retryAfter)}, or continue manually.`,
  },
} satisfies Record<string, RateLimitRule>;

function keyFor(rule: RateLimitRule, subject: string): string {
  return `${rule.name}:${subject}`;
}

/**
 * Counts one request for `subject` and throws a 429 once the rule's limit is
 * exceeded. One atomic upsert: parallel requests can't slip past the limit,
 * and the window restarts on the first request after it ends. Times come
 * from the database clock, so all instances agree.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<void> {
  const rows = await getDb().$queryRaw<{ count: number; retryAfter: number }[]>`
    INSERT INTO "RateLimit" AS r ("key", "count", "windowStart")
    VALUES (${keyFor(rule, subject)}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN r."windowStart" <= now() - make_interval(secs => ${rule.windowSeconds}::int)
        THEN 1 ELSE r."count" + 1 END,
      "windowStart" = CASE
        WHEN r."windowStart" <= now() - make_interval(secs => ${rule.windowSeconds}::int)
        THEN now() ELSE r."windowStart" END
    RETURNING "count",
      CEIL(EXTRACT(EPOCH FROM (
        "windowStart" + make_interval(secs => ${rule.windowSeconds}::int) - now()
      )))::int AS "retryAfter"`;
  const { count, retryAfter } = rows[0]!;
  if (count > rule.limit) {
    const seconds = Math.max(1, retryAfter);
    throw new RateLimitedError(rule.message(seconds), seconds);
  }
}

/** Gives back one counted request, e.g. after a successful sign-in. */
export async function refundRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<void> {
  await getDb().$executeRaw`
    UPDATE "RateLimit" SET "count" = GREATEST("count" - 1, 0)
    WHERE "key" = ${keyFor(rule, subject)}`;
}

/**
 * The client's IP address for per-IP limits. On Vercel the platform sets
 * x-forwarded-for itself and overwrites any client-sent value, so it can't be
 * spoofed there. Behind another host or proxy that passes the header through
 * unchecked, this limit could be bypassed (architecture §5).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}
