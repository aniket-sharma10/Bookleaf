# 0001. Single Next.js app with REST Route Handlers

- **Status:** Accepted (the stack was specified by the project owner in the planning brief)
- **Date:** 2026-10-27
- **Implementation:** implemented. Both portals' pages, 14 endpoints in 12 Route Handlers under `src/app/api/`, and the service layer in `src/server/services/` (Phases 2–6).
- **Requirements:** API-01, API-04, DEL-03, DEL-10

## Context
The product needs an author portal, an admin portal and a clean REST API between frontend and backend. It must be deployed to a live URL and built by a small team in limited time, with code that stays easy to understand. Architecture, code quality and API design are priorities.

## Decision
Build one Next.js (App Router, TypeScript) application:
- The REST API is implemented as Route Handlers under `/api/auth`, `/api/author` and `/api/admin`.
- Client components read and write data **only** through these endpoints.
- Business logic lives in a server-only service layer (`src/server/services`), which handlers call.
- Server Actions are not used for data mutations.

## Rationale
- The owner's planning brief asked for one deployable application rather than separate frontend and backend services, and named Route Handlers as the REST layer.
- The brief's API section asks for a clean REST API with documented endpoints, so the API must exist as explicit HTTP routes rather than framework-internal calls.
- One codebase keeps the work explainable by a single developer under time pressure.

## Alternatives considered
- **Separate Express/Fastify API plus React SPA.** This gives a cleaner physical separation, but means two deployments, CORS and cross-site cookie configuration, and duplicated types. No requirement needs independent scaling.
- **Next.js with Server Actions or RSC data fetching.** This needs less code, but there is no explicit REST surface to document, which conflicts with the brief's API requirements.

## Consequences
- One deployment and one set of env vars. Types and Zod schemas are shared between UI and API.
- Handler → service → Prisma layering keeps the "backend" separable. It could be extracted into its own service later without rewriting business logic.
- Pages give up some RSC data-fetching benefits, because data is fetched client-side via the API. This is acceptable for an internal-tool-style UI.
- Security must not rely on `proxy.ts` (middleware). Every handler enforces auth itself (see architecture §5).

## History
- **2026-10-31:** added the **Implementation** and **Rationale** sections (documentation-format update). The decision is unchanged. The rationale was drawn from the owner's recorded instructions and the existing text.
