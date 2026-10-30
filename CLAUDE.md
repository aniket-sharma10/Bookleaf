# BookLeaf — Author Support & Communication Portal

A take-home assignment for BookLeaf Publishing (Full-Stack Developer). It is a web app with an author portal and an admin portal, AI-assisted ticket classification and response drafting, and a REST API. The owner has limited time and must be able to explain every line in a technical interview.

**Stack (approved):** Next.js App Router and TypeScript · Tailwind · Route Handlers as a REST API · PostgreSQL and Prisma · email/password auth (bcrypt via `bcryptjs`, HS256 JWT via `jose` in an HttpOnly cookie) · Gemini via `@google/genai` · Zod · Vitest · SWR (polling). Do not add other infrastructure or frameworks without asking.

## Where things are
- `docs/requirements.md` — requirement IDs (AUTH-, BOOK-, TICKET-, QUEUE-, AI-, DRAFT-, MGMT-, API-, RT-, DEL-), dataset facts, KB policies and ambiguities. **This is the source of truth.**
- `docs/implementation-plan.md` — the task board and task details. Work one task at a time, in dependency order.
- `docs/architecture.md` — module boundaries, data model, endpoints, auth, AI design.
- `docs/adr/` — recorded decisions. Do not contradict an ADR silently; propose a superseding one.
- The assignment PDF and `bookleaf_sample_data.json` are **local and git-ignored**. Never commit them, paste them into public places, or send them to external services.
- **This repository is public** (confirmed with HR). Committed files must never reproduce the brief verbatim or embed dataset records. Paraphrase requirements, refer to records by ID, and have tests and the seed read expected values from the local JSON at runtime.

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
- Secrets are read only from `src/server/env.ts` (the sole exception is `prisma.config.ts`, which runs in the Prisma CLI). Never use a `NEXT_PUBLIC_` secret, never log keys, never commit `.env*` (except `.env.example`).
- Seed data must match the supplied JSON exactly. Never invent, "fix" or drop dataset records or fields. ISBNs are masked placeholders, so store them verbatim.
- AI output is validated with Zod before use. It is grounded only in allow-listed verified facts and the KB. It never claims an action (escalation, re-sync, reprint, refund, payment) has happened unless the app records it was performed. It is never sent to an author without an explicit admin send.
- AI failures must never block ticket creation, manual triage or manual replies.

## Conventions
- TypeScript strict. No `any` without a comment explaining it. Validate all external input with Zod schemas from `src/lib/schemas`.
- Errors use `{ error: { code, message, details? } }` with the status codes in architecture §4. No bare 500s for expected failures.
- Money is integer rupees, formatted with `lib/format`. Dates are `@db.Date` for dataset dates.
- Prefer small named functions over clever abstractions. Comment the *why* for non-obvious logic (security checks, AI guardrails, policy maths).
- In Next 15+ route handlers, `params` is a Promise. Next 16 uses `proxy.ts`, not `middleware.ts`. Before using an unfamiliar Next.js API, read the version-matched guide in `node_modules/next/dist/docs/`. For Prisma 7 and the Gemini SDK, check current docs (context7).

## Testing and verification
- `npm run lint && npm run typecheck && npm test` must pass before a task is marked done. Run `npm run build` at phase gates.
- Tests use only the `bookleaf_test` DB (Docker container `bookleaf-db-test`, port 55433), loaded from `.env.test`, behind a guard that aborts on any other database. Tests use a **fake AI generator** and never call the real Gemini API.
- Docker Compose project `bookleaf` only. Never stop, remove or prune other projects' containers or volumes.
- Every new API route needs: a happy path, validation failure, an entry in the 401/403 authz matrix, and a cross-author test where it touches author data.
- UI tasks are verified manually in the browser. State what was checked.

## Working rules
- Implement only the requested task's scope. Do not rewrite or refactor unrelated code. Do not add features, abstractions or dependencies "for later".
- Never silently skip a requirement or acceptance criterion. If something can't be done, say so, mark the task `blocked` and give the reason.
- When starting or finishing a task, update its status in `docs/implementation-plan.md`. If a decision changes the design, update `docs/architecture.md` and, if significant, add an ADR.
- Explain significant trade-offs briefly in your summary, in plain language, so the owner can defend them in the interview.
- Commit only when asked. One task per commit, with the task ID in the message (e.g. `T3.4: ticket creation API`).
