# Implementation Plan

Requirement IDs are defined in `docs/requirements.md`. The design is in `docs/architecture.md`. Implement **one task at a time** (see `.claude/skills/implement-task`), following the rules in `CLAUDE.md`. Update the status column when a task starts, finishes or is blocked.

Status values: `todo` · `in-progress` · `done` · `blocked` · `deferred`

## Task board

| ID | Title | Prereqs | Status |
|---|---|---|---|
| T1.1 | Scaffold Next.js app and scripts | — | done |
| T1.2 | Strict TS, Prettier, Vitest baseline | T1.1 | done |
| T1.3 | Env validation and secret hygiene | T1.2 | done |
| T1.4 | Local dev/test Postgres (Docker) and Prisma client | T1.3 | done |
| T1.5 | Initial schema and migration | T1.4 | done |
| T1.6 | Seed exact dataset (authors, books) | T1.5 | done |
| T1.7 | Guarded test-DB harness and seed verification | T1.6 | done |
| T1.8 | Neon development database | T1.7 | done |
| T2.1 | HTTP foundation: errors, `withApi`, validation | T1.3 | done |
| T2.2 | Password hashing and user seeding | T1.7 | done |
| T2.3 | JWT sign/verify and cookie helpers | T1.3 | done |
| T2.4 | Auth guards (API and pages) | T2.1, T2.3 | done |
| T2.5 | Login, logout, me endpoints | T2.2, T2.4 | done |
| T2.6 | Login page, proxy, portal shells | T2.5 | done |
| T2.7 | Authorization test matrix (baseline) | T2.5 | done |
| T3.1 | Shared labels, schemas, formatters | T1.5 | done |
| T3.2 | Books API | T2.4, T3.1 | done |
| T3.3 | Author dashboard and My Books UI | T2.6, T3.2 | done |
| T3.4 | Ticket creation API | T2.4, T3.1 | done |
| T3.5 | Author ticket read APIs | T3.4 | done |
| T3.6 | New-ticket form UI | T2.6, T3.2, T3.4 | done |
| T3.7 | My Tickets list and detail UI | T3.5, T2.6 | done |
| T4.1 | Admin queue API with filters and sort | T3.4 | done |
| T4.2 | Admin ticket detail API | T4.1 | done |
| T4.3 | Admin queue UI | T4.1, T2.6 | done |
| T4.4 | Ticket update API (status, overrides, assign to self) | T4.2 | done |
| T4.5 | Internal notes API | T4.2 | done |
| T4.6 | Admin response API | T4.2 | done |
| T4.7 | Admin detail UI: context and management controls | T4.3, T4.4 | done |
| T4.8 | Admin detail UI: notes and reply composer | T4.7, T4.5, T4.6 | done |
| T5.1 | AI provider boundary and Gemini adapter | T1.5, T1.3 | done |
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
| T7.7 | Handover | T7.6 | todo |

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
- **Scope:** `strict` plus `noUncheckedIndexedAccess`. Prettier with an ESLint-compatible config and `format` / `format:check` scripts. Vitest configured with path aliases (`vitest.config.mts`), a `test` script and one trivial passing test.
- **Acceptance:** `npm test` passes. `format:check` passes.
- **Verify:** run the scripts. Deliberately break formatting once to confirm the check fails.
- **Outcome (2026-10-30):**
  - **Tooling:** Prettier 3 with default options. `eslint-config-prettier/flat` is the last ESLint config entry. Markdown and the lockfile are excluded from Prettier.
  - **Vitest:** 4.1.12 rather than 5.x, because Vitest 5's `engines` field excludes Node 25, which is the owner's local version. Vitest 4 supports both Node 24 and 25. Vite 8 is installed explicitly as Vitest's required peer.
  - **Config:** the `@` alias is set in `vitest.config.mts` (`.mts` avoids Vite's CommonJS-config warning).
  - **Probes:** a badly formatted file fails `format:check`, `noUncheckedIndexedAccess` flags unchecked indexing, and a failing test makes `npm test` exit 1.

### T1.3 Env validation and secret hygiene
- **Reqs:** AI-09, DEL-09
- **Prereqs:** T1.2
- **Scope:** `src/server/env.ts` (Zod schema, lazy parse, clear error listing the missing variable names). Install `server-only`. Write `.env.example` with every variable from architecture §8 and no real values. Confirm `.gitignore` covers `.env*`.
- **Acceptance:** a missing `DATABASE_URL` throws a readable error. A missing `GEMINI_API_KEY` is allowed (AI disabled). Importing `server/env` into a client component fails the build.
- **Verify:** unit test for env parsing. `git check-ignore .env` succeeds.
- **Outcome (2026-10-30):**
  - `src/server/env.ts` exports `parseEnv`, a lazily memoised `getEnv` and `requireEnv`. All variables are optional but validated when set, so features fail at the point of use, not at startup.
  - Dependencies added: `zod` and `server-only`. Vitest aliases `server-only` to its no-op build.
  - `.env.example` contains placeholders only.
  - Verified: 9 env unit tests; error messages contain no values; a temporary client page importing `env.ts` failed `next build`; all `.env*` variants are ignored except `.env.example`.

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
- **Outcome (2026-10-30):**
  - **Versions:** `prisma`, `@prisma/client` and `@prisma/adapter-pg` are pinned to exactly 7.10.1. The CLI's npm `latest` tag points to an 8.0 release candidate, so pinning keeps the three in lockstep.
  - **`pg`:** not installed directly. The adapter depends on it, and our code never imports it.
  - **Config:** `prisma.config.ts` loads `.env` with Node's built-in `process.loadEnvFile` (no `dotenv` dependency). `schema.prisma` contains only the generator and datasource; models arrive in T1.5.
  - **Database client:** `getDb()` creates the Prisma client lazily, as a singleton on `globalThis`.
  - **Scripts:** `postinstall` runs `prisma generate`. Added `db:up` and `db:down`. `engines` raised to `>=20.19.0` to match Prisma's minimum.
  - **Verified:**
    - Both containers are healthy, and only `bookleaf-*` resources were created (other projects untouched).
    - `prisma generate` succeeds with no `.env`.
    - `prisma migrate status` reaches `bookleaf_dev`.
    - A throwaway probe ran a raw query through `getDb()` against `bookleaf_test`.

### T1.5 Initial schema and migration
- **Reqs:** DATA-01, DATA-02, MGMT-02, AI-03, AI-04, AI-06, AUTH-08
- **Prereqs:** T1.4
- **Scope:** all models, enums and indexes from architecture §3. Add a custom SQL step in the migration for the User role/authorId CHECK constraint.
- **Acceptance:** `prisma migrate dev` creates the schema. `prisma validate` passes. The priority enum is declared Critical→Low.
- **Verify:** inspect the generated SQL. Run a quick `psql \d "Ticket"`.
- **Outcome (2026-10-30):**
  - **Migration:** `prisma/migrations/<timestamp>_init` creates 7 enums, 8 tables, the §3 indexes and the foreign keys, plus the hand-written `User_role_authorId_check`.
  - **Not done:** the optional composite FK is skipped (the service-layer check is the planned guard).
  - **Verified:**
    - `prisma validate` passes, `migrate dev` applies cleanly and `migrate status` reports up to date.
    - `\d "Ticket"` shows the expected columns, defaults, indexes and FKs.
    - The `TicketPriority` enum range is `{CRITICAL,HIGH,MEDIUM,LOW}`.
    - The CHECK constraint accepts ADMIN-without-author and AUTHOR-with-author rows and rejects the other two combinations (checked in a rolled-back transaction).
    - A second `migrate dev --create-only` produced an empty migration (no drift); it was deleted.

### T1.6 Seed exact dataset (authors, books)
- **Reqs:** DATA-01, DATA-02, BOOK-02, BOOK-03
- **Prereqs:** T1.5
- **Scope:** `prisma/seed.ts` reads `SEED_DATA_PATH` (default `./bookleaf_sample_data.json`) and parses it with a strict Zod schema that mirrors the JSON exactly (nullable fields as listed in requirements §12). It fails loudly on unexpected shape. It upserts Authors and Books by dataset ID, mapping snake_case to camelCase only, with no value changes. Register the seed in `prisma.config.ts` and add an `npm run db:seed` script.
- **Acceptance:** running the seed twice leaves exactly 10 authors and 18 books. Nulls stay null. ISBNs and titles are byte-identical.
- **Verify:** run the seed twice and check counts with `psql`.
- **Blocker:** the JSON must be present locally (it is git-ignored).
- **Outcome (2026-10-30):**
  - **Code layout:** the seed code lives in `prisma/`, not `src/server/`, because it runs as a CLI where `server-only` would throw.
    - `prisma/dataset.ts`: strict Zod schema (rejects unknown or missing keys, wrong types, bad dates, duplicate IDs, emails or ISBNs), `parseDataset()` and `seedDataset()`.
    - `seedDataset()` upserts every author and book by dataset ID in one transaction, mapping snake_case to camelCase only.
    - `prisma/seed-target.ts` (moved into `prisma/db-target.ts` in T1.7, same rules): refuses any target except `localhost`/`127.0.0.1:55432/bookleaf_dev`, and refuses when `NODE_ENV=production`.
  - **Running it:** `prisma/seed.ts` is registered as `migrations.seed` and run with `npm run db:seed`. Added dev dependency `tsx`.
  - **Logging:** counts only. Errors name paths and rules, never values. Prisma query errors report the code only.
  - **Verified:**
    - Seeded twice (and a third time): 10 authors and 18 books each time, no duplicates.
    - A field-by-field comparison of all 348 values against the JSON found 0 mismatches. This covers nulls, the 2 empty `available_on` arrays, the production statuses, zero payouts, all royalty values and the non-ASCII title.
    - The CLI exits 1 with a safe message for a missing file, invalid JSON, a wrong shape, the test DB, a hosted URL, `NODE_ENV=production`, wrong credentials (P1000) and an unreachable DB (P1001).
    - A forced unique conflict (P2002) rolled back all earlier upserts.
    - `bookleaf_test` was unchanged (0 tables, 0 tuple writes).
    - 18 new unit tests in `tests/seed.test.ts`.

### T1.7 Test DB harness and seed verification
- **Reqs:** DATA-01, DATA-02, DEL-08
- **Prereqs:** T1.6
- **Scope** (revised on 2026-10-31 by the owner's T1.7 instructions: tests use synthetic data only, and Prisma migration commands must be guarded):
  - **Env:** `.env.test` (git-ignored) plus a committed `.env.test.example`. The test DB URL is read only from `.env.test`.
  - **Guards:**
    - `tests/helpers/test-database.ts` (`loadTestDatabaseUrl`, `assertTestDatabase`) accepts only `127.0.0.1`/`localhost`:`55433`/`bookleaf_test`, and only with `NODE_ENV=test`.
    - `tests/helpers/test-db-client.ts` re-checks `current_database()` before truncating.
  - **Setup:** Vitest `globalSetup` → `resetTestDatabase()`: the guard, then `prisma migrate reset --force` with the remote opt-in stripped. `setupFiles` points app code at the test DB.
  - **Migration safety (ADR-0008):** `prisma.config.ts` guards every Prisma CLI command (only the local dev or test DB, `--url` refused, unless `PRISMA_ALLOW_REMOTE_DATABASE=true`). Guards share `prisma/db-target.ts`, which replaces `prisma/seed-target.ts` with the seed rules unchanged.
  - **Verification:** `prisma/verify-dataset.ts` (`verifyDataset(db, dataset)`) reports differences by record ID and field only.
    - `prisma/verify.ts` (`npm run db:verify`) runs it read-only against `bookleaf_dev` with the real JSON.
    - Integration tests run it against `bookleaf_test` with synthetic fixtures.
  - **Tests:** synthetic fixtures only (`tests/fixtures/synthetic-dataset.ts`). Schema behaviour (CHECK, enum order, defaults, unique, Restrict, Cascade, SetNull) and seed behaviour (exact fields, idempotency, drift correction, rollback) are tested against `bookleaf_test`.
- **Acceptance:** `npm test` passes against the reset test DB. Unintended targets are refused before any destructive operation. `bookleaf_dev` is unchanged.
- **Verify:**
  - Corrupt one value in the test DB and confirm that verification fails.
  - Point `.env.test` at `bookleaf_dev` and confirm that the guard aborts before touching it.
- **Outcome (2026-10-31):**
  - **Implemented as scoped above.**
  - **Prisma's own check:** Prisma 7 refused `migrate reset` because it detected an AI agent (Claude Code). The owner explicitly consented to resetting `bookleaf_test` ("Yes, reset bookleaf_test"), and that consent text was passed via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` for the T1.7 test runs only.
  - **Verified:**
    - Tests: 61/61 pass (up from 28), twice in a row, each with a fresh reset. 14 are database integration tests.
    - Guard refusals: `.env.test` pointing at `bookleaf_dev` or a remote host aborted before any reset, with no credentials in the output. Remote `DATABASE_URL`/`DIRECT_URL` exported in the shell left tests on `bookleaf_test`.
    - Prisma CLI: refused a remote URL, a remote `DIRECT_URL`, another local Postgres and `--url`. It allowed the dev and test DBs, `generate` without a URL, and the opt-in.
    - `bookleaf_dev` checksums (rows, migration history, columns) were identical before and after.
    - `npm run db:verify`: 10 authors and 18 books match exactly.
    - Lint, typecheck, format and build pass.
  - **Deviations:**
    - Tests no longer seed the real JSON; the original plan did.
    - `db:verify` lives in `prisma/verify.ts`, not `scripts/verify-seed.ts`.

### T1.8 Neon development database
- **Reqs:** DATA-01 (dataset in the development database)
- **Prereqs:** T1.7
- **Scope** (rescoped on 2026-10-31 by the owner: development uses Neon; deployment is deferred to T7.4):
  - **Guards** (`prisma/db-target.ts`): accept the Neon dev database's exact host when registered in `DEV_DATABASE_HOST`. The test-database guards are unchanged.
  - **Seed and `db:verify`:** connect with `DIRECT_URL || DATABASE_URL`.
  - **Docs:** `.env.example`, the README setup steps, and notes in the architecture doc and ADRs.
  - **Neon operations, each approved by the owner:** `prisma migrate status`, then `prisma migrate deploy`, then `npm run db:seed`, then `npm run db:verify`. Never `migrate dev` or `migrate reset`.
- **Acceptance:** Neon has the `init` migration applied, and `db:verify` reports an exact match. Standard checks pass. The local test workflow is unchanged.
- **Outcome (2026-10-31):**
  - Neon dev (`neondb`): migration applied, 10 authors and 18 books seeded, `db:verify` exact match. All four operations were approved by the owner.
  - Guards: registered host accepted. Unregistered hosts, the test DB as a seed target, and a local address used as `DEV_DATABASE_HOST` are all refused. Tests: 65/65 pass. Lint, typecheck, format and build pass.
  - Owner gave standing approval for routine non-destructive Neon use (recorded in `CLAUDE.md`).
  - Minor: pg prints an SSL-mode notice for `sslmode=require`. Behaviour is already the strictest mode; set `sslmode=verify-full` in `.env` to silence it.

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
- **Outcome (2026-10-31):**
  - `src/server/http/` contains `errors.ts`, `request.ts` and `handler.ts`, with 26 unit tests. A temporary route also checked the wrapper under `next build` and `next start`.
  - Also maps Prisma P2002 to 409 (the API contract lists 409).
  - Deviations:
    - No `role` stub. The option arrives with real enforcement in T2.4.
    - The JSON content type is enforced in `parseJson`, not on every mutation, so body-less POSTs such as logout work.
    - Mutations without an `Origin` header are allowed.

### T2.2 Password hashing and user seeding
- **Reqs:** AUTH-01, AUTH-02, AUTH-08, DEL-04
- **Prereqs:** T1.7
- **Scope:** `server/auth/password.ts` (`bcryptjs`, cost 12, `hash` and `verify`). Extend the seed: one AUTHOR user per dataset author (email copied from the dataset, linked by `authorId`, password from `SEED_AUTHOR_PASSWORD`), plus two ADMIN users with documented `@bookleaf.example` emails (password from `SEED_ADMIN_PASSWORD`). Re-running the seed does not change existing hashes unless `--reset-passwords` is passed.
- **Acceptance:** 12 users exist, the CHECK constraint holds, and no plaintext is stored. `verifySeed` also checks the user↔author links.
- **Verify:** unit test for password functions. The seed verification test passes.
- **Outcome (2026-10-31):**
  - Added `src/server/auth/password.ts` and `prisma/users.ts` (`seedUsers`, `verifyUsers`, `readSeedPasswords`). Admins are `support.lead@` and `support.agent@bookleaf.example`. Reset passwords with `npx prisma db seed -- --reset-passwords`.
  - Seed and verify now run under `tsx --conditions=react-server`, so they share the app's server-only password module instead of duplicating it.
  - Neon: 12 logins seeded and `db:verify` passes. A re-run set 0 passwords, so existing hashes were kept.
  - Tests: 98/98 (7 new: password unit tests, plus user-seeding DB tests with synthetic data).

### T2.3 JWT sign/verify and cookie helpers
- **Reqs:** AUTH-03, AUTH-04, AUTH-08
- **Prereqs:** T1.3
- **Scope:** install `jose`.
  - `server/auth/jwt.ts`: `signAuthToken(user)` produces an HS256 token with `sub`, `role`, `authorId`, `iss`, `aud` and an 8-hour `exp`. `verifyAuthToken(token)` returns `AuthUser | null`; it pins the algorithm, checks issuer, audience and expiry, and validates the claims with Zod.
  - `server/auth/cookie.ts`: `setAuthCookie(res, token)` and `clearAuthCookie(res)`, with `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/` and `Max-Age`.
  - `AUTH_JWT_SECRET` comes from `server/env.ts`.
- **Acceptance:** unit tests reject each of these: a tampered signature, a token signed with another secret, `alg: none` or another algorithm, an expired token, a wrong issuer or audience, an invalid role, and an AUTHOR without `authorId`. A valid token round-trips. Cookie flags are asserted for both production and development.
- **Verify:** `npm test`, with the clock mocked for the expiry test.
- **Outcome (2026-10-31):**
  - `src/server/auth/jwt.ts` and `cookie.ts` (`jose` ^6.2.14), with 20 new tests; suite 118/118.
  - Also rejects tokens missing `exp`, `iat` or `sub`. A missing `AUTH_JWT_SECRET` throws (loud), rather than returning null.
  - The cookie helpers append `Set-Cookie`, so they work on any `Response`.
  - Prerequisite for T2.5: the owner adds `AUTH_JWT_SECRET` to `.env`.

### T2.4 Auth guards
- **Reqs:** AUTH-04, AUTH-05, AUTH-07
- **Prereqs:** T2.1, T2.3
- **Scope:** `getUserFromRequest(req)` and `getUserFromCookies()`, both built on `verifyAuthToken`. Complete `withApi({ role })`, which injects `ctx.user` (including `authorId` for authors, taken only from the verified token). Add `requireUser(role)` for server layouts (redirect to `/login`, or to the user's own portal on a wrong role).
- **Acceptance:** a handler wrapped with `role: 'ADMIN'` returns 401 with no cookie and 403 with an author cookie.
- **Verify:** unit and integration tests with an auth-cookie factory helper (`tests/helpers/auth.ts`).
- **Outcome (2026-10-31):**
  - Added `src/server/auth/session.ts` (`getUserFromRequest`) and `guards.ts` (`getUserFromCookies`, `requireUser`, `portalPath`). `withApi(handler, { access })` now requires an explicit access level and types `user` per level.
  - Tests use a fixed test-only `AUTH_JWT_SECRET` (`tests/setup-env.ts`). 14 new tests; suite 132/132. A temporary route under `next build`/`next start` returned 401, 403 and 200 as expected (then deleted).
  - Deviation: `access` replaces the planned `role` option, because routes also need `PUBLIC` and `AUTHENTICATED`. Docs updated.

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
- **Outcome (2026-10-31):**
  - Routes `src/app/api/auth/{login,logout,me}/route.ts`, service `src/server/services/auth.ts` (`authenticate`, `getCurrentUser`), shared schema `src/lib/schemas/auth.ts`. Login and me return `{ id, name, role, authorId }`; logout returns `{ loggedOut: true }` and is `AUTHENTICATED`.
  - Login trims and lowercases the email and looks it up exactly (all stored emails are lowercase). An unknown email is compared against a fixed dummy bcrypt hash.
  - Tests: 10 new integration tests (`tests/integration/auth.test.ts`); suite 142/142. Under `next build`/`next start` against the dev DB, all 12 seeded logins succeed and curl confirmed the 401/400/403, cookie and logout flows.
  - `/me` re-reads the user from the database for the name; a deleted user gets 401.

### T2.6 Login page, proxy, portal shells
- **Reqs:** AUTH-07, BOOK-05 (shell)
- **Prereqs:** T2.5
- **Scope:** `/login` form (client component calling the API, with error and loading states), redirect by role after login. `src/proxy.ts` verifies the JWT (no DB access) only to redirect logged-out or wrong-role users. `author/layout.tsx` and `admin/layout.tsx` provide guards and nav with logout. `/` redirects by role.
- **Acceptance:** manual check that the author lands on `/author` and the admin on `/admin`, that cross-portal URLs redirect, and that logout returns to `/login`.
- **Verify:** manual browser check. Document it in the T7.3 checklist.
- **Outcome (2026-10-31):**
  - Added shadcn/ui (owner-approved): `radix-nova` style, Radix primitives, `lucide-react` icons, components `button`, `input`, `label` and `alert`. The `cn` helper comes from shadcn's `cn` package (its CLI default, a drop-in for clsx + tailwind-merge); the `shadcn` package is a dev dependency, used only for its CSS import. BookLeaf theme tokens and fonts (Geist, Source Serif 4) are in `globals.css` and the root layout.
  - `src/proxy.ts` (redirects only, 4 unit tests), `/login` with `features/auth/login-form.tsx` (client validation with the shared schema, field and form errors, loading state), `/` redirect, and the `author`/`admin` layouts using `requirePortalUser`. The portal shell is shared; the author header is light, the admin "Support desk" header is dark. `lib/api-client.ts` and `lib/routes.ts` added.
  - Browser check (dev server, dev DB): admin and author land on their portals; cross-portal URLs and `/login` redirect signed-in users; logout returns to `/login`, and Back doesn't reopen the portal; the cookie isn't visible to `document.cookie`; layouts checked at 1360px and 390px. Recorded in `docs/test-checklist.md`.
  - `tests/baseline.test.ts` now stubs `next/font/google` (Next compiles it, Vitest doesn't). Suite 146/146.

### T2.7 Authorization test matrix (baseline)
- **Reqs:** AUTH-04, AUTH-05
- **Prereqs:** T2.5
- **Scope:** `tests/integration/authz.test.ts` is a table-driven matrix of every route × {no cookie, author, admin} → expected status. New routes must be added to it, and later tasks extend it.
- **Acceptance:** the matrix passes for the existing routes. The test fails if a route file exists but is missing from the matrix (it globs `src/app/api/**/route.ts`).
- **Verify:** `npm test`.
- **Outcome (2026-10-31):**
  - `tests/integration/authz.test.ts`: one `MATRIX` entry per route and method, run as no session, author and admin against real synthetic users in `bookleaf_test`. The completeness check compares the matrix with every HTTP method exported by every route file, so a new method on an existing route is caught too.
  - Also covers AUTH-04 for every route: tampered, expired and wrongly signed tokens must behave exactly like no session.
  - Evidence: a temporary unlisted route made the completeness test fail (then removed). Suite 159/159; phase-gate `npm run build` passes.
  - **Phase 2 gate met:** seeded logins in and out (T2.5), every existing route rejects unauthenticated and wrong-role calls (this matrix), page redirects (T2.6), bcrypt hashes (T2.2), token only in the HttpOnly cookie (T2.5, T2.6).

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
- **Outcome (2026-10-31):**
  - `src/lib/labels.ts`, `src/lib/format.ts` (`formatInr`, `formatCount`, `formatDate`, `formatDateTime`, each with an optional fallback such as "No payout yet"), `src/lib/schemas/tickets.ts` (create ticket, admin update, message, note, queue query; `LIMITS`).
  - Enum values come from Prisma's generated `enums.ts` (client-safe), not a copy. Labels are `Record<Enum, string>`, so a new enum value fails the build until labelled.
  - Decisions: strict bodies (unknown keys → 400); length limits chosen here because the requirements give none (architecture §4); timestamps in IST, calendar dates in UTC.
  - Tests: 21 new unit tests (`format`, `labels`, `schemas/tickets`); suite 180/180.

### T3.2 Books API
- **Reqs:** BOOK-01–05, AUTH-06
- **Prereqs:** T2.4, T3.1
- **Scope:** `server/services/books.ts` `listBooksForAuthor(authorId)` returns the 15 fields plus totals. `GET /api/author/books`.
- **Acceptance:** an author gets all of their books, including an in-production one, and never another author's. The totals equal the sums of the author's book values. Tests use synthetic fixtures (`tests/fixtures/`), never the real dataset; the real-data check is `npm run db:verify`. An admin gets 403.
- **Verify:** integration tests. Add the route to the authz matrix.
- **Outcome (2026-10-31):**
  - `server/services/books.ts` `listBooksForAuthor` and `GET /api/author/books` → `{ books, totals, payout }`. Calendar dates are returned as `YYYY-MM-DD`; response types live in `src/lib/api-types.ts`.
  - Added `server/policies/royalty.ts` (`MIN_PAYOUT_INR`, `isBelowPayoutThreshold`: pending above ₹0 and below ₹1,000), so the BOOK-07 hint is decided on the server.
  - Tests: 7 integration tests (synthetic), a policy unit test, and the matrix row; suite 191/191.
  - Real data (dev DB, `next start`): all 10 authors get exactly their own books (18 in total), totals equal the dataset sums, and only AUTH009 is below the threshold.
  - Build order for the rest of Phase 3: T3.4 and T3.5 come before T3.3, because the dashboard's open-ticket count (BOOK-05) needs the ticket list.

### T3.3 Author dashboard and My Books UI
- **Reqs:** BOOK-01–07
- **Prereqs:** T2.6, T3.2
- **Scope:** `/author` page with summary cards and a books table (cards on narrow screens). Handle the in-production badge, "Not yet published", "No payout yet" and the threshold hint. Add a link to "Raise a query". Use the SWR fetcher in `lib/api-client.ts`.
- **Acceptance:** check AUTH007 and AUTH009 visually: no `null`, `NaN` or "Invalid Date". Loading and error states render.
- **Verify:** manual browser check with AUTH007, AUTH009 and AUTH002.
- **Outcome (2026-10-31):**
  - `/author` with `features/author-dashboard/dashboard.tsx` (stat cards: books, earned, paid, pending, open queries; payout hint from the API's `payout.belowThreshold`) and `books-section.tsx` (table with totals row on wide screens, cards below `lg`). `components/book-status-badge.tsx` and `src/lib/books.ts` (`isInProduction`, `productionStage`, unit-tested; the new-ticket form uses it too).
  - Browser check (local Docker dev DB): AUTH007 (in-production book: "Not yet published", "—" MRP, ₹0, "No payout yet"; totals and open-query count right; no hint), AUTH009 (hint shown for ₹850 pending), AUTH002 at phone width (cards, no hint). No `null`, `NaN` or "Invalid Date". Loading skeleton and error state with retry forced in the browser.
  - **Phase 3 gate met:** dashboard and books incl. edge cases (T3.3), ticket create/list/view (T3.4–T3.7), cross-author tests for books and tickets (T3.2, T3.4, T3.5), loading/empty/error states on every author page. Suite 217/217; build passes.

### T3.4 Ticket creation API
- **Reqs:** TICKET-01, TICKET-04, TICKET-05, AUTH-06
- **Prereqs:** T2.4, T3.1
- **Scope:** `server/services/author-tickets.ts` `createTicket(authorId, input)`: verify `bookId` ownership (or null), insert with OPEN and PENDING, and call a no-op `onTicketCreated(id)` hook (wired in T5.4). Route `POST /api/author/tickets`.
- **Acceptance:** 201 with the ticket DTO. Another author's bookId gets 400 with a field error. An empty subject gets 400.
- **Verify:** integration tests. Update the authz matrix.
- **Outcome (2026-10-31):**
  - `server/services/author-tickets.ts` `createTicket` (+ `authorTicketSelect`, `toAuthorTicket`) and `POST /api/author/tickets` → 201 `AuthorTicket` (`src/lib/api-types.ts`). Another author's or an unknown `bookId` gets the same 400 field error, so book IDs don't leak.
  - `server/services/ticket-hooks.ts` `onTicketCreated` is the no-op hook for T5.4; `createTicket` catches and logs any hook failure, and a test proves the ticket is still created (TICKET-05).
  - Tests: 6 integration tests plus the matrix row; suite 201/201; build passes.

### T3.5 Author ticket read APIs
- **Reqs:** TICKET-06–08, AUTH-06
- **Prereqs:** T3.4
- **Scope:** `listTicketsForAuthor` and `getTicketForAuthor` with explicit `select` DTOs (no notes, drafts, priority, AI fields or assignee). Routes `GET /api/author/tickets` and `GET /api/author/tickets/[id]`.
- **Acceptance:** another author's ticket ID gets 404. A test seeds a note, a draft and AI fields, then asserts that none appear in the response.
- **Verify:** integration tests.
- **Outcome (2026-10-31):**
  - `listTicketsForAuthor` (most recently updated first) and `getTicketForAuthor` (replies oldest first, each with sender name and role) in `server/services/author-tickets.ts`; routes `GET /api/author/tickets` and `GET /api/author/tickets/[id]`. Types `AuthorTicketDetail`, `AuthorTicketMessage` in `src/lib/api-types.ts`.
  - Category is hidden from authors too (it can be an AI guess), along with priority, AI fields, assignee, notes, drafts and a reply's `aiDraftId`.
  - Tests: 6 integration tests (incl. the leak test, which checks both responses for seeded secret values and forbidden keys) and two matrix rows; suite 215/215; build passes.
  - Follow-up for T4.6: an admin reply must bump the ticket's `updatedAt`, so "last update" and list order reflect it.

### T3.6 New-ticket form UI
- **Reqs:** TICKET-01, TICKET-02, TICKET-04
- **Prereqs:** T2.6, T3.2, T3.4
- **Scope:** `/author/tickets/new`. Book select (own books plus "General / Account Level", with in-production books labelled), subject, description with a character count, and an attachment picker that lists file names with the notice "Attachments aren't uploaded in this version". Client validation uses the shared schema, server field errors are mapped onto fields, the submit button is disabled while pending, and success redirects to the ticket detail.
- **Acceptance:** the form submits, and validation errors appear inline.
- **Verify:** manual check, including a forced 400 from the server.
- **Outcome (2026-10-31):**
  - `features/author-tickets/new-ticket-form.tsx` and `/author/tickets/new`. No book is preselected, so "General / Account Level" is a deliberate choice; all field errors show together; on success the ticket list cache is refreshed and the browser goes to the new ticket.
  - Browser check (local Docker dev DB, AUTH007): book list with the in-production book labelled; empty submit shows three inline errors and focuses the first; a forced server 400 (option value changed to another author's book) shows the server's message on the book field; a real submission with an attachment listed lands on the ticket and appears in My tickets; phone width.

### T3.7 My Tickets list and detail UI
- **Reqs:** TICKET-06, TICKET-07
- **Prereqs:** T3.5, T2.6
- **Scope:** `/author/tickets` (status badges, book name, last update, empty state with a call to action) and `/author/tickets/[id]` (original query and response thread, status, not-found state).
- **Acceptance:** manual check. An empty state appears for an author with no tickets.
- **Verify:** manual check. Polling is added in T6.1.
- **Outcome (2026-10-31):**
  - `features/author-tickets/ticket-list.tsx` and `ticket-detail.tsx` (SWR via `fetcher` in `lib/api-client.ts`), pages `/author/tickets` and `/author/tickets/[id]`, "My tickets" in the author nav. Shared `components/ticket-status-badge.tsx` (one colour per status) and `components/error-state.tsx` (retry; "session has ended" on 401). Added `swr` and the shadcn `badge`, `card`, `skeleton`, `table`, `textarea` and `native-select` components for Phase 3.
  - Browser check against the local Docker dev DB (seeded there, so test tickets and a test reply stay out of Neon): list order and badges, detail with a support reply, no-replies state, not-found (unknown ID, and another author's ticket), empty state with call to action, 1360px and 390px. Recorded in `docs/test-checklist.md`.

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
- **Outcome (2026-10-31):**
  - `server/services/admin-tickets.ts` `listQueue(query, adminId)` and `GET /api/admin/tickets` → `{ data: QueueTicket[], page, pageSize, total }` (`pageResponse` in `server/http/handler.ts`; types in `src/lib/api-types.ts`).
  - "Needs triage" (`unclassified=true`) means no effective category **or** priority. Ordering is done in the database: priority ascending with nulls first, then oldest first, then ID.
  - Tests: 11 integration tests over an 8-ticket fixture (each filter, combinations, inclusive UTC date bounds, ordering, paging, six invalid queries) plus the matrix row; suite 232/232; build passes.

### T4.2 Admin ticket detail API
- **Reqs:** QUEUE-01, MGMT-02, DRAFT-01 (shape)
- **Prereqs:** T4.1
- **Scope:** `GET /api/admin/tickets/[id]` returns the ticket, author summary (name, email, city), book record, messages, notes, latest draft (null for now) and AI metadata.
- **Acceptance:** 404 for an unknown ID. An author gets 403.
- **Verify:** integration tests.
- **Outcome (2026-10-31):**
  - `getTicketForAdmin` in `server/services/admin-tickets.ts` and `GET /api/admin/tickets/[id]` → `AdminTicketDetail` (`src/lib/api-types.ts`): AI fields, author `{id,name,email,city}`, the full book (same mapping as the author books API, via `toAuthorBook`), assignee, messages (with `aiDraftId`), notes, and `latestDraft: null` until T5.6.
  - Tests: 3 integration tests plus the matrix row; suite 239/239; build passes.

### T4.3 Admin queue UI
- **Reqs:** QUEUE-01–04
- **Prereqs:** T4.1, T2.6
- **Scope:** `/admin` table. Filters are stored in URL search params so views can be bookmarked. Show priority and status badges, an age badge ("3d"), the assignee, "Needs triage" for null category or priority, and an "Assigned to me" quick filter.
- **Acceptance:** manual check. Filters round-trip through the URL.
- **Verify:** manual check.
- **Outcome (2026-10-31):**
  - `/admin` with `features/admin-queue/queue.tsx`: filters (status incl. "Unresolved" default and "All statuses", category, priority, date range, "Assigned to me", "Needs triage", "Clear filters") kept in the URL and passed as-is to the API; table on wide screens, cards on phones; pagination footer. Shared `components/ticket-badges.tsx` (priority, needs-triage, age), `formatAge` in `lib/format.ts` (tested), `hooks/use-minute-clock.ts` (pure "now" for ages), and `pageFetcher` in `lib/api-client.ts`.
  - Browser check (local Docker dev DB, Support Lead; two tickets triaged through the PATCH API as Support Agent): order (needs triage, High, Medium), "Support Agent" as assignee, filters UI→URL (`?priority=HIGH`) and URL→UI (all statuses + needs triage), filtered empty state, phone layout.

### T4.4 Ticket update API
- **Reqs:** MGMT-01, MGMT-03, AI-03, AI-04
- **Prereqs:** T4.2
- **Scope:** `PATCH /api/admin/tickets/[id]` accepts a partial body `{status, category, priority, assignToMe: true}`. `assignToMe` sets the assignee to the calling admin; there is no field for assigning anyone else (MGMT-03). AI suggestion fields are untouched.
- **Acceptance:** tests cover each field, an unknown field such as `assigneeId` (400, strict schema), an empty body (400) and the AI-suggested values being preserved after an override.
- **Verify:** integration tests.
- **Outcome (2026-10-31):**
  - `updateTicket` in `server/services/admin-tickets.ts` and `PATCH /api/admin/tickets/[id]`; returns the updated `AdminTicketDetail`. An unknown ID is 404 (Prisma P2025).
  - Tests: 5 integration tests (status, overrides with AI values kept, assign to me, five rejected bodies, 404/403/401) plus the matrix row; suite 248/248; build passes.

### T4.5 Internal notes API
- **Reqs:** MGMT-02, TICKET-08
- **Prereqs:** T4.2
- **Scope:** `POST /api/admin/tickets/[id]/notes`.
- **Acceptance:** the note appears in admin detail and never in the author detail (asserted).
- **Verify:** integration tests.
- **Outcome (2026-10-31):**
  - `addInternalNote` in `server/services/admin-tickets.ts` and `POST /api/admin/tickets/[id]/notes` → 201 `InternalNote`; unknown ticket → 404.
  - A note does not touch the ticket's `updatedAt`, because authors see that timestamp (tested).
  - Tests: 3 integration tests plus the matrix row; suite 255/255; build passes.

### T4.6 Admin response API
- **Reqs:** MGMT-04, MGMT-05, DRAFT-03
- **Prereqs:** T4.2
- **Scope:** `POST /api/admin/tickets/[id]/messages` takes `{body, aiDraftId?, status?}`. Message creation and the status change happen in one transaction. Open moves to In Progress unless a status is given. `aiDraftId` must belong to this ticket.
- **Acceptance:** the author detail endpoint returns the message. The status transition is correct.
- **Verify:** integration tests.
- **Outcome (2026-10-31):**
  - `sendReply` in `server/services/admin-tickets.ts` (one interactive transaction) and `POST /api/admin/tickets/[id]/messages` → 201 `{ message, status }` (`SentReply`).
  - Only Open moves to In Progress when no status is given; other statuses stay. The reply also bumps `updatedAt` (the T3.5 follow-up). Another ticket's `aiDraftId` → 400 on `aiDraftId`, with nothing saved.
  - Tests: 4 integration tests plus the matrix row; suite 263/263; build passes.

### T4.7 Admin detail UI: context and management controls
- **Reqs:** MGMT-01, MGMT-03, AI-03, AI-04
- **Prereqs:** T4.3, T4.4
- **Scope:** `/admin/tickets/[id]`. The left side shows the thread and query. The right panel shows author and book facts (the same facts the AI will see), status, category and priority selects (with the "AI suggested X" hint) and an "Assign to me" button.
- **Acceptance:** each control persists its value, and errors are shown.
- **Verify:** manual check.
- **Outcome (2026-10-31):**
  - `/admin/tickets/[id]` with `features/admin-ticket/ticket-view.tsx` (header badges, query, conversation), `management-panel.tsx` (status/category/priority selects saved on change with "Saving…", "AI suggested X (overridden)" hints and AI reasoning when present, "Assign to me") and `context-panel.tsx` (author and book facts). The PATCH response replaces the cached ticket, so there is no extra request.
  - Browser check (local Docker dev DB): priority → Critical and "Assign to me" both persist across a reload; a forced 500 shows the error under the control and the select returns to the saved value; not-found state.

### T4.8 Admin detail UI: notes and reply composer
- **Reqs:** MGMT-02, MGMT-04
- **Prereqs:** T4.7, T4.5, T4.6
- **Scope:** an internal notes panel with clearly different styling ("Only visible to BookLeaf team"). A reply composer with an optional status-after-send select. This is manual-only in this task.
- **Acceptance:** a manual reply sent here appears in the author view after a refresh.
- **Verify:** manual check with two browsers.
- **Outcome (2026-10-31):**
  - `features/admin-ticket/reply-composer.tsx` (status after sending: "Automatic (Open → In Progress)" / "Keep as …" or a chosen status), `internal-notes.tsx` (amber panel, "Only visible to BookLeaf team") and the shared `text-form.tsx` (character count; text kept on error, cleared on success).
  - Browser check, two contexts (local Docker dev DB): an empty send is refused inline; Support Lead adds a note and sends a reply; the ticket moves Open → In Progress; after a refresh AUTH002 sees the reply and status, and no note.
  - **Phase 4 gate met** (AI not involved anywhere yet): all tickets visible, filtered and sorted (T4.1, T4.3); open one (T4.2, T4.7); change status, category and priority, assign to self (T4.4, T4.7); notes (T4.5, T4.8); manual replies the author sees (T4.6, T4.8). Suite 265/265; build passes.

---

## Phase 5 — AI integration

**Gate:** with a valid key, new tickets are classified and admins get grounded drafts. With the key missing, invalid, timing out or returning malformed output, ticket creation and manual handling still work and the UI explains the state. All AI tests run offline with fakes.
**Still unsatisfied:** RT-\*, DEL-01, DEL-03 to DEL-07.

**Verified facts this phase relies on (2026-10-31; re-check any that change):**
- Models are owner-configured in `.env`: both tasks use `gemini-3.5-flash-lite` (stable). The draft model was originally `gemini-3.8-flash`; on the free tier it returned 503 "high demand" repeatedly and otherwise took 20–65 s, so the owner switched drafting to flash-lite during T5.1 (see the T5.1 outcome). Quality is measured in T5.9; switching is one `.env` line.
- `@google/genai` 2.32.0 (not yet installed) exposes `responseJsonSchema`, `responseMimeType`, `systemInstruction`, `maxOutputTokens`, `abortSignal`, `httpOptions.timeout`, `thinkingConfig.thinkingLevel` (`MINIMAL | LOW | MEDIUM | HIGH`), `usageMetadata.{promptTokenCount, candidatesTokenCount, thoughtsTokenCount}` and `ApiError.status`.
- Thinking cannot be disabled on these models; flash-lite defaults to `minimal`, flash to `medium`. Thinking tokens are billed with output tokens. Docs and the live API can disagree: `gemini-3.8-flash` rejected `MINIMAL` with HTTP 400 although the docs list it, so every setting is checked live (`npm run ai:smoke`).
- Google strongly recommends keeping `temperature` at its default (1.0) for Gemini 3 models; lowering it can cause looping or degraded output. We don't set it.
- Structured output: keywords such as `minLength`/`maxLength` are stripped, not enforced, so all bounds are enforced by our Zod validation.
- Free-tier rate limits are per project and shown in AI Studio, not in the docs.
- **Unpaid-tier data terms** (last modified 2026-04-28): content may be used to improve Google products and read by human reviewers; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." See T5.5 for minimisation and the open owner decision below.

**Owner decision (2026-10-31):** stay on the Gemini free tier for this demo; the owner understands and accepts the unpaid-tier data terms. The minimisation and redaction measures (T5.5, architecture §6.6) are kept exactly as documented, and no unnecessary personal or confidential information is sent. Tests and the evaluation script use synthetic data only.

### T5.1 AI provider boundary and Gemini adapter
- **Reqs:** AI-05, AI-07, AI-08, AI-09
- **Prereqs:** T1.3, T1.5
- **Scope:**
  - Install `@google/genai` (approved stack).
  - `server/ai/provider.ts`: `StructuredGenerator` interface and `AiError` (kinds `TIMEOUT | RATE_LIMITED | INVALID_OUTPUT | PROVIDER_ERROR | DISABLED`).
  - `server/ai/gemini.ts` (the only SDK import): `generateContent` with `systemInstruction`, `responseMimeType: "application/json"`, `responseJsonSchema` from `z.toJSONSchema`, a per-call `thinkingLevel`, `maxOutputTokens`, and a timeout (abort signal); default temperature. Parse with `JSON.parse` + the same Zod schema. Error mapping: 429 (rate limit or quota exhausted) → `RATE_LIMITED`, no retry; 5xx (incl. 503 overloaded) or network → one retry after a short pause, then `PROVIDER_ERROR`; other 4xx (e.g. invalid key) → `PROVIDER_ERROR`, no retry; abort → `TIMEOUT`; empty, truncated (`MAX_TOKENS`), blocked or schema-invalid output → `INVALID_OUTPUT`.
  - `getGenerator()`: AI is enabled only when `GEMINI_API_KEY` and both model variables are set; otherwise a disabled generator that throws `DISABLED`. No model ID is hard-coded.
  - Migration: add `thinkingTokens Int?` and `promptVersion String?` to `AiCallLog` (kept separate from `outputTokens`). Apply to Neon with `migrate deploy` (standing approval).
  - `logAiCall()` writes one row per call: kind, model, prompt version, outcome, input/output/thinking tokens, latency. Never prompt text, responses, keys or personal data.
  - `tests/helpers/fake-ai.ts`.
- **Acceptance:** unit tests with the SDK mocked cover each error mapping above (429, 503 then success, 503 twice, 401, abort, non-JSON, schema mismatch, `MAX_TOKENS`), the disabled generator, and token fields incl. `thoughtsTokenCount` → `thinkingTokens`. A one-off live smoke script validates both configured models with the real configuration (schema + thinking level) on synthetic text.
- **Verify:** `npm test`; run the smoke script once and record model, outcome, tokens and latency.
- **Blockers:** `GEMINI_API_KEY` and model variables (set). If the draft model keeps returning 503, report it; no automatic fallback model.
- **Outcome (2026-10-31):**
  - `src/server/ai/provider.ts` (interface, `AiError` carrying token usage, disabled generator), `gemini.ts` (the only SDK import; client injectable for tests), `client.ts` (`createGeneratorFromEnv`, `getGenerator`, `generateLogged`: one best-effort `AiCallLog` row per call with separate thinking tokens and prompt version), `tests/helpers/fake-ai.ts`, `scripts/ai-smoke.ts` (`npm run ai:smoke`). Installed `@google/genai` ^2.32.0. Migration `20261031120000_ai_call_log_thinking_and_prompt_version` (two nullable columns), applied to the test, local dev and Neon dev databases; `db:verify` still passes. Tests clear `GEMINI_*`, so they can never call the real API.
  - Live: the classification model passed every run (1.1–2.7 s). `gemini-3.8-flash` as draft model failed (503 ×4, then 27 s and 65 s; timed out at our 30 s budget) and rejected `MINIMAL`; `gemini-3.5-flash` timed out too. The owner switched `GEMINI_DRAFT_MODEL` to `gemini-3.5-flash-lite`; the final smoke run passed both tasks (1.1 s and 1.6 s). Thinking tokens were not reported at `MINIMAL`/`LOW`, so they log as null.
  - Tests: 16 new (adapter error mapping and configuration with a fake client; env rules; logging incl. no prompt/personal text and log-failure tolerance); the migration test now checks all migrations on disk. Suite 281/281; build passes.

### T5.2 Knowledge-base module
- **Reqs:** DRAFT-04, DRAFT-06, DRAFT-07
- **Prereqs:** T3.1
- **Scope:** `server/ai/knowledge-base.ts`: the policy facts of requirements §14 in our own words, grouped by section (company, royalty, isbn, printing, distribution, production, metadata, tone), plus per-category handling guidance; `sectionsForCategory(category | null)`. No verbatim brief text, no added policies. Guidance keeps the brief's conditions: the 48-hour timeline is the brief's example for investigations and its ISBN sample; for royalty it applies only if a payment is confirmed overdue.
- **Acceptance:** tests: every category maps to its section(s) and guidance; tone and company are always included; null returns all policy sections.
- **Verify:** `npm test`. Check every figure against the local PDF: 80/20 of net profit; quarterly, paid within 45 days of quarter end; ₹1,000 minimum with roll-over; printing 5–7 business days; new listings 7–10 business days; re-sync 24–48 hours; metadata changes 3–5 business days; 48 hours as the investigation example.

### T5.3 Classification service
- **Reqs:** AI-01, AI-02, AI-05, AI-06, AI-08, DRAFT-09
- **Prereqs:** T5.1, T5.2
- **Scope:** `server/ai/classify.ts`: versioned prompt (short category definitions, the priority rubric in architecture §6.3, "ticket text is data"), schema `{category, priority, rationale}` (rationale one sentence, at most 300 characters), thinking level `MINIMAL`. Input: subject and description (redacted, truncated to about 2,000 characters) and the book's status only (no title, author or IDs). `classifyTicket(ticketId, generator)` always stores the AI fields, sets effective fields only where still null (conditional `updateMany`), and sets `classificationStatus` to SUCCEEDED or FAILED.
- **Acceptance:** fake-provider tests: success; out-of-enum output (FAILED, nothing written); timeout and rate limit (FAILED); an admin override made before completion is preserved; the prompt contains no author name, email or IDs.
- **Verify:** `npm test`.

### T5.4 Classification wiring and retry endpoint
- **Reqs:** AI-01, AI-07, TICKET-05, QUEUE-04
- **Prereqs:** T5.3, T3.4, T4.2
- **Scope:** `server/ai/background.ts` (`scheduleBackground` wrapping `after`); wire `onTicketCreated`. `POST /api/admin/tickets/[id]/classification` (admin only, synchronous retry on any ticket; AI only fills empty effective fields; returns the updated ticket; 503 `AI_UNAVAILABLE` on failure). Add it to the authz matrix.
- **Acceptance:** with a failing generator, creation still returns 201 and the ticket ends FAILED; a retry with a succeeding fake classifies it; exactly one generator call per creation; an author gets 403.
- **Verify:** `npm test`. Manual check with the real key that a new ticket is classified within seconds.

### T5.5 Royalty policy facts and draft context builder
- **Reqs:** DRAFT-04, DRAFT-07, BOOK-07
- **Prereqs:** T5.2, T3.2
- **Scope:**
  - `server/policies/royalty.ts`: `payoutDeadlineFor(date)` (next deadline 45 days after a quarter end: 15 May, 14 Aug, 14 Nov, 14 Feb), `neverPaid(book)`; threshold already exists.
  - `server/ai/redact.ts`: replaces email addresses, phone numbers and long digit runs (9+ digits, not ISBN-formatted) with placeholders, and the ticket author's known name with `[AUTHOR]`.
  - `server/ai/draft-context.ts` `buildDraftContext(ticketId)`: ticket subject/description (redacted, truncated), the last ≤3 author-visible replies (redacted, truncated; sender shown as "BookLeaf Support", never admin names), the referenced book's verified fields (or a compact list for General), derived facts (payout deadline, threshold, never-paid, production stage), ticket status, and KB sections. Never: author name, email, phone, city, IDs, internal notes, assignee, admin names. The greeting uses the literal `[AUTHOR_FIRST_NAME]`, which code replaces after generation, so the name is never sent.
- **Acceptance:** unit tests: deadlines (2026-10-27 → 2026-11-14; 2026-12-10 → 2027-02-14); in-production book gives the stage and no MRP; below-threshold flag; General lists compact books; a test serialises the **whole** context and asserts that the author's name, email, phone, city, IDs, notes and admin names are absent and that a seeded email/phone in the ticket text is redacted; size bound.
- **Verify:** `npm test`.

### T5.6 Draft service and endpoint
- **Reqs:** DRAFT-01, DRAFT-04–09, AI-08
- **Prereqs:** T5.1, T5.5, T4.2
- **Scope:** `server/ai/draft.ts`: versioned system prompt (role, tone rules, guardrails from architecture §6.4, untrusted input in delimited blocks), schema `{reply, commitments[], needsVerification[]}` (reply ≤ 5,000 characters, ≤ 8 items each), thinking level `LOW` (raise to `MEDIUM` only if T5.9 shows quality problems). Persist an `AiDraft` with `promptVersion`. `POST /api/admin/tickets/[id]/drafts` (admin only, authz matrix). Admin detail returns the latest draft with a `stale` flag (a newer message exists).
- **Acceptance:** fake-provider tests: stored and returned; `[AUTHOR_FIRST_NAME]` replaced; failure → 503 `AI_UNAVAILABLE` with nothing stored; prompt tests: the category's KB section is present, others absent, no notes or personal data; an author gets 403.
- **Verify:** `npm test`. Manual check with the real key on 3 categories (subject to the owner's data decision; otherwise on a synthetic ticket).

### T5.7 Draft safety post-check
- **Reqs:** DRAFT-05
- **Prereqs:** T5.6
- **Scope:** `server/ai/safety.ts` `checkDraft(reply, context)` → `warnings[]`, stored on `AiDraft`, shown above the editor, never blocking. Proportionate: everything is checked against the **supplied context** (KB sections, verified facts, ticket text), so legitimate figures such as "48 hours", "₹1,000" or the book's own amounts pass. It flags: ₹ amounts, other numbers and durations not in the context; links, email addresses and phone numbers not in the context; and completed-action phrasing ("has been refunded", "we have reprinted", "has been escalated").
- **Acceptance:** unit tests: "₹5,000 has been credited" without that fact → 2 warnings; a draft quoting the context's figures and timelines → none; an unknown URL or email → a warning; the KB's own figures → none.
- **Verify:** `npm test`.

### T5.8 Admin draft UI
- **Reqs:** DRAFT-01, DRAFT-02, DRAFT-05, DRAFT-08
- **Prereqs:** T5.6, T5.7, T4.8
- **Scope:** opening a ticket with no draft (or a stale one) requests one draft once and shows "Drafting…". The draft fills the composer for editing. Commitments, needs-verification items and warnings are listed above the editor (informational; no confirmation gate). "Regenerate" button. Failure banner: "AI draft unavailable — write a reply manually", with a "try again in a minute" note on rate limits. Sending passes `aiDraftId`. "Retry classification" for triage tickets.
- **Acceptance:** manual check with a real key and with AI disabled.
- **Verify:** manual check.

### T5.9 Live prompt evaluation script
- **Reqs:** AI-02, DRAFT-04–06 (evidence for the README)
- **Prereqs:** T5.3, T5.6
- **Scope:** `scripts/ai-eval.ts` (manual, uses the real API, not in CI). Synthetic tickets and synthetic book facts only (no dataset records, no brief text copied). About 10 cases: at least one per category, both royalty variants (missing payment; amount looks low), and the missing-royalty vs bio-update pair. Checks, each traced to the brief:
  - **Classification:** exact category for every case. Priority is pass/fail only where the brief supports it: the long-missing royalty ranks above the bio update; an ISBN error is High or above. Other priorities are reported against our rubric, not scored.
  - **Drafts (automatic):** no completed-action phrasing; no safety warnings; and per category: royalty (missing) mentions the quarterly cycle, the 45-day window and the computed payout date, and puts bank details and payout status in `needsVerification` (48 hours only if conditional on confirmation); royalty (amount) explains the net-profit formula and offers a breakdown; ISBN commits to escalating to production with a 48-hour timeline; printing asks for photos and commits to a free reprint after verification within 5–7 business days; distribution (published book) commits to a re-sync with 24–48 hours; production states the actual stage and does **not** invent a completion date (the brief's "specific updated timeline" has no data source, so it goes to `needsVerification`); general metadata says 3–5 business days.
  - Tone is reviewed manually.
- **Acceptance:** every category exact, both ordering checks pass, all automatic draft checks pass; any failure is analysed and the prompt adjusted, or the reason documented. About 16–20 API calls per run.
- **Verify:** run once; save a summary to `docs/ai-eval.md` (case IDs, expected vs actual, pass/fail, tokens; no prompt or dataset text).

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
  - Moved here from the original T1.8:
    - Use a separate Neon project for production, never the dev one.
    - The Vercel build needs `PRISMA_ALLOW_REMOTE_DATABASE=true` (ADR-0008).
    - `db:seed` and `db:verify` accept only the dev database, so seeding and verifying production needs a small, explicit, owner-approved path.
  - Every hosted operation needs the owner's approval.
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

### T7.7 Handover
- **Reqs:** DEL-01, DEL-02
- **Prereqs:** T7.6
- **Scope:** confirm that no confidential files or verbatim brief text are committed (the repo is public), grant BookLeaf collaborator access (address pending), review the commit history, and check that the README live URL works from an incognito window.

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

**Deferrable without violating mandatory requirements.** Everything in the deferred backlog, plus the recommended items: BOOK-06/07 polish, QUEUE-05 pagination, RT-02 admin polling, the T5.7 safety post-check (the prompt guardrails and human review remain), T5.9 (but the README must still evidence the AI design), and early deployment (now part of T7.4). Do **not** defer AI classification, drafting, graceful degradation, polling on the author view, or API docs. These are mandatory and are the product's core.

**Highest-risk requirements and early validation.**

| Risk | Early validation |
|---|---|
| Deployment friction (Prisma 7 adapter, pooled URLs, env) | Partly de-risked in T1.8: the app's database layer runs against Neon in development. Hosting is still verified only in T7.4. |
| Gemini availability, model IDs, rate limits, structured-output fields | T5.1 smoke call as soon as a key exists. It can run right after T1.5, in parallel with Phases 2–4 if needed |
| Cross-author data leaks | Ownership tests inside every endpoint task, plus the T2.7 route matrix that fails on unlisted routes |
| AI hallucinating facts or claiming completed actions | Allow-listed context (T5.5), structured `commitments` (T5.6), post-check (T5.7), eval (T5.9) |
| AI failure blocking ticket flow | AI is only invoked after the insert commits (T5.4). Drill in T6.3 |
| Dataset drift from the "exact records" requirement | Field-by-field `verifySeed` in tests and against production |

**Local development workflow.**
1. `docker compose up -d` (starts only the `bookleaf-*` containers), then `npm run dev`.
2. Work task by task (ask in plain language, e.g. "implement T2.1"; the `implement-task` skill applies). Check prerequisites, implement, run the standard checks from `CLAUDE.md`, update this board, then stop for the owner's review.
3. One commit per task, with a message that references the task ID. The owner commits, or Claude does only when explicitly asked; Claude never stages, commits or pushes on its own.
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
