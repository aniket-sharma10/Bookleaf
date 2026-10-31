# 0009. Basic rate limiting with Postgres counters

- **Status:** Proposed (requested by the owner; approach proposed by the assistant, awaiting owner approval)
- **Date:** 2026-10-31
- **Implementation:** implemented (T7.8): `src/server/http/rate-limit.ts`, the `RateLimit` model and migration `20261031150000_rate_limit`, applied in the login, ticket-creation, draft and classification-retry routes.
- **Requirements:** none asks for it directly; a security baseline next to AUTH-01 and API-05, and it protects the AI quota behind AI-08 and DRAFT-01

## Context
The demo credentials are published in the README, and the app is shared directly with a small team, not promoted. The exposure is low, but there was no limit on password guessing, ticket spam or repeated AI calls that use the free Gemini quota. The owner asked for sensible, proportionate rate limiting without Redis or other new infrastructure. The app runs as serverless functions (Vercel), so instances share no memory.

## Decision
Fixed-window counters in a `RateLimit` Postgres table, updated with one atomic `INSERT … ON CONFLICT DO UPDATE` that also restarts an expired window. Over a limit, the API returns 429 `RATE_LIMITED` with `Retry-After`.
- Sign-in: 10 failed attempts per client IP per 15 minutes. Every attempt is counted before the password check and refunded on success.
- Ticket creation: 10 per author per 10 minutes.
- AI drafts and classification retries: 30 per admin per 10 minutes, one shared budget.

## Rationale
- Postgres is already there, so the limit holds across all instances with no new service or secret.
- One atomic statement means parallel requests can't exceed a limit, and the database clock keeps instances consistent.
- The limits are generous on purpose: they stop scripts, not several reviewers sharing a demo account.
- Per IP rather than per account for sign-in: a per-account lockout would let anyone lock out the shared demo accounts.

## Alternatives considered
- **In-memory counters per instance.** No database round trip, but each serverless instance (and each cold start) has its own count, so the limit doesn't really hold.
- **Redis (e.g. a hosted Upstash instance).** The usual choice at scale, but it is extra infrastructure the owner ruled out, and not needed at this volume.
- **Counting only failed sign-ins, checked before the password check.** Simpler, but parallel guesses can all pass the check before any failure is recorded. Counting first and refunding a success avoids that.
- **Per-account lockout.** Rejected for the lockout reason above.

## Consequences
- One extra small query per limited request (a second one on a successful sign-in). These endpoints already take far longer (bcrypt, AI calls).
- The per-IP limit trusts `x-forwarded-for`, which Vercel overwrites with the real client IP. On a host that passes a client-sent value through, it could be bypassed.
- Rows are reused per key and never deleted. At this scale the table stays tiny; a periodic cleanup would be the follow-up if traffic grew.
- Users behind one shared IP (an office network) share the sign-in budget. Only failures count, so normal use is unaffected.
