# BookLeaf — Author Support & Communication Portal

Work in progress. The full README (setup, credentials, architecture, AI integration, API docs) arrives in task T7.5. See `docs/` for requirements, architecture and the implementation plan.

## Development (current state)

- Node.js 24 LTS (`.nvmrc`; Next.js 16 needs Node ≥ 20.9)
- Next.js 16.4 (App Router, Turbopack, `src/` directory, `@/*` alias), React 19, Tailwind CSS 4, TypeScript

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint       # ESLint (eslint-config-next)
npm run typecheck  # next typegen + tsc --noEmit (strict)
npm run format     # Prettier write (format:check to verify)
npm test           # Vitest (test:watch for watch mode)
npm run build      # production build
```
