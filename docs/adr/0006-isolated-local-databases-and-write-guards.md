# 0006. Isolated local databases and write-target guards

- **Status:** Accepted. Separate dev and test databases, project-namespaced Docker resources and a production database kept separate were the owner's instructions (2026-10-30). The guard details were implemented under that instruction.
- **Date:** 2026-10-30 (retrospective)
- **Implementation:** implemented.
  - `docker-compose.yml` (T1.4).
  - The seed target guard (T1.6), now in `prisma/db-target.ts`.
  - The test-database guard and reset (T1.7): `tests/helpers/test-database.ts`, `tests/helpers/test-db-client.ts`.
  - The Prisma CLI guard (T1.7, ADR-0008).
- **Requirements:** DEL-08, DATA-01

## Context
- Integration tests reset and re-seed a database, so they must never be able to run against development or production data.
- The developer's machine already runs other projects' Docker containers, including another Postgres.
- Production will be a hosted database (Neon), and its URL must never sit in local env files.
- The dataset seed writes data, so it is a second place where a wrong target would be harmful.

## Decision
- **Docker Compose project `bookleaf`** with two services on the stock `postgres:16-alpine` image:
  - `bookleaf-db-dev`: `127.0.0.1:55432`, persistent named volume.
  - `bookleaf-db-test`: `127.0.0.1:55433`, `tmpfs`, so its data is disposable.
- **Ports:** both bind to loopback only, on non-default ports.
- **Guards:** every database-writing tool checks its target before connecting, by host, port and database name.
  - **The seed** accepts only `localhost`/`127.0.0.1`/`[::1]` on port `55432`, database `bookleaf_dev`. It also refuses when `NODE_ENV=production`.
  - **The test harness (T1.7)** accepts only `bookleaf_test` on `55433`, and only in test mode.
- **The production URL** is set only in the hosting provider, never in `.env` or `.env.test`.

## Rationale
- **The owner's instructions:** separate dev and test databases; namespace the Docker resources because other projects' containers exist; tests must not be able to run against dev or prod.
- **Non-default ports:** another project's Postgres was observed running locally when T1.4 was set up, so the standard ports could clash.
- **`tmpfs` for tests:** the test database is rebuilt on every run, so persistence has no value.
- **Guard placement:** each check sits inside the tool that writes. It is not left to developer discipline or to which `.env` file happens to be loaded.

## Alternatives considered
- **One container holding both `bookleaf_dev` and `bookleaf_test`** (the first planning draft, using an init script). Replaced by two services before the first commit, giving separate lifecycles and in-memory storage for tests. The deciding reasoning was not otherwise recorded.

## Consequences
- **Memory:** two containers use more memory than one. The test database loses its data whenever it restarts, which is intended.
- **Migrations were not guarded** when this ADR was written (T1.6). This gap is addressed by ADR-0008. Original note: only the seed was guarded; Prisma CLI commands were not. `prisma.config.ts` migrates `DIRECT_URL || DATABASE_URL`, and `process.loadEnvFile` does not override variables already exported in the shell. So a production URL exported in the terminal would be used by `prisma migrate dev` or `prisma migrate reset`. At the time this was an open gap.
- **Seeding production will need a deliberate change.** The guard blocks every database except local dev, so seeding the hosted database (T1.8, T7.4) needs an explicit, reviewed override.

## History
- **2026-10-31 (T1.7):** factual updates, decision unchanged.
  - The Implementation line now covers the test-database guard and the Prisma CLI guard.
  - The seed guard moved from `prisma/seed-target.ts` into the shared `prisma/db-target.ts`, with the same rules.
  - The "migrations are not guarded" consequence now points to ADR-0008, which addresses it.
