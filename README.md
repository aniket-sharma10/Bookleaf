# BookLeaf — Author Support & Communication Portal

Work in progress. The full README (setup, credentials, architecture, AI integration, API docs) arrives in task T7.5. See `docs/` for requirements, architecture and the implementation plan.

## Development (current state)

- Node.js 24 LTS (`.nvmrc`; Prisma 7 needs Node ≥ 20.19)
- Docker (for the local PostgreSQL containers)
- Next.js 16.4 (App Router, Turbopack, `src/` directory, `@/*` alias), React 19, Tailwind CSS 4, TypeScript

Development data lives in a Neon Postgres project. Set `DATABASE_URL` (pooled), `DIRECT_URL` (direct) and `DEV_DATABASE_HOST` (the direct host) in `.env`; see `.env.example`.
Tests use a disposable local Docker database, `bookleaf-db-test` on `127.0.0.1:55433` (Compose project `bookleaf`, Postgres 16). A local `bookleaf-db-dev` on `127.0.0.1:55432` is an optional alternative to Neon.

```bash
cp .env.example .env    # then fill in the Neon values; never commit .env
npm install             # also runs `prisma generate` (postinstall)
npm run db:up           # start the local Docker databases (the test DB is needed by npm test)
npx prisma migrate deploy   # apply migrations to the dev database (Neon)
npm run db:seed             # load the supplied authors/books (needs bookleaf_sample_data.json in the project root, or SEED_DATA_PATH)
npm run db:verify           # read-only: confirm the dev database matches the dataset field by field
npm run dev        # http://localhost:3000
npm run lint       # ESLint (eslint-config-next)
npm run typecheck  # next typegen + tsc --noEmit (strict)
npm run format     # Prettier write (format:check to verify)
npm test           # Vitest: resets + migrates bookleaf_test first (needs `cp .env.test.example .env.test` and `npm run db:up`)
npm run build      # production build
npm run db:down    # stop and remove the containers (dev data volume is kept)
```

Prisma CLI commands may only target the dev database (the registered Neon host or local Docker) or the local test database. The `--url` override is refused, and a remote database needs `PRISMA_ALLOW_REMOTE_DATABASE=true` for that one command (see `docs/adr/0008-prisma-cli-target-guard.md`).
