# Implementation Plan

Requirement IDs are defined in `docs/requirements.md`. The design is in `docs/architecture.md`. Implement **one task at a time** (see `.claude/skills/implement-task`). Update the status column when a task starts, finishes or is blocked.

Status values: `todo` · `in-progress` · `done` · `blocked` · `deferred`

## Task board

| ID | Title | Prereqs | Status |
|---|---|---|---|
| T1.1 | Scaffold Next.js app and scripts | — | done |
| T1.2 | Strict TS, Prettier, Vitest baseline | T1.1 | todo |
| T1.3 | Env validation and secret hygiene | T1.2 | todo |
| T1.4 | Local dev/test Postgres (Docker) and Prisma client | T1.3 | todo |
| T1.5 | Initial schema and migration | T1.4 | todo |
| T1.6 | Seed exact dataset (authors, books) | T1.5 | todo |
| T1.7 | Guarded test-DB harness and seed verification | T1.6 | todo |
| T1.8 | Early deployment spike (recommended) | T1.7 | todo |
| T2.1 | HTTP foundation: errors, `withApi`, validation | T1.3 | todo |
| T2.2 | Password hashing and user seeding | T1.7 | todo |
| T2.3 | JWT sign/verify and cookie helpers | T1.3 | todo |
| T2.4 | Auth guards (API and pages) | T2.1, T2.3 | todo |
| T2.5 | Login, logout, me endpoints | T2.2, T2.4 | todo |
| T2.6 | Login page, proxy, portal shells | T2.5 | todo |
| T2.7 | Authorization test matrix (baseline) | T2.5 | todo |
| T3.1 | Shared labels, schemas, formatters | T1.5 | todo |
| T3.2 | Books API | T2.4, T3.1 | todo |
| T3.3 | Author dashboard and My Books UI | T2.6, T3.2 | todo |
| T3.4 | Ticket creation API | T2.4, T3.1 | todo |
| T3.5 | Author ticket read APIs | T3.4 | todo |
| T3.6 | New-ticket form UI | T2.6, T3.2, T3.4 | todo |
| T3.7 | My Tickets list and detail UI | T3.5, T2.6 | todo |
| T4.1 | Admin queue API with filters and sort | T3.4 | todo |
| T4.2 | Admin ticket detail API | T4.1 | todo |
| T4.3 | Admin queue UI | T4.1, T2.6 | todo |
| T4.4 | Ticket update API (status, overrides, assign to self) | T4.2 | todo |
| T4.5 | Internal notes API | T4.2 | todo |
| T4.6 | Admin response API | T4.2 | todo |
| T4.7 | Admin detail UI: context and management controls | T4.3, T4.4 | todo |
| T4.8 | Admin detail UI: notes and reply composer | T4.7, T4.5, T4.6 | todo |
| T5.1 | AI provider boundary and Gemini adapter | T1.5, T1.3 | todo |
| T5.2 | Knowledge-base module | T3.1 | todo |
| T5.3 | Classification service | T5.1, T5.2 | todo |
| T5.4 | Classification wiring and retry endpoint | T5.3, T3.4, T4.2 | todo |
| T5.5 | Royalty policy facts and draft context builder | T5.2, T3.2 | todo |
| T5.6 | Draft service and endpoint | T5.1, T5.5, T4.2 | todo |
| T5.7 | Draft safety post-check | T5.6 | todo |
| T5.8 | Admin draft UI | T5.6, T5.7, T4.8 | todo |
| T5.9 | Live prompt evaluation script | T5.3, T5.6 | todo |
| T6.1 | Polling for near-real-time updates | T3.7, T4.3, T4.8 | todo |
| T6.2 | Integration and error-state pass | T6.1, T5.8 | todo |
| T6.3 | AI failure drill | T6.2 | todo |
| T7.1 | Full quality gate | T6.3 | todo |
| T7.2 | Security review | T7.1 | todo |
| T7.3 | Manual end-to-end checklist | T7.1 | todo |
| T7.4 | Production deployment and seed | T7.2, T7.3 | todo |
| T7.5 | README and API documentation | T7.4 | todo |
| T7.6 | One-page write-up | T7.5 | todo |
| T7.7 | Submission | T7.6 | todo |

Dependencies drive the ordering, not phase numbers alone. T2.1 depends only on T1.3. T3.1, T5.1 and T5.2 do not depend on the UI, and can be pulled forward if a session has spare time.

---

## Phase 1 — Foundation

**Gate:** `npm run lint`, `typecheck`, `test` and `build` pass. Migrations apply to an empty DB. The seed loads exactly 10 authors and 18 books, and `verifySeed` passes. `.env` and the confidential files are git-ignored.
**Still unsatisfied after this phase:** all functional requirements, except DATA-01, DATA-02, DEL-09 and partly DEL-08.

### T1.1 Scaffold Next.js app and scripts
- **Reqs:** DEL-10 (foundation)
- **Scope:** `create-next-app` with TypeScript, App Router, Tailwind, ESLint, `src/` and the `@/*` alias, using npm. Remove the boilerplate. Add scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`). Pin the Node version (`engines` field plus `.nvmrc`).
- **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `src/app/{layout,page}.tsx`, `src/app/globals.css`, `.nvmrc`
- **Acceptance:** `npm run dev` serves a placeholder page. `lint`, `typecheck` and `build` pass. The Next major version is recorded in the README notes, and file conventions (`proxy.ts`) are confirmed for that version.
- **Verify:** run all four scripts.
- **Assumptions:** latest stable Next.js (16.x at planning time).
- **Outcome (2026-10-30):**
  - Next.js 16.4.3, React 19.3, Tailwind 4, ESLint 9.
  - `proxy.ts` is confirmed as the Next 16 convention.
  - `typecheck` runs `next typegen` first, because `LayoutProps` types are generated.
  - Cache Components and the auto-generated `AGENTS.md` are disabled in `next.config.ts`.
  - Only `src/app` exists so far. Other directories are created by the task that first needs them, so there are no empty placeholders.

### T1.2 Strict TS, Prettier, Vitest baseline
- **Reqs:** DEL-08
- **Prereqs:** T1.1
- **Scope:** `strict` plus `noUncheckedIndexedAccess`. Prettier with an ESLint-compatible config and `format` / `format:check` scripts. Vitest configured with path aliases (`vitest.config.ts`), a `test` script and one trivial passing test.
- **Acceptance:** `npm test` passes. `format:check` passes.
- **Verify:** run the scripts. Deliberately break formatting once to confirm the check fails.

### T1.3 Env validation and secret hygiene
- **Reqs:** AI-09, DEL-09
- **Prereqs:** T1.2
- **Scope:** `src/server/env.ts` (Zod schema, lazy parse, clear error listing the missing variable names). Install `server-only`. Write `.env.example` with every variable from architecture §8 and no real values. Confirm `.gitignore` covers `.env*`.
- **Acceptance:** a missing `DATABASE_URL` throws a readable error. A missing `GEMINI_API_KEY` is allowed (AI disabled). Importing `server/env` into a client component fails the build.
- **Verify:** unit test for env parsing. `git check-ignore .env` succeeds.

### T1.4 Local Postgres and Prisma client
- **Reqs:** DATA-01 (infrastructure)
- **Prereqs:** T1.3
- **Scope:** `docker-compose.yml` with `name: bookleaf` and two services, using the stock `postgres:16-alpine` image (see the architecture §8 table):
  - `db-dev`: container `bookleaf-db-dev`, port `127.0.0.1:55432`, database `bookleaf_dev`, named volume `bookleaf-db-dev-data`.
  - `db-test`: container `bookleaf-db-test`, port `127.0.0.1:55433`, database `bookleaf_test`, `tmpfs` storage.
  - Both have healthchecks.
  
  Install Prisma, `@prisma/adapter-pg` and `pg`. Write `prisma.config.ts` and `src/server/db.ts` (singleton, adapter). Use the generator `prisma-client` with output in `src/generated/prisma` (git-ignored). Confirm the Prisma 7 setup against current docs.
- **Acceptance:**
  - `docker compose up -d` starts only `bookleaf-*` containers; `docker compose ps` shows both as healthy.
  - No other project's containers or volumes are touched.
  - `npx prisma migrate status` connects to `bookleaf_dev`.
- **Verify:** manual commands. Record them in the README draft.

### T1.5 Initial schema and migration
- **Reqs:** DATA-01, DATA-02, MGMT-02, AI-03, AI-04, AI-06, AUTH-08
- **Prereqs:** T1.4
- **Scope:** all models, enums and indexes from architecture §3. Add a custom SQL step in the migration for the User role/authorId CHECK constraint.
- **Acceptance:** `prisma migrate dev` creates the schema. `prisma validate` passes. The priority enum is declared Critical→Low.
- **Verify:** inspect the generated SQL. Run a quick `psql \d "Ticket"`.

### T1.6 Seed exact dataset (authors, books)
- **Reqs:** DATA-01, DATA-02, BOOK-02, BOOK-03
- **Prereqs:** T1.5
- **Scope:** `prisma/seed.ts` reads `SEED_DATA_PATH` (default `./bookleaf_sample_data.json`) and parses it with a strict Zod schema that mirrors the JSON exactly (nullable fields as listed in requirements §12). It fails loudly on unexpected shape. It upserts Authors and Books by dataset ID, mapping snake_case to camelCase only, with no value changes. Register the seed in `prisma.config.ts` and add an `npm run db:seed` script.
- **Acceptance:** running the seed twice leaves exactly 10 authors and 18 books. Nulls stay null. ISBNs and titles are byte-identical.
- **Verify:** run the seed twice and check counts with `psql`.
- **Blocker:** the JSON must be present locally (it is git-ignored).

### T1.7 Test DB harness and seed verification
- **Reqs:** DATA-01, DATA-02, DEL-08
- **Prereqs:** T1.6
- **Scope:**
  - **Env:** `.env.test` (git-ignored) plus a committed `.env.test.example`. Vitest loads `.env.test` only.
  - **Guard:** `tests/helpers/assert-test-db.ts` aborts before any DB access unless `NODE_ENV=test` and the URL is `localhost`/`127.0.0.1:55433/bookleaf_test`.
  - **Setup:** Vitest `globalSetup` runs the guard, then `prisma migrate reset --force` and the seed.
  - **Verification:** `src/server/seed/verify.ts` exports `verifySeed(prisma, json)`, which compares every field of every record with the local JSON (counts, IDs, nulls, empty `available_on`, exact strings and numbers). `scripts/verify-seed.ts` (`npm run db:verify`) and an integration test both call it.
  - **Edge-case assertions:** in-production books, zero-paid books and below-threshold authors are checked, with expected values **derived from the JSON at runtime**. Dataset values are not hard-coded, because the repo is public.
- **Acceptance:** `npm test` passes, including the verification against the real test DB.
- **Verify:**
  - Corrupt one value in the test DB and confirm that verification fails.
  - Point `.env.test` at `bookleaf_dev` and confirm that the guard aborts before touching it.

### T1.8 Early deployment spike (recommended)
- **Reqs:** DEL-03 (de-risking)
- **Prereqs:** T1.7
- **Scope:** create the hosted production DB (Neon; separate from both local DBs) and the Vercel project (repo connected). Set env vars. Run `migrate deploy` in the build. Seed from local and run `db:verify` against production. Deploy the placeholder page.
- **Acceptance:** the live URL serves the page, and `db:verify` passes against the production DB.
- **Blockers:** needs Vercel and Neon accounts, and production env vars (`DATABASE_URL`, `AUTH_JWT_SECRET`, `GEMINI_API_KEY`) set only in Vercel.
- **Why early:** a Prisma 7 adapter, pooled-URL or build problem found on the last day is the biggest schedule risk.

---

## Phase 2 — Authentication and access control

**Gate:** all seeded users can log in and out. Unauthenticated and wrong-role requests are rejected on every existing route. Page redirects work. Passwords are stored as bcrypt hashes. The JWT exists only in the HttpOnly cookie.
**Still unsatisfied:** BOOK-\*, TICKET-\*, QUEUE-\*, AI-\*, DRAFT-\*, MGMT-\*, RT-\*, most DEL-\*. AUTH-06 (cross-author) is completed incrementally: each Phase 3 and 4 endpoint task includes its own ownership tests, because the owned resources do not exist yet.

### T2.1 HTTP foundation
- **Reqs:** API-02, API-03, API-05
- **Prereqs:** T1.3
- **Scope:** `src/server/http/`: `ApiError` subclasses, `errorResponse()`, `withApi(handler, { role? })`, `parseJson(req, schema)`, `parseQuery(url, schema)`, origin and content-type checks for mutations, and a mapping for Zod errors (to 400 with field details), Prisma not-found (to 404) and unknown errors (to a logged 500 with a generic message). The role option is a stub until T2.4.
- **Acceptance:** unit tests cover each mapping and the cross-origin POST → 403.
- **Verify:** `npm test`.

### T2.2 Password hashing and user seeding
- **Reqs:** AUTH-01, AUTH-02, AUTH-08, DEL-04
- **Prereqs:** T1.7
- **Scope:** `server/auth/password.ts` (`bcryptjs`, cost 12, `hash` and `verify`). Extend the seed: one AUTHOR user per dataset author (email copied from the dataset, linked by `authorId`, password from `SEED_AUTHOR_PASSWORD`), plus two ADMIN users with documented `@bookleaf.example` emails (password from `SEED_ADMIN_PASSWORD`). Re-running the seed does not change existing hashes unless `--reset-passwords` is passed.
- **Acceptance:** 12 users exist, the CHECK constraint holds, and no plaintext is stored. `verifySeed` also checks the user↔author links.
- **Verify:** unit test for password functions. The seed verification test passes.

### T2.3 JWT sign/verify and cookie helpers
- **Reqs:** AUTH-03, AUTH-04, AUTH-08
- **Prereqs:** T1.3
- **Scope:** install `jose`.
  - `server/auth/jwt.ts`: `signAuthToken(user)` produces an HS256 token with `sub`, `role`, `authorId`, `iss`, `aud` and an 8-hour `exp`. `verifyAuthToken(token)` returns `AuthUser | null`; it pins the algorithm, checks issuer, audience and expiry, and validates the claims with Zod.
  - `server/auth/cookie.ts`: `setAuthCookie(res, token)` and `clearAuthCookie(res)`, with `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/` and `Max-Age`.
  - `AUTH_JWT_SECRET` comes from `server/env.ts`.
- **Acceptance:** unit tests reject each of these: a tampered signature, a token signed with another secret, `alg: none` or another algorithm, an expired token, a wrong issuer or audience, an invalid role, and an AUTHOR without `authorId`. A valid token round-trips. Cookie flags are asserted for both production and development.
- **Verify:** `npm test`, with the clock mocked for the expiry test.

### T2.4 Auth guards
- **Reqs:** AUTH-04, AUTH-05, AUTH-07
- **Prereqs:** T2.1, T2.3
- **Scope:** `getUserFromRequest(req)` and `getUserFromCookies()`, both built on `verifyAuthToken`. Complete `withApi({ role })`, which injects `ctx.user` (including `authorId` for authors, taken only from the verified token). Add `requireUser(role)` for server layouts (redirect to `/login`, or to the user's own portal on a wrong role).
- **Acceptance:** a handler wrapped with `role: 'ADMIN'` returns 401 with no cookie and 403 with an author cookie.
- **Verify:** unit and integration tests with an auth-cookie factory helper (`tests/helpers/auth.ts`).

### T2.5 Login, logout, me endpoints
- **Reqs:** AUTH-01–04
- **Prereqs:** T2.2, T2.4
- **Scope:** `api/auth/login` (Zod body, generic 401, dummy compare for an unknown email), `api/auth/logout`, `api/auth/me`.
- **Acceptance:**
  - The login cookie has the correct flags.
  - The response body never contains the token.
  - Logout returns a `Set-Cookie` that clears the cookie (`Max-Age=0`).
  - `/me` returns the role and authorId.
- **Verify:** integration tests cover a valid login, wrong password, unknown email, malformed body, the logout cookie-clearing header, and a request without a cookie after logout (401).

### T2.6 Login page, proxy, portal shells
- **Reqs:** AUTH-07, BOOK-05 (shell)
- **Prereqs:** T2.5
- **Scope:** `/login` form (client component calling the API, with error and loading states), redirect by role after login. `src/proxy.ts` verifies the JWT (no DB access) only to redirect logged-out or wrong-role users. `author/layout.tsx` and `admin/layout.tsx` provide guards and nav with logout. `/` redirects by role.
- **Acceptance:** manual check that the author lands on `/author` and the admin on `/admin`, that cross-portal URLs redirect, and that logout returns to `/login`.
- **Verify:** manual browser check. Document it in the T7.3 checklist.

### T2.7 Authorization test matrix (baseline)
- **Reqs:** AUTH-04, AUTH-05
- **Prereqs:** T2.5
- **Scope:** `tests/integration/authz.test.ts` is a table-driven matrix of every route × {no cookie, author, admin} → expected status. New routes must be added to it, and later tasks extend it.
- **Acceptance:** the matrix passes for the existing routes. The test fails if a route file exists but is missing from the matrix (it globs `src/app/api/**/route.ts`).
- **Verify:** `npm test`.

---

## Phase 3 — Author workflows

**Gate:** an author can view the dashboard and books (including edge-case books), create a ticket, list their tickets and view one. Cross-author tests pass for books and tickets. Every page has loading, empty and error states.
**Still unsatisfied:** QUEUE-\*, MGMT-\*, AI-\*, DRAFT-\*, RT-01 (manual refresh only), DEL-\*.

### T3.1 Shared labels, schemas, formatters
- **Reqs:** BOOK-06, TICKET-04, API-02
- **Prereqs:** T1.5
- **Scope:** `src/lib/labels.ts` (enum to label maps from requirements §11), `src/lib/schemas/*.ts` (Zod request schemas shared by the form and the API: ticket create, admin patch, message, note, queue query), `src/lib/format.ts` (INR with en-IN grouping, date formatting, null-safe "—").
- **Acceptance:** unit tests cover the formatters (₹57,744; null → "—") and the schema limits.
- **Verify:** `npm test`.

### T3.2 Books API
- **Reqs:** BOOK-01–05, AUTH-06
- **Prereqs:** T2.4, T3.1
- **Scope:** `server/services/books.ts` `listBooksForAuthor(authorId)` returns the 15 fields plus totals. `GET /api/author/books`.
- **Acceptance:** AUTH007 gets all three of its books, including the in-production BK013. The totals equal the sums of that author's values in the local JSON (computed in the test, not hard-coded). Another author's books never appear. An admin gets 403.
- **Verify:** integration tests. Add the route to the authz matrix.

### T3.3 Author dashboard and My Books UI
- **Reqs:** BOOK-01–07
- **Prereqs:** T2.6, T3.2
- **Scope:** `/author` page with summary cards and a books table (cards on narrow screens). Handle the in-production badge, "Not yet published", "No payout yet" and the threshold hint. Add a link to "Raise a query". Use the SWR fetcher in `lib/api-client.ts`.
- **Acceptance:** check AUTH007 and AUTH009 visually: no `null`, `NaN` or "Invalid Date". Loading and error states render.
- **Verify:** manual browser check with AUTH007, AUTH009 and AUTH002.

### T3.4 Ticket creation API
- **Reqs:** TICKET-01, TICKET-04, TICKET-05, AUTH-06
- **Prereqs:** T2.4, T3.1
- **Scope:** `server/services/author-tickets.ts` `createTicket(authorId, input)`: verify `bookId` ownership (or null), insert with OPEN and PENDING, and call a no-op `onTicketCreated(id)` hook (wired in T5.4). Route `POST /api/author/tickets`.
- **Acceptance:** 201 with the ticket DTO. Another author's bookId gets 400 with a field error. An empty subject gets 400.
- **Verify:** integration tests. Update the authz matrix.

### T3.5 Author ticket read APIs
- **Reqs:** TICKET-06–08, AUTH-06
- **Prereqs:** T3.4
- **Scope:** `listTicketsForAuthor` and `getTicketForAuthor` with explicit `select` DTOs (no notes, drafts, priority, AI fields or assignee). Routes `GET /api/author/tickets` and `GET /api/author/tickets/[id]`.
- **Acceptance:** another author's ticket ID gets 404. A test seeds a note, a draft and AI fields, then asserts that none appear in the response.
- **Verify:** integration tests.

### T3.6 New-ticket form UI
- **Reqs:** TICKET-01, TICKET-02, TICKET-04
- **Prereqs:** T2.6, T3.2, T3.4
- **Scope:** `/author/tickets/new`. Book select (own books plus "General / Account Level", with in-production books labelled), subject, description with a character count, and an attachment picker that lists file names with the notice "Attachments aren't uploaded in this version". Client validation uses the shared schema, server field errors are mapped onto fields, the submit button is disabled while pending, and success redirects to the ticket detail.
- **Acceptance:** the form submits, and validation errors appear inline.
- **Verify:** manual check, including a forced 400 from the server.

### T3.7 My Tickets list and detail UI
- **Reqs:** TICKET-06, TICKET-07
- **Prereqs:** T3.5, T2.6
- **Scope:** `/author/tickets` (status badges, book name, last update, empty state with a call to action) and `/author/tickets/[id]` (original query and response thread, status, not-found state).
- **Acceptance:** manual check. An empty state appears for an author with no tickets.
- **Verify:** manual check. Polling is added in T6.1.

**First end-to-end milestone after Phase 4's T4.1, T4.2, T4.6 and T4.8 (see Delivery strategy).**

---

## Phase 4 — Admin workflows

**Gate:** an admin can see all tickets, filter and sort them, open one, change status, category and priority, assign to self, add notes and send a manual reply that the author can see. All of this works with AI disabled.
**Still unsatisfied:** AI-01/02/05–08, DRAFT-\*, RT-\*, DEL-\*.

### T4.1 Admin queue API with filters and sort
- **Reqs:** QUEUE-01–05
- **Prereqs:** T3.4
- **Scope:** `server/services/admin-tickets.ts` `listQueue(query)`. Filters: status (multi), category, priority, `unclassified`, `assignee=me|none`, created-date `from`/`to` (inclusive, start and end of day in UTC). The default is unresolved. Sort: priority asc with nulls first, then createdAt asc. Pagination. Route `GET /api/admin/tickets`.
- **Acceptance:** tests create a fixture set and assert each filter, the combination of filters, the default ordering (Critical before High before Low; older first within a priority; unclassified first) and invalid query handling (400).
- **Verify:** integration tests. Update the authz matrix.

### T4.2 Admin ticket detail API
- **Reqs:** QUEUE-01, MGMT-02, DRAFT-01 (shape)
- **Prereqs:** T4.1
- **Scope:** `GET /api/admin/tickets/[id]` returns the ticket, author summary (name, email, city), book record, messages, notes, latest draft (null for now) and AI metadata.
- **Acceptance:** 404 for an unknown ID. An author gets 403.
- **Verify:** integration tests.

### T4.3 Admin queue UI
- **Reqs:** QUEUE-01–04
- **Prereqs:** T4.1, T2.6
- **Scope:** `/admin` table. Filters are stored in URL search params so views can be bookmarked. Show priority and status badges, an age badge ("3d"), the assignee, "Needs triage" for null category or priority, and an "Assigned to me" quick filter.
- **Acceptance:** manual check. Filters round-trip through the URL.
- **Verify:** manual check.

### T4.4 Ticket update API
- **Reqs:** MGMT-01, MGMT-03, AI-03, AI-04
- **Prereqs:** T4.2
- **Scope:** `PATCH /api/admin/tickets/[id]` accepts a partial body `{status, category, priority, assignToMe: true}`. `assignToMe` sets the assignee to the calling admin; there is no field for assigning anyone else (MGMT-03). AI suggestion fields are untouched.
- **Acceptance:** tests cover each field, an unknown field such as `assigneeId` (400, strict schema), an empty body (400) and the AI-suggested values being preserved after an override.
- **Verify:** integration tests.

### T4.5 Internal notes API
- **Reqs:** MGMT-02, TICKET-08
- **Prereqs:** T4.2
- **Scope:** `POST /api/admin/tickets/[id]/notes`.
- **Acceptance:** the note appears in admin detail and never in the author detail (asserted).
- **Verify:** integration tests.

### T4.6 Admin response API
- **Reqs:** MGMT-04, MGMT-05, DRAFT-03
- **Prereqs:** T4.2
- **Scope:** `POST /api/admin/tickets/[id]/messages` takes `{body, aiDraftId?, status?}`. Message creation and the status change happen in one transaction. Open moves to In Progress unless a status is given. `aiDraftId` must belong to this ticket.
- **Acceptance:** the author detail endpoint returns the message. The status transition is correct.
- **Verify:** integration tests.

### T4.7 Admin detail UI: context and management controls
- **Reqs:** MGMT-01, MGMT-03, AI-03, AI-04
- **Prereqs:** T4.3, T4.4
- **Scope:** `/admin/tickets/[id]`. The left side shows the thread and query. The right panel shows author and book facts (the same facts the AI will see), status, category and priority selects (with the "AI suggested X" hint) and an "Assign to me" button.
- **Acceptance:** each control persists its value, and errors are shown.
- **Verify:** manual check.

### T4.8 Admin detail UI: notes and reply composer
- **Reqs:** MGMT-02, MGMT-04
- **Prereqs:** T4.7, T4.5, T4.6
- **Scope:** an internal notes panel with clearly different styling ("Only visible to BookLeaf team"). A reply composer with an optional status-after-send select. This is manual-only in this task.
- **Acceptance:** a manual reply sent here appears in the author view after a refresh.
- **Verify:** manual check with two browsers.

---

## Phase 5 — AI integration

**Gate:** with a valid key, new tickets are classified and admins get grounded drafts. With the key missing, invalid, timing out or returning malformed output, ticket creation and manual handling still work and the UI explains the state. All AI tests run offline with fakes.
**Still unsatisfied:** RT-\*, DEL-01, DEL-03 to DEL-07.

### T5.1 AI provider boundary and Gemini adapter
- **Reqs:** AI-05, AI-07, AI-08, AI-09
- **Prereqs:** T1.3, T1.5
- **Scope:** `server/ai/provider.ts` (interface and `AiError`), `server/ai/gemini.ts` (`@google/genai`; Zod to JSON Schema via `z.toJSONSchema`; timeout via AbortSignal; one retry on provider errors only; `usageMetadata` read), `logAiCall()` writing `AiCallLog`, `getGenerator()` returning a disabled generator when there is no key, and `tests/helpers/fake-ai.ts`.
- **Acceptance:** unit tests with the SDK mocked map a 429 to `RATE_LIMITED`, an abort to `TIMEOUT`, non-JSON or schema mismatch to `INVALID_OUTPUT`, a 5xx to a single retry then `PROVIDER_ERROR`, and a missing key to `DISABLED`. A one-off manual call with a real key succeeds.
- **Verify:** `npm test`. Run a manual smoke script once.
- **Blockers:** `GEMINI_API_KEY`. Verify current model IDs, structured-output config fields and free-tier limits in the docs first.

### T5.2 Knowledge-base module
- **Reqs:** DRAFT-04, DRAFT-06, DRAFT-07
- **Prereqs:** T3.1
- **Scope:** `server/ai/knowledge-base.ts` is a small structured module. It holds the policy facts from requirements §14, summarised in our own words and grouped by section (company, royalty, isbn, printing, distribution, production, metadata, tone), plus per-category handling guidance. It also exports `sectionsForCategory(category | null)`. The brief's text and sample responses are not copied, and no policies are added.
- **Acceptance:** tests confirm that every category maps to at least one policy section and its sample(s), that tone and company are always included, and that null returns all policy sections.
- **Verify:** `npm test`. Manually check each figure and timeline against the local PDF: 80/20 split, quarterly cycle, 45 days, ₹1,000, 5–7, 7–10, 24–48 and 3–5 business days, 48 hours.

### T5.3 Classification service
- **Reqs:** AI-01, AI-02, AI-05, AI-06, AI-08, DRAFT-09
- **Prereqs:** T5.1, T5.2
- **Scope:** `server/ai/classify.ts`: prompt (versioned constant), schema `{category, priority, rationale}`, `classifyTicket(ticketId, generator)`. It always sets the AI fields, sets the effective fields only where they are null (conditional `updateMany`), and moves `classificationStatus` to SUCCEEDED or FAILED.
- **Acceptance:** fake-provider tests cover success, out-of-enum output (FAILED, nothing written), timeout (FAILED) and an admin override made before completion (preserved).
- **Verify:** `npm test`.

### T5.4 Classification wiring and retry endpoint
- **Reqs:** AI-01, AI-07, TICKET-05, QUEUE-04
- **Prereqs:** T5.3, T3.4, T4.2
- **Scope:** `server/ai/background.ts` (`scheduleBackground`, which wraps `after`). Wire `onTicketCreated` to it. Add `POST /api/admin/tickets/[id]/classification` (synchronous retry, returns the updated ticket, 503 on failure).
- **Acceptance:** an integration test with a failing generator still gets a 201 from creation and the ticket is FAILED. The retry with a succeeding fake classifies it. Exactly one generator call is made per creation.
- **Verify:** `npm test`. Manual check with a real key that a new ticket is classified within seconds.

### T5.5 Royalty policy facts and draft context builder
- **Reqs:** DRAFT-04, DRAFT-07, BOOK-07
- **Prereqs:** T5.2, T3.2
- **Scope:** `server/policies/royalty.ts` (`payoutDeadlineFor(date)`, `isBelowThreshold(totalPending)`, `neverPaid(book)`). `server/ai/draft-context.ts` `buildDraftContext(ticketId)` returns `{ facts, kbSections, ticketText, recentReplies }` with truncation limits and no notes or PII.
- **Acceptance:** unit tests: 2026-10-27 gives a deadline of 2026-11-14 for Q3, and 2026-12-10 gives 2027-02-14 for Q4; BK013 context says "In Production - Cover Design" with no MRP; AUTH009 is flagged below threshold; a General ticket lists the compact books; phone and email are absent; notes are absent; the serialised size is under a set bound.
- **Verify:** `npm test`.

### T5.6 Draft service and endpoint
- **Reqs:** DRAFT-01, DRAFT-04–09, AI-08
- **Prereqs:** T5.1, T5.5, T4.2
- **Scope:** `server/ai/draft.ts`: versioned system prompt (role, tone rules, guardrails from architecture §6.4, delimited untrusted input) and schema `{reply, commitments[], needsVerification[]}`. Persist an `AiDraft`. Add `POST /api/admin/tickets/[id]/drafts`, and include the latest draft (with a `stale` flag) in admin detail.
- **Acceptance:** fake-provider tests: the draft is stored and returned; a failure returns 503 `AI_UNAVAILABLE` and stores nothing; prompt snapshot tests confirm the category-specific KB section is present, others are absent, and notes are absent.
- **Verify:** `npm test`. Manual check with a real key on 3 different categories.

### T5.7 Draft safety post-check
- **Reqs:** DRAFT-05
- **Prereqs:** T5.6
- **Scope:** `server/ai/safety.ts` `checkDraft(reply, context)` returns `warnings[]`. It covers ₹ amounts or numbers not present in the context and a small list of completed-action patterns. Warnings are stored on `AiDraft`.
- **Acceptance:** unit tests show that "₹5,000 has been credited" with no such fact produces 2 warnings, and that a clean draft produces none.
- **Verify:** `npm test`.

### T5.8 Admin draft UI
- **Reqs:** DRAFT-01, DRAFT-02, DRAFT-05, DRAFT-08
- **Prereqs:** T5.6, T5.7, T4.8
- **Scope:** on opening a ticket with no draft (or a stale one), the client POSTs a draft request once and shows a "Drafting…" state. The draft fills the composer for editing. Commitments are shown as a confirm checklist, and needs-verification items and warnings are listed above the editor. A "Regenerate" button. On failure, a banner says "AI draft unavailable — write a reply manually". Sending passes `aiDraftId`. Add a "Retry classification" button for triage tickets.
- **Acceptance:** manual check with a real key and with AI disabled.
- **Verify:** manual check.

### T5.9 Live prompt evaluation script
- **Reqs:** AI-02, DRAFT-06 (evidence for the README)
- **Prereqs:** T5.3, T5.6
- **Scope:** `scripts/ai-eval.ts` (manual, paid, not in CI) runs our own paraphrased test queries through classification, and optionally through drafting against chosen seeded books. There are at least 9: at least one per category, plus a missing-royalty versus profile-update priority pair. The brief's sample queries are not copied. It prints expected and actual results. Summarise the results in the README.
- **Acceptance:** at least 7 of 9 categories match. The long-missing-royalty query ranks above the profile-update query. No draft states a completed action. Mismatches are analysed and the prompt adjusted, or the reason documented.
- **Verify:** run once and save a summary to `docs/ai-eval.md`.

---

## Phase 6 — Integration and near-real-time

**Gate:** an admin reply or status change appears in the author's view without a reload. Every UI path uses real endpoints. AI failure has been demonstrated not to block anything.
**Still unsatisfied:** DEL-01 and DEL-03 to DEL-07.

### T6.1 Polling for near-real-time updates
- **Reqs:** RT-01, RT-02
- **Prereqs:** T3.7, T4.3, T4.8
- **Scope:** SWR `refreshInterval` on the author ticket detail and list (5 s), the admin queue (15 s) and the admin detail (10 s). Polling pauses while the tab is hidden. The admin composer is protected so polling never clobbers draft text being edited.
- **Acceptance:** with two browsers, an admin reply appears in the author view within about 5 s without a reload.
- **Verify:** manual check. Optionally record it with Chrome DevTools.

### T6.2 Integration and error-state pass
- **Reqs:** API-01, API-03, EV (product thinking)
- **Prereqs:** T6.1, T5.8
- **Scope:** confirm there is no mock data. A 401 from any fetch redirects to `/login`. 403, 404 and 5xx states are friendly. Check the empty states. Check navigation and logout.
- **Acceptance:** each case on the checklist has been exercised once.
- **Verify:** manual check, plus `npm test`.

### T6.3 AI failure drill
- **Reqs:** AI-07, DRAFT-08, TICKET-05, MGMT-04
- **Prereqs:** T6.2
- **Scope:** run locally with (a) no key, (b) an invalid key and (c) a 1 ms timeout setting. Create a ticket, triage it manually, send a manual reply. Check that `AiCallLog` outcomes are correct.
- **Acceptance:** all three scenarios complete the full ticket lifecycle.
- **Verify:** manual check. Record the results in the README limitations or error-handling section.

---

## Phase 7 — Verification and delivery

**Gate:** all mandatory requirements pass, or are explicitly documented as limitations. The live demo works with the README credentials. The collaborator is added. `git ls-files` shows no confidential files.

### T7.1 Full quality gate
- **Reqs:** DEL-08, DEL-10
- **Prereqs:** T6.3
- **Scope:** run `lint`, `typecheck`, `format:check`, `test` and `build` clean. Remove dead code. Check that comments explain the "why" where it is non-obvious.
- **Verify:** run the `verify-delivery` skill.

### T7.2 Security review
- **Reqs:** AUTH-\*, AI-09, API-05, DEL-09
- **Prereqs:** T7.1
- **Scope:** run the `review-security` skill and fix the findings. Run a secret scan (`git grep` for key patterns and a client bundle grep).
- **Verify:** the findings are resolved or documented.

### T7.3 Manual end-to-end checklist
- **Reqs:** all functional requirements
- **Prereqs:** T7.1
- **Scope:** `docs/test-checklist.md` lists each author and admin workflow, the edge-case books (AUTH007, AUTH009, AUTH003), real-time behaviour and AI-down mode. Run it locally.
- **Verify:** the checklist is ticked.

### T7.4 Production deployment and seed
- **Reqs:** DEL-03, DEL-04
- **Prereqs:** T7.2, T7.3
- **Scope:** set production env vars, `migrate deploy`, seed from local, run `db:verify` against production, then re-run the T7.3 checklist on the live URL. Note the AI quota.
- **Verify:** the live checklist passes.

### T7.5 README and API documentation
- **Reqs:** DEL-04–06, API-04
- **Prereqs:** T7.4
- **Scope:** the README covers setup, credentials, live URL, architecture summary (linking the ADRs), AI integration (prompt strategy, grounding, safety, error handling, cost controls with `AiCallLog` evidence, eval summary), model choice, testing, and limitations and improvements. `docs/api.md` documents every endpoint. Check it against the route files.
- **Verify:** `verify-delivery` checks that every route is documented.

### T7.6 One-page write-up
- **Reqs:** DEL-07
- **Prereqs:** T7.5
- **Scope:** `docs/write-up.md` covers priorities, trade-offs and the production evolution (job queue, SSE or pub/sub, rate limiting, attachments via object storage, AI evaluation set and feedback loop, observability). At most about 500 words.

### T7.7 Submission
- **Reqs:** DEL-01, DEL-02
- **Prereqs:** T7.6
- **Scope:** confirm that no confidential files or verbatim brief text are committed (the repo is public per HR), add the reviewer collaborator (email pending from BookLeaf), review the commit history, and check that the README live URL works from an incognito window.

---

## Deferred / optional backlog

These are not required and should only be picked up if mandatory work is complete:
- Real attachment upload (TICKET-03, bonus).
- Author replies and closing tickets (TICKET-09).
- Login rate limiting.
- `seed:demo-tickets` with our own example queries (demo convenience; not part of the dataset).
- OpenAPI spec.
- Playwright E2E.
- SSE.
- Composite FK for ticket book ownership.

## Delivery strategy

**Smallest viable end-to-end milestone.** Author login → create ticket → admin sees it in the queue → admin sends a manual reply → the author sees it after a refresh. The path is: Phase 1, Phase 2, T3.1, T3.4, T3.5, T3.7, T4.1, T4.2, T4.6 and a minimal T4.8. This proves auth, ownership, the data model and the API conventions before any AI work. Every later task adds to a working system.

**Deferrable without violating mandatory requirements.** Everything in the deferred backlog, plus the recommended items: BOOK-06/07 polish, QUEUE-05 pagination, RT-02 admin polling, the T5.7 safety post-check (the prompt guardrails and human review remain), T5.9 (but the README must still evidence the AI design), and T1.8 (folded into T7.4). Do **not** defer AI classification, drafting, graceful degradation, polling on the author view, or API docs. These are mandatory and carry the most evaluation weight.

**Highest-risk requirements and early validation.**

| Risk | Early validation |
|---|---|
| Deployment friction (Prisma 7 adapter, pooled URLs, env) | T1.8 deploys the skeleton and seed in Phase 1 |
| Gemini availability, model IDs, rate limits, structured-output fields | T5.1 smoke call as soon as a key exists. It can run right after T1.5, in parallel with Phases 2–4 if needed |
| Cross-author data leaks | Ownership tests inside every endpoint task, plus the T2.7 route matrix that fails on unlisted routes |
| AI hallucinating facts or claiming completed actions | Allow-listed context (T5.5), structured `commitments` (T5.6), post-check (T5.7), eval (T5.9) |
| AI failure blocking ticket flow | AI is only invoked after the insert commits (T5.4). Drill in T6.3 |
| Dataset drift from the "exact records" requirement | Field-by-field `verifySeed` in tests and against production |

**Local development workflow.**
1. `docker compose up -d` (starts only the `bookleaf-*` containers), then `npm run dev`.
2. Work task by task with `/implement-task <ID>`: check prerequisites, implement, run `npm test` and `npm run lint`, then update this board.
3. Make one commit per task, with a message that references the task ID.
4. Use the real Gemini key only for manual checks and `ai-eval`. All tests use fakes.

**Keeping to a few focused sessions** (grouping, not estimates):

| Session | Tasks |
|---|---|
| 1 | Phase 1, plus T2.1 |
| 2 | Rest of Phase 2, plus T3.1–T3.5 (APIs first) |
| 3 | T3.6–T3.7 and Phase 4, ending at the E2E milestone |
| 4 | Phase 5 |
| 5 | Phase 6 and T7.1–T7.4 |
| 6 | Docs (T7.5–T7.7) |

If a session overruns, cut from the deferrable list above, never from testing (T7.1–T7.3) or deployment (T7.4).
