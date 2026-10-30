# 0007. Lazy environment validation with point-of-use requirements

- **Status:** Accepted. The owner's T1.3 instruction (2026-10-30) said the app must not fail at startup because a not-yet-implemented integration is unconfigured.
- **Date:** 2026-10-30 (retrospective)
- **Implementation:** implemented. `src/server/env.ts` and `src/server/env.test.ts` (T1.3). `src/server/db.ts` uses `requireEnv` (T1.4).
- **Requirements:** AI-09, DEL-09

## Context
- Secrets (the database URL, JWT secret and Gemini key) must stay server-side and be validated.
- The features that need them arrive over several tasks. The app had to build and run before auth or AI existed, and must keep working when Gemini is not configured at all (AI-07).
- CLI tools (the Prisma CLI and the seed) run outside Next.js, where the `server-only` module throws.

## Decision
- `src/server/env.ts` imports `server-only` and defines one Zod schema. **Every variable is optional, but must be valid if set.** Empty strings count as "not set".
- `getEnv()` parses `process.env` on first call and caches the result. `requireEnv(name)` returns a value, or throws `EnvError` naming the missing variable.
- Error messages list variable names and rules, never values.
- CLI entry points (`prisma.config.ts`, `prisma/seed.ts`) don't import `env.ts`. They load `.env` with Node's `process.loadEnvFile()` and read `process.env` directly.

## Rationale
- The owner's T1.3 instruction: don't require credentials for features that aren't implemented, and avoid startup failures caused by a future integration's missing key.
- Failing at the point of use names the exact feature that is misconfigured, and lets an AI-less deployment run normally.
- `process.loadEnvFile()` is built into Node, so no `dotenv` dependency is needed (T1.4).

## Alternatives considered
- **Fail fast at startup with required variables.** This was the wording in the first committed architecture ("fails fast with a clear message"). It was dropped in T1.3 because of the owner's instruction above.
- **The `dotenv` package for CLI tools.** Prisma's documentation uses it. It wasn't adopted because the built-in loader does the same job.

## Consequences
- **A missing required variable surfaces at the first request that needs it, not at deploy time.** A deployment with no `DATABASE_URL` builds successfully and only fails when a database call is made. The deploy smoke test (T1.8, T7.4) must catch this. A production-only startup check is an open option, not decided.
- **Two env-reading paths exist:** `env.ts` for app code, and `process.env` in the two CLI files. `CLAUDE.md` lists both CLI files as the only exceptions.
- **Tests must reset the module cache** (`vi.resetModules()`) to see changed variables, because `getEnv()` caches.
