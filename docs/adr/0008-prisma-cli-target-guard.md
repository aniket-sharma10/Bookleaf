# 0008. Guard every Prisma CLI command's database target in `prisma.config.ts`

- **Status:** Proposed. Implemented in T1.7 under the owner's instruction to add migration safety. The mechanism (a config-level guard, refusing `--url`, an explicit remote opt-in) was chosen by the assistant and awaits the owner's approval.
- **Date:** 2026-10-31
- **Implementation:** implemented.
  - `prisma/db-target.ts` (`assertPrismaCliTarget`) and `prisma.config.ts` (T1.7).
  - Unit tests in `tests/db-target.test.ts`, plus manual CLI checks recorded in the T1.7 outcome note.
- **Requirements:** DEL-08, DATA-01 (protecting dataset and test data); supports ADR-0006

## Context
ADR-0006 left an open gap: only the seed checked its target, while Prisma CLI commands such as `migrate reset` and `migrate dev` did not. Facts established in T1.7:
- **Every Prisma 7 CLI command loads `prisma.config.ts` first.** `migrate reset`, `migrate deploy` and `db execute` (whose `--url` flag v7 removed) take the URL only from it. Ours is `DIRECT_URL || DATABASE_URL`.
- **`.env` doesn't override the shell.** The config loads `.env` with `process.loadEnvFile`, which never overrides variables already set. So a URL exported in the shell, including a `DIRECT_URL`, wins over `.env`.
- **`--url` bypasses the config.** `migrate dev` and `db push` accept `--url`, which overrides the config's URL, so a check on that value alone can be bypassed.
- **`--config` bypasses it entirely,** by pointing the CLI at a different config file.
- **Prisma 7 has its own check for AI agents.** It refuses `migrate reset` when it detects one, unless the user's consent text is supplied in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. This was observed in T1.7. It protects against agents only, not against people.

## Decision
- **One guard for every CLI command.** `prisma.config.ts` calls `assertPrismaCliTarget({ url, argv, allowRemote })` before exporting the config, so it runs for every Prisma CLI command:
  - **No URL** (e.g. `prisma generate`): allowed.
  - **Otherwise:** the URL must be exactly the local dev database (`127.0.0.1`/`localhost`/`[::1]`, port `55432`, `bookleaf_dev`) or the local test database (`55433`, `bookleaf_test`).
  - **`--url`** (both `--url=` and `--url <value>`) is refused, because it would bypass the check.
  - **Opt-in:** `PRISMA_ALLOW_REMOTE_DATABASE=true` (exactly `true`) skips the guard for a deliberate remote operation. It is meant to be set per command, never exported for a whole shell session.
- **The test harness adds its own guard.** `resetTestDatabase()` in `tests/helpers/test-database.ts`:
  1. accepts only `bookleaf_test` and `NODE_ENV=test`;
  2. sets `DATABASE_URL` from `.env.test`, forces `DIRECT_URL=""` and strips the opt-in, so the config guard always applies too;
  3. only then runs `prisma migrate reset --force`.

  `truncateAllTables()` re-checks `current_database()` on the live connection before truncating.
- **The seed and `db:verify` keep their stricter, dev-only guard,** shared through the same module. Their rules are unchanged.

## Rationale
- `prisma.config.ts` is the single place every Prisma CLI command passes through. A guard there protects raw `npx prisma …` commands too, not just npm scripts.
- It checks the URL Prisma will actually use, after `.env` loading and `DIRECT_URL` precedence, so a stray shell export is caught rather than trusted.
- Allowing only exact local targets (instead of blocking known remote hosts) fails safe for any database nobody anticipated, including other local Postgres instances.

## Alternatives considered
- **Guarding only in npm wrapper scripts.** Rejected: running `npx prisma migrate reset` directly would bypass it.
- **Blocking only destructive subcommands remotely, detected by parsing argv** (allowing e.g. `migrate deploy` remotely without opt-in). Rejected as brittle coupling to the CLI's argument layout. The explicit per-command opt-in is simpler to reason about.
- **Relying on Prisma's built-in AI-agent consent check.** Not sufficient: it only applies when an agent is detected, and only to some commands.

## Consequences
- **Deployments need the opt-in.** Builds that run Prisma against the hosted database (`prisma generate` or `migrate deploy` with a Neon `DATABASE_URL`, e.g. on Vercel) must set `PRISMA_ALLOW_REMOTE_DATABASE=true` in that environment. This is a T1.8 setup step.
- **The opt-in has no limits.** It allows every command, destructive ones included, against the remote target. Its safety relies on it being set per command, deliberately.
- **Remaining bypasses (documented limitations):**
  - `--config <other file>` skips this config, and with it the guard.
  - A future Prisma flag that overrides the URL under another name would not be caught. Tests cover today's `--url` forms only.
- **The AI-agent consent prompt.** When an AI agent runs the suite, Prisma's own check requires the owner's consent text for `migrate reset`. Whether it ever triggers for a person running `npm test` was not verified.
- **`npm test` now needs the `bookleaf-db-test` container running** (`npm run db:up`), because the suite resets that database before any test runs.
