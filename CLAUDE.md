# BookLeaf — Author Support & Communication Portal

BookLeaf Publishing's Author Support & Communication Portal: a web app with an author portal and an admin portal, AI-assisted ticket classification and response drafting, and a REST API.

**Engineering approach: production quality, proportionate effort.**
- Build it as a real production application: clean architecture, meaningful tests, sensible security and clear error handling.
- Prefer the simplest solution that fully meets the requirements, and keep the code easy to explain line by line.
- Add infrastructure, abstractions, safeguards or hardening only when a requirement or a concrete risk justifies it.
- Note minor limitations briefly instead of engineering them away. Don't over-invest in tooling or setup details that don't affect the product.

**Stack (approved):** Next.js App Router and TypeScript · Tailwind · Route Handlers as a REST API · PostgreSQL and Prisma · email/password auth (bcrypt via `bcryptjs`, HS256 JWT via `jose` in an HttpOnly cookie) · Gemini via `@google/genai` · Zod · Vitest · SWR (polling). Do not add other infrastructure or frameworks without asking.

This file is the central source of project rules. Skills in `.claude/skills/` describe workflows and refer back here instead of restating rules.

## Where things are
- `docs/requirements.md` — requirement IDs (AUTH-, BOOK-, TICKET-, QUEUE-, AI-, DRAFT-, MGMT-, API-, RT-, DEL-), dataset facts, KB policies and ambiguities. **This is the source of truth.**
- `docs/implementation-plan.md` — the task board and task details. Work one task at a time, in dependency order.
- `docs/architecture.md` — module boundaries, data model, endpoints, auth, AI design.
- `docs/adr/` — recorded decisions (index and conventions in `docs/adr/README.md`). Do not contradict an ADR silently; propose a superseding one.
- `docs/learning-notes/` — the owner's **personal, git-ignored** study notes on how the *implemented* code works (`project-setup.md`, `database.md`, `security.md`). Committed docs must not link to them, because they don't exist in the public repo.
- The product brief (PDF) and `bookleaf_sample_data.json` are **local and git-ignored**. Never commit them, paste them into public places, or send them to external services.
- **This repository is public.** Committed files must never reproduce the brief verbatim or embed dataset records. Paraphrase requirements and refer to records by ID.
  - Only the seed (`npm run db:seed`) and `npm run db:verify` read the local dataset JSON, at runtime.
  - Tests never read it; they use synthetic fixtures (see Testing).

## Module boundaries
- `src/app/api/**/route.ts`: thin handlers. Every handler is wrapped in `withApi({ role })`. They parse with Zod, call a service and return `{ data }` or the error envelope.
- `src/server/**`: server-only code (each file imports `server-only`). Services hold the business rules. `server/ai` is the only place that talks to the LLM, and `gemini.ts` is the only file that imports the SDK.
- `src/lib/**`: client-safe code only (schemas, labels, formatters, API client). It must never import from `src/server`.
- UI components never import Prisma or services. They use `/api/**` via the API client.

## Security and data integrity (non-negotiable)
- Every route except login verifies the JWT (algorithm pinned; issuer, audience and expiry checked; claims validated with Zod) and checks the role in the handler via `withApi`. `proxy.ts` and layouts are UX redirects only.
- The JWT lives only in the HttpOnly `bl_session` cookie (`SameSite=Lax`, `Secure` in production). Never put it in `localStorage`, a response body or a client-readable place. Logout clears the cookie.
- Author-scoped code takes `authorId` from the verified token, never from the URL, query or body. Every author query filters by it. Another author's record returns 404.
- Author responses use explicit `select` DTOs and never include internal notes, drafts, priority, AI fields or assignee.
- **Secrets** are read only from `src/server/env.ts`.
  - The exceptions are CLI entry points that can't import server-only code (`prisma.config.ts`, `prisma/seed.ts`, `prisma/verify.ts`); they read `process.env` directly (ADR-0007).
  - Never use a `NEXT_PUBLIC_` secret and never log keys.
  - Never commit `.env*`. Only the templates `.env.example` and `.env.test.example` are committed.
- Seed data must match the supplied JSON exactly. Never invent, "fix" or drop dataset records or fields. ISBNs are masked placeholders, so store them verbatim.
- AI output is validated with Zod before use. It is grounded only in allow-listed verified facts and the KB. It never claims an action (escalation, re-sync, reprint, refund, payment) has happened unless the app records it was performed. It is never sent to an author without an explicit admin send.
- AI failures must never block ticket creation, manual triage or manual replies.
- **Hosted and production resources:** never connect to, modify or deploy to a hosted or production resource without the owner's explicit approval for that specific operation. This covers Neon or any remote database, Vercel projects and environment variables, deployments, and creating cloud resources. Approval for one operation does not carry over to the next.
- **Database guards stay intact:**
  - the dev-only seed and verify guard (the Neon dev host registered in `DEV_DATABASE_HOST`, or local Docker dev);
  - the Prisma CLI guard in `prisma.config.ts` (ADR-0008);
  - the test-database guards;
  - Prisma's own AI-agent consent check.

  Never weaken, bypass or work around them (including with equivalent SQL) without the owner's explicit approval for that specific operation.

## Conventions
- TypeScript strict. No `any` without a comment explaining it. Validate all external input with Zod schemas from `src/lib/schemas`.
- Errors use `{ error: { code, message, details? } }` with the status codes in architecture §4. No bare 500s for expected failures.
- Money is integer rupees, formatted with `lib/format`. Dates are `@db.Date` for dataset dates.
- Prefer small named functions over clever abstractions. Comment the *why* for non-obvious logic (security checks, AI guardrails, policy maths).
- **Library references:**
  - **Next.js 16:** before using an unfamiliar API, read the version-matched guide in `node_modules/next/dist/docs/`. In route handlers `params` is a Promise, and Next 16 uses `proxy.ts`, not `middleware.ts`.
  - **Prisma 7, the Gemini SDK, Zod and other libraries:** check current docs (context7) for any API you're not certain about.

## Testing and verification
- **Standard checks, before a task is marked done:** `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm test`. Also run `npm run build` when routing, configuration or dependencies change, and at phase gates.
- **Test database:**
  - Tests use only the `bookleaf_test` DB (Docker container `bookleaf-db-test`, port 55433), loaded from `.env.test`, behind guards that abort on any other database (`tests/helpers/test-database.ts`, ADR-0008).
  - `npm test` resets it first, so the container must be running (`npm run db:up`).
- **Tests use synthetic fixtures only** (`tests/fixtures/`). Never load or assert on the confidential dataset in tests. The real-data check is the read-only `npm run db:verify` against the dev database.
- **Prisma CLI commands are guarded** by `prisma.config.ts`: only the dev DB (registered Neon host or local Docker) or the local test DB, and no `--url`. **The dev DB is the owner's Neon project.**
  - **Standing approval** (owner, 2026-10-31): routine non-destructive use for feature work, without asking each time. That covers running the app against it, `prisma migrate status`, `prisma migrate deploy` of committed migrations, `npm run db:seed` and `npm run db:verify`.
  - **Ask first** for any new kind of operation on it. Never run `migrate dev`, `migrate reset`, `db push` or any other destructive command against it without the owner's explicit approval for that specific operation. Never set `PRISMA_ALLOW_REMOTE_DATABASE` without the owner's explicit approval for that specific operation.
- **Prisma refuses `migrate reset` when run by an AI agent** without the owner's consent.
  - Ask the owner, stating the exact command, the target database and that the data will be destroyed.
  - Pass their exact consent text via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` for that operation only.
  - Never invent or reuse consent.
- Tests use a **fake AI generator** and never call the real Gemini API.
- Docker Compose project `bookleaf` only. Never stop, remove or prune other projects' containers or volumes.
- Every new API route needs: a happy path, validation failure, an entry in the 401/403 authz matrix, and a cross-author test where it touches author data.
- UI tasks are verified manually in the browser. State what was checked.

## Task boundaries
- Implement only the requested task's scope. Do not rewrite or refactor unrelated code. Do not add features, abstractions or dependencies "for later".
- Never silently skip a requirement or acceptance criterion. If something can't be done, say so, mark the task `blocked` and give the reason.
- **After completing the requested task, stop and wait for the owner's approval before starting another.** Suggest the next task; don't begin it.
- **Do not stage, commit or push unless the owner explicitly asks.** Use plain `rm`, not `git rm`, which stages. When asked to commit: one task per commit, with the task ID in the message (e.g. `T3.4: ticket creation API`).
- Explain significant trade-offs briefly, in plain language, so the owner can explain and defend them.

## Documentation (proportional)
Update documentation only when something meaningful changed. If nothing did, leave it untouched. Prefer editing an existing document over creating a new one. Each fact lives in one place:
- **why** → ADR
- **what the system is and does** → architecture
- **status and outcomes** → plan
- **study material** → learning notes

The others link to it rather than repeating it.

- **Task board** (`docs/implementation-plan.md`):
  - Update the status when a task starts, finishes or is blocked.
  - Change a task's scope or dependencies when they genuinely change.
  - A finished task gets a brief **Outcome** note: deviations, key evidence and follow-ups, at most about 5 bullets. Not a full report.
- **ADRs:**
  - **Before a significant technical decision, check `docs/adr/README.md`.** Follow an accepted ADR, or propose a superseding one; never silently diverge.
  - **Create or update an ADR only for a genuinely significant architectural or technical decision,** i.e. one that affects several modules, is costly to reverse, or is likely to be questioned later. Most tasks need none. Routine implementation, dependency additions, refactoring and minor configuration changes never need one.
  - **Follow the `docs/adr/README.md` conventions:**
    - say who decided;
    - list only alternatives that were actually considered;
    - record factual corrections under **History**;
    - never rewrite an accepted decision; supersede it instead.
  - Keep each ADR's **Implementation** line and the index's Implementation column current when a task changes what is implemented.
- **Architecture (`docs/architecture.md`):** update only when the actual architecture or documented behaviour changes, or when the code and the doc disagree. Fix whichever is wrong, and say so.
- **Learning notes:**
  - Update a note only when a feature introduces concepts or implementation details worth studying. Cover:
    - what it does here, and why;
    - how it works, with real files and functions;
    - non-obvious details and trade-offs;
    - failure and security cases;
    - likely questions, with short answers.
  - Add to the relevant existing note. Create a new one only for a genuinely new area (e.g. `auth.md` when auth lands).
  - Never document unimplemented behaviour as if it exists.
- **Never fabricate.** No invented rationale, implementation details, alternatives, test results or command output. If the reasoning behind an earlier decision wasn't recorded, write "rationale not recorded". Report a check that wasn't run as not run.

## Task completion report
This is the canonical format; skills refer to it. Scale it to the task: a line or two per section for small tasks, and omit sections that don't apply. Every task report includes:
1. **Implementation walkthrough:** a short, concrete explanation of the flow through the new or changed code (files, key functions, the order things happen in), so the owner can explain it.
2. **Acceptance criteria:** each one, with how it was verified, or why it wasn't.
3. **Verification:** the commands actually run and their real results, including failures and anything not verified.
4. **Decisions:**
   - **Existing decisions applied:** ADRs or architecture sections followed.
   - **New decisions introduced:** what, why, and where it's recorded (ADR, architecture or plan note). Kept clearly separate.
   - **Trade-offs:** in one or two plain sentences each.
5. **Files:** exact paths, grouped as new, modified and deleted. Also list dependencies added, and documentation updated (or "none needed").
6. **Assumptions, limitations and unresolved issues**, including deviations from the task scope.
7. **Next task:** the suggested next task ID. Do not start it (see Task boundaries).
