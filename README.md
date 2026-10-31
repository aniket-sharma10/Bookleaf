# BookLeaf Author Support & Communication Portal

A support portal for BookLeaf Publishing with two sides:
- **Authors** see their books and royalties, raise support queries and follow the replies.
- **The BookLeaf support team** works through a prioritised ticket queue, with AI that classifies each query and drafts a reply grounded in the author's real book data and BookLeaf's policies.

**Live demo:** _URL to be added after deployment._

- [Demo accounts](#demo-accounts)
- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Local setup](#local-setup)
- [Architecture](#architecture)
- [Key decisions and why](#key-decisions-and-why)
- [AI integration](#ai-integration)
- [Model choice](#model-choice)
- [API documentation](#api-documentation)
- [Security](#security)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Improvements with more time or budget](#improvements-with-more-time-or-budget)
- [Project documents](#project-documents)

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Author | Any author's email from the supplied dataset (`bookleaf_sample_data.json`) | `Author@Demo2026` |
| Admin | `support.lead@bookleaf.example` or `support.agent@bookleaf.example` | `Admin@Demo2026` |

These are demo passwords, not secrets. The seed reads them from `SEED_AUTHOR_PASSWORD` and `SEED_ADMIN_PASSWORD`.

Authors that show the edge cases:

| Author | Shows |
|---|---|
| AUTH007 | A book still in production, alongside published ones |
| AUTH009 | Pending royalty below the ₹1,000 payout minimum, plus a book in production |
| AUTH003 | Royalty earned but never paid out yet |

## What it does

**Author portal**
- **Dashboard:** every book with its ISBN, genre, publication date, status, MRP, copies sold and royalty earned, paid and pending, plus totals. Books in production and zero royalties are shown plainly, without blank or broken values. A hint appears when pending royalty is below the ₹1,000 payout minimum.
- **Raise a query:** choose one of your books or "General / Account Level", then add a subject and details. Attachments can be selected but aren't uploaded.
- **My tickets:** every query with its status and the support team's replies. The page updates within about 5 seconds when the team replies or changes the status, with no reload.

**Admin portal**
- **Ticket queue:** all authors' tickets: tickets without a priority first (they need triage), then Critical to Low, oldest first. Filters for status, category, priority, assignee ("Assigned to me" or "Unassigned"), date range and "Needs triage".
- **Ticket page:** the query, the author and full book record, the AI's suggested category and priority with its reasoning (both can be overridden), status changes, "Assign to me", internal notes the author never sees, and the reply composer.
- **AI draft:** on the first open of an unanswered ticket, an AI draft appears in the editor. It comes with the promises it makes and the facts to check before sending. The admin edits it and sends; nothing reaches the author without that.

If AI is unavailable, everything still works: tickets are created, admins triage by hand, and the composer shows why there's no draft.

## Tech stack

| Area | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript (strict) |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react |
| API | Next.js Route Handlers (REST, JSON) |
| Data | PostgreSQL (Neon in the cloud, Docker locally) via Prisma 7 |
| Auth | Email and password (bcrypt via `bcryptjs`), HS256 JWT (`jose`) in an HttpOnly cookie |
| AI | Google Gemini via `@google/genai`, outputs validated with Zod |
| Updates | SWR polling |
| Tests | Vitest, against a dedicated local test database |

## Local setup

**You need:** Node.js 24 (`.nvmrc`; at least 20.19), Docker, and the supplied `bookleaf_sample_data.json`. The dataset is confidential and isn't in this repository: put it in the project root or point `SEED_DATA_PATH` at it.

```bash
npm install                  # also generates the Prisma client
cp .env.example .env         # then fill in the values below
npm run db:up                # local Postgres: dev on 127.0.0.1:55432, test on 127.0.0.1:55433
npx prisma migrate deploy    # create the tables
npm run db:seed              # load the 10 authors and 18 books, plus the login accounts
npm run db:verify            # optional, read-only: the database matches the dataset field by field
npm run dev                  # http://localhost:3000
```

**In `.env`:**
- `AUTH_JWT_SECRET`: at least 32 characters, for example from `openssl rand -base64 48`.
- `SEED_AUTHOR_PASSWORD` and `SEED_ADMIN_PASSWORD`: the demo passwords above (8+ characters).
- `DATABASE_URL`: already points at the local Docker database.
- **AI (optional):** set `GEMINI_API_KEY` (from [Google AI Studio](https://aistudio.google.com/apikey)), `GEMINI_CLASSIFY_MODEL=gemini-3.5-flash-lite` and `GEMINI_DRAFT_MODEL=gemini-3.5-flash-lite`. AI is on only when all three are set. `npm run ai:smoke` checks the setup with 2 live calls.

To use a Neon database instead of Docker, set `DATABASE_URL` to the pooled URL, `DIRECT_URL` to the direct URL, and `DEV_DATABASE_HOST` to the direct URL's host. `.env.example` describes every variable.

**Scripts**

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Develop, build, run the build |
| `npm test` | All automated tests. Needs `cp .env.test.example .env.test` once, and `npm run db:up` |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Code checks |
| `npm run db:seed` / `npm run db:verify` | Load the dataset (idempotent) / compare the database with it (read-only) |
| `npm run ai:smoke` | Checks the Gemini key and models (2 live calls) |
| `npm run ai:eval` | Runs 10 made-up tickets through the real prompts and writes `docs/ai-eval.md` (about 18 live calls) |
| `npm run db:down` | Stops the local databases (dev data is kept) |

**Database safety:** the seed, `db:verify` and every Prisma CLI command accept only the development database (local Docker, or the Neon host registered in `DEV_DATABASE_HOST`) and the local test database. Tests run only against the disposable `bookleaf_test` database. See ADR-0006 and ADR-0008.

## Architecture

One Next.js application holds the UI, a REST API and a server-only service layer.

```
Browser (React, Tailwind + shadcn/ui)
   │  JSON over /api/** with the HttpOnly session cookie; polls every 5–15 s
   ▼
Next.js
   ├─ pages: layouts redirect by role (convenience only)
   └─ /api/**/route.ts: withApi(handler, { access }), the security boundary
         origin check → verify JWT → check role → validate with Zod → service → JSON or error envelope
               │                                   │
               ▼                                   ▼
         services (business rules) ──► Prisma ──► PostgreSQL
               │
               └─► server/ai ──► Gemini (server-side key; failures become typed errors)
```

```
src/
  app/            pages (author, admin, login) and api/**/route.ts
  features/       client components per feature (login, author tickets, admin queue, admin ticket)
  components/     shared UI and shadcn/ui primitives
  lib/            browser-safe code: request schemas, API client, response types, labels, formatting
  server/         server-only code
    http/         withApi, error envelope, origin check, rate limiting
    auth/         passwords, JWT, cookie, guards
    services/     business rules (books, author tickets, admin tickets)
    policies/     royalty rules from the knowledge base (payout deadline, ₹1,000 minimum)
    ai/           provider interface, Gemini adapter, knowledge base, classification, drafting, redaction
prisma/           schema, migrations, seed and verification
tests/            integration tests and synthetic fixtures (unit tests sit next to the code)
```

How a ticket flows:
1. The author raises a query. `POST /api/author/tickets` saves it as Open and responds straight away. Classification then runs in the background (`after()`), so a slow or failing AI never delays or blocks the author.
2. The ticket appears in the admin queue within about 15 seconds. The AI's category and priority fill in once classification finishes.
3. The admin opens it. If it's unanswered, a draft is requested and fills the editor. The admin edits it and sends it with `POST /api/admin/tickets/:id/messages`, which can also set the status.
4. The author's open ticket page polls every 5 seconds and shows the reply.

The full design is in [docs/architecture.md](docs/architecture.md).

## Key decisions and why

| Decision | Why | Record |
|---|---|---|
| One Next.js app, with the REST API as Route Handlers and a service layer behind them | One deployable, no CORS or cross-domain cookies, and the API still exists as explicit, documented HTTP routes | [ADR-0001](docs/adr/0001-single-nextjs-app-with-rest-route-handlers.md) |
| Email and password, with a signed JWT in an HttpOnly cookie | Simple and explainable. Page scripts can't read the token, and no session lookup is needed per request. Trade-off: logout can't revoke a copied token before it expires | [ADR-0002](docs/adr/0002-jwt-cookie-auth.md) |
| One wrapper (`withApi`) enforces access on every endpoint; author data is scoped by the ID in the token | A single, testable security boundary. Another author's ticket simply doesn't exist (404) | [architecture §4–5](docs/architecture.md#5-authentication-and-authorization) |
| Gemini behind a small provider interface, with schema-validated structured output, and AI that never blocks anything | Malformed AI output becomes a handled error, not a bug. Swapping providers is a one-file change. Tickets and replies work without AI | [ADR-0003](docs/adr/0003-ai-integration-structured-outputs-graceful-degradation.md) |
| Polling for near-real-time updates | Serverless hosting can't hold WebSocket connections without extra services, and 5–15 s feels responsive for support | [ADR-0004](docs/adr/0004-polling-for-near-real-time-updates.md) |
| Dataset IDs as primary keys, values stored exactly as supplied | Every row traces back to the JSON, re-seeding is an idempotent upsert, and nothing is "corrected" | [ADR-0005](docs/adr/0005-dataset-preserving-data-model.md) |
| AI suggestions kept separately from the effective category and priority | The AI fills only empty values, so it never overwrites an admin, and overrides stay visible | [ADR-0005](docs/adr/0005-dataset-preserving-data-model.md) |
| Separate dev and test databases, with guards in every tool that writes | Tests and scripts can't touch the wrong database by accident | [ADR-0006](docs/adr/0006-isolated-local-databases-and-write-guards.md), [ADR-0008](docs/adr/0008-prisma-cli-target-guard.md) |
| Environment variables validated where they're used | The app runs without an AI key, and a missing setting names the feature it breaks | [ADR-0007](docs/adr/0007-lazy-environment-validation.md) |
| Rate limits stored in Postgres | They hold across serverless instances with no Redis or other new service | [ADR-0009](docs/adr/0009-postgres-backed-rate-limiting.md) |
| The admin's review is the final check on AI drafts; no pattern-matching post-check | Phrase lists can't tell "has been processed" from "once it has been processed", and false alarms teach people to ignore warnings | [ADR-0010](docs/adr/0010-no-pattern-based-draft-post-check.md) |
| No vector database, embeddings or agent framework | The knowledge base is about 1k tokens in a few sections, so picking sections by category is cheaper, deterministic and testable | [architecture §9](docs/architecture.md#9-rejected-alternatives) |

## AI integration

### Prompt strategy

- **Two focused tasks, each with its own system prompt:**
  - **Classification:** one category, one priority and a one-sentence reason.
  - **Drafting:** a reply body, plus two lists, `commitments` and `needsVerification`.
- **Structured output.** Each call sends a JSON schema generated from a Zod schema, and the response is checked against the same Zod schema. Anything that doesn't fit is treated as a failed call, never shown.
- **Grounded context, built by code** (`server/ai/draft-context.ts`). The draft prompt contains only:
  - the ticket text and the last three replies;
  - the selected book's verified record, or a short summary of the author's books for a General query;
  - facts computed in code from BookLeaf's policies: the next payout deadline under the 45-day rule, whether pending royalty is below the ₹1,000 minimum, whether the author has ever been paid, and the production stage;
  - the knowledge-base sections for the ticket's category, plus the tone guidelines.
- **Rules in the system prompt:**
  - Use only the given facts; never invent amounts, dates, platforms or timelines.
  - If something isn't known, say the team will check, and list it under `needsVerification`.
  - Never claim an action has already happened (refund, re-sync, escalation…): the app records no such actions, so drafts may only promise future ones, listed under `commitments`.
  - Follow BookLeaf's tone: acknowledge first, be specific, end with a clear next step.
- **Ticket text is untrusted data.** It sits in its own delimited block, and the prompt says to ignore any instructions inside it. Text that could close the block is stripped, and there's no tool calling.
- **The author's name never goes to the model.** The model writes only the body; code adds "Dear <first name>," and the sign-off.
- **The knowledge base** (`server/ai/knowledge-base.ts`) is a structured summary of BookLeaf's policies in our own words, with per-category handling guidance (for example, a 48-hour timeline for ISBN escalations).
- **Prompts are versioned** (`classify-v1`, `draft-v2`), and every call log records the version.

**Classification** runs once per ticket, on the ticket text and the book's status only. The priority rubric is in [architecture §6.3](docs/architecture.md#63-classification-and-priority-ai-01-ai-02-ai-08). An admin can override both values at any time, and a late AI result never overwrites an admin's choice.

**Drafts** are generated automatically only on the first open of a ticket that is Open or In Progress and has no reply and no draft yet. They're stored and reused. After that, a draft is made only when the admin clicks "Draft with AI" or "Regenerate".

### Error handling

Every AI failure becomes one of five error types, and the app degrades the same way for each:

| Failure | Handling | What the admin sees |
|---|---|---|
| No key or models configured | No network call | "AI isn't configured here. You can still triage and reply manually." |
| Timeout (15 s classification, 30 s drafts) | Request aborted | "The AI service took too long to respond…" |
| Rate limit or quota (HTTP 429) | No automatic retry, which would only burn quota | "The AI service is busy right now. Try again in a minute…" |
| Server error (5xx) or network failure | One retry after 1 s, then fails | "The AI service is unavailable…" |
| Output that is empty, truncated, blocked or off-schema | Rejected, nothing stored | "The AI returned an answer we couldn't use…" |

- If classification fails, the ticket is still created and shows as "Needs triage". The admin can set the values by hand, or click "Retry AI classification".
- If drafting fails, the composer shows "AI draft unavailable — write a reply manually", with the reason and "Try again".
- AI endpoints answer 503 `AI_UNAVAILABLE`, and the provider's own error text never reaches the browser.

A failure drill ran the full lifecycle (raise → triage → draft → reply → author sees it) with no key, with an invalid key, and with a 1 ms timeout. Every run completed manually.

### Cost management

- **Small model, minimal reasoning:** `gemini-3.5-flash-lite`, with thinking `MINIMAL` for classification and `LOW` for drafts, and output capped at 1,024 and 4,096 tokens.
- **Only what's needed is sent:**
  - classification sees the ticket text (clipped to 2,000 characters) and the book's status;
  - drafts get only the relevant knowledge-base sections, one book's facts and the last three replies;
  - no full ticket history or whole knowledge base on every call.
- **Few calls:** one classification per ticket. A draft is created automatically only once per ticket, then reused; reopening a ticket costs nothing.
- **Limits:** 30 AI requests per admin per 10 minutes, and 10 new tickets per author per 10 minutes, which also caps background classification.
- **Measured:** every call writes an `AiCallLog` row with the model, prompt version, outcome, input, output and thinking tokens, and latency. No prompt text or personal data is stored. Calls on 31 Oct 2026 used about 470 input and 45 output tokens per classification, and about 1,450–1,760 input and 175–210 output tokens per draft, usually within 1–3 seconds.

### Data sent to Gemini

The demo runs on Gemini's free tier, whose terms allow Google to use prompts to improve its products. So prompts are minimised by construction and tested:
- **Never sent:** the author's name, email, phone, city, internal notes, admin names or any IDs.
- **Redacted from ticket text:** email addresses, phone numbers, long digit runs and the author's name.
- **Sent:** the book's business facts (title, status, masked ISBN, figures, platforms), which grounding needs.

### Prompt evaluation

`npm run ai:eval` runs 10 made-up tickets (every category, two royalty variants, and a prompt-injection attempt) through the real prompts. It checks:
- the exact category, and the priority where the requirements imply one (a long-missing royalty above a bio update, ISBN errors High or above);
- that each draft follows the knowledge base (quarterly cycle and 45-day window, 48-hour ISBN escalation, photos before a reprint, and so on);
- that the injection attempt's draft doesn't mention a refund or reveal the prompt.

The latest run passed every check: [docs/ai-eval.md](docs/ai-eval.md).

## Model choice

**`gemini-3.5-flash-lite` for both classification and drafting.**
- **Fast and good enough.** Classification and drafts typically take 1–3 seconds. The prompt evaluation passed every check, and the drafts' tone was reviewed by hand.
- **Free tier and native structured output.** The demo runs without billing, and JSON-schema output maps directly onto the Zod-validated contracts.
- **`gemini-3.8-flash` was tried first for drafts.** On the free tier it repeatedly returned 503 "high demand" and otherwise took 20–65 seconds per draft, which isn't usable for a support agent.
- **Any provider fits.** Inexpensive models such as OpenAI's gpt-4o-mini or Anthropic's Claude Haiku would fit equally well. Gemini was chosen for its free tier.
- **Easy to change.** Model IDs come from environment variables, so a stronger model is a configuration change. Another provider is one adapter file behind the provider interface.

## API documentation

Every endpoint, with access rules, request fields and limits, response shapes, error codes and rate limits, is documented in **[docs/api.md](docs/api.md)**.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Sign in; sets the session cookie |
| POST | `/api/auth/logout` | signed in | Sign out |
| GET | `/api/auth/me` | signed in | The current user |
| GET | `/api/author/books` | author | Own books, totals and payout threshold |
| GET | `/api/author/tickets` | author | Own tickets |
| POST | `/api/author/tickets` | author | Raise a query |
| GET | `/api/author/tickets/:id` | author | One own ticket with its replies |
| GET | `/api/admin/tickets` | admin | Queue with filters and paging |
| GET | `/api/admin/tickets/:id` | admin | Full ticket for the support team |
| PATCH | `/api/admin/tickets/:id` | admin | Status, category and priority overrides, assign to me |
| POST | `/api/admin/tickets/:id/messages` | admin | Reply to the author |
| POST | `/api/admin/tickets/:id/notes` | admin | Internal note |
| POST | `/api/admin/tickets/:id/drafts` | admin | Generate an AI draft |
| POST | `/api/admin/tickets/:id/classification` | admin | Retry AI classification |

Errors always use `{ "error": { "code", "message", "details"? } }`, with 400, 401, 403, 404, 409, 429, 503 or a generic 500.

## Security

- **Passwords and sessions:**
  - Passwords are hashed with bcrypt (cost 12). An unknown email still runs a password comparison, so response times don't reveal which accounts exist.
  - Sign-in returns one message for both a wrong password and an unknown email.
  - The session is an 8-hour HS256 JWT in the `bl_session` cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production. The algorithm is pinned, and issuer, audience, expiry and claims are checked on every request.
- **Access control:**
  - Every endpoint goes through `withApi`, which checks the role before any handler code runs.
  - Author queries are always filtered by the author ID from the token, never from the request.
  - Author responses list their fields explicitly, so internal notes, AI data, priority and assignee can't leak.
- **Input:**
  - Every body and query is validated with Zod, with length limits.
  - Unknown fields are rejected, so no one can submit an `authorId` or assign a ticket to someone else.
- **CSRF and headers:**
  - `SameSite=Lax`, plus a check that refuses cross-origin `POST`/`PATCH` requests. JSON bodies only.
  - Every response sets headers that refuse framing (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), plus `nosniff` and a strict referrer policy.
- **Rate limits:** 10 failed sign-ins per IP per 15 minutes, 10 new tickets per author per 10 minutes, and 30 AI requests per admin per 10 minutes. Over a limit, the API answers 429 with `Retry-After`.
- **Secrets:** read only on the server through `src/server/env.ts`. Nothing uses a `NEXT_PUBLIC_` prefix. No `.env` file, dataset or brief is committed.

## Testing

`npm test` runs 366 automated tests (Vitest) against a disposable local database, with synthetic data only. The real dataset is never used in tests, and the AI is replaced by a fake, so no tests call Gemini. They cover:
- **Access control:** a test lists every route file and fails unless each endpoint is in the access matrix. Every role (signed out, author, admin) is checked against every endpoint.
- **Ownership:** another author's tickets and books return 404 or a field error, and author responses never contain internal fields.
- **Validation:** limits, unknown fields, query parameters and the error envelope.
- **AI:** prompt contents and data minimisation, redaction, every failure type, background classification never overwriting admin choices, and the provider adapter's retry and timeout rules.
- **Rate limits,** including a burst of parallel requests that can't exceed a limit.
- **Seeding:** strict dataset validation, idempotent upserts and the read-only verification.

UI behaviour is checked by hand with [docs/test-checklist.md](docs/test-checklist.md).

## Known limitations

- **Gemini free tier:**
  - Quotas are per project and fairly low, and response times vary. On 31 Oct 2026, Gemini took 13–16 seconds even for a one-word reply, so some classifications hit the 15-second limit. Those tickets stay in "Needs triage" until an admin retries or classifies them by hand.
  - Rate-limited requests aren't retried automatically.
  - The unpaid terms let Google use prompts, which is why prompts are minimised.
- **Background classification isn't durable.** It runs after the response, inside the same serverless function. If the function is stopped mid-call, the ticket stays in "Needs triage", and nothing retries automatically except the admin's button.
- **Logout doesn't revoke the token.** A copy of the session token stays valid until it expires (8 hours). Role or account changes also take effect only at the next sign-in. The demo accounts are shared by everyone who uses them.
- **Basic rate limiting:**
  - Fixed windows, which allow a short burst at a window boundary.
  - The sign-in limit trusts the `x-forwarded-for` header, which Vercel sets itself; other hosts may pass a client-supplied value through.
  - People behind one office IP share the sign-in allowance.
  - Counter rows are never cleaned up.
- **Polling, not push.** Updates arrive within 5–15 seconds. Polling pauses while a tab is hidden or the browser is offline, and catches up on return.
- **AI drafts depend on human review.** Nothing automatically checks a draft against the facts. The admin, helped by the promises and checks lists, is the safeguard (ADR-0010). The priority rubric is our own assumption, calibrated on our test tickets.
- **The knowledge base lives in code.** A policy change needs a code change and a deploy.
- **Not in scope:**
  - Authors can't reply within a ticket or close one; they raise a new query.
  - Attachments aren't uploaded.
  - There are no email notifications.
  - Admin accounts are seeded, with no user management.
- **Times are shown in IST** for everyone.
- **Production data loading is manual.** `db:seed` and `db:verify` deliberately run only against the development database.

## Improvements with more time or budget

**AI**
- **A paid Gemini tier** (or another provider's paid API): predictable, higher rate limits; prompts not used for training, so less aggressive minimisation; and room for a stronger model for drafts. `gemini-3.8-flash` was too slow and often unavailable on the free tier.
- **A durable job queue for AI work:** retries with backoff, so a rate limit or timeout heals itself instead of waiting for an admin.
- **A proper retrieval (RAG) pipeline once the knowledge base grows:**
  - store articles in Postgres with an editor for the support team, so policies change without a deploy;
  - embed them with pgvector;
  - retrieve the most relevant passages, plus similar resolved tickets and their approved replies as examples.

  Today the whole knowledge base is about 1k tokens, so choosing sections by category is enough.
- **An automated groundedness check:** a second, cheap model call that compares each draft with the facts, and a fixed test set run in CI to catch prompt regressions.
- **Learning from admin edits:** compare each sent reply with its draft to see what admins change, and tune the prompts from that.

**Product**
- Author replies and closing tickets, real attachments stored in object storage, and email notifications when the team replies.
- Push updates (Server-Sent Events over a managed pub/sub, or Postgres `LISTEN/NOTIFY`) instead of polling.
- Named accounts for every support agent, password reset, and SSO for staff.

**Platform**
- Sessions that can be revoked (a session table or a per-user token version), and a shorter token lifetime with refresh.
- Monitoring: structured logs, error tracking, and a dashboard of AI cost and failure rates from `AiCallLog`, with alerts.
- Browser end-to-end tests (Playwright) and an OpenAPI spec generated from the Zod schemas.
- Rate limiting in Redis or at the edge once traffic grows, with sliding windows.

## Project documents

| Document | Contents |
|---|---|
| [docs/requirements.md](docs/requirements.md) | Requirements with IDs, dataset facts and how ambiguities were resolved |
| [docs/architecture.md](docs/architecture.md) | Full design: modules, data model, API, auth, AI, environment |
| [docs/api.md](docs/api.md) | API reference |
| [docs/adr/](docs/adr/README.md) | Architecture decision records |
| [docs/ai-eval.md](docs/ai-eval.md) | Latest prompt evaluation results |
| [docs/test-checklist.md](docs/test-checklist.md) | Manual browser checks |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Task plan and outcomes |
