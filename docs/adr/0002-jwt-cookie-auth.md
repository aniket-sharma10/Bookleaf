# 0002. Email/password auth with a signed JWT in an HttpOnly cookie

- **Status:** Accepted (decided by the project owner, 2026-10-30; replaces the earlier *proposed* database-session design, which was never accepted)
- **Date:** 2026-10-30
- **Implementation:** partial. Done:
  - password hashing (`src/server/auth/password.ts`, T2.2);
  - token and cookie helpers (`jwt.ts`, `cookie.ts`, T2.3);
  - API and page guards (`session.ts`, `guards.ts`, `withApi` access levels, T2.4).

  Still to come: login and logout routes, pages, and the authz test matrix (T2.5–T2.7).
- **Requirements:** AUTH-01–08, API-05

## Context
- Login is email and password only, for two roles. The admin accounts are seeded because the dataset has none.
- The brief requires authentication middleware, role-based access and per-author data isolation.
- The owner wants auth that is simple, secure, testable and fully explainable, with no external provider, OAuth or OTP.
- No library performs per-record authorization for us, so that code is ours either way.

## Decision
- **Passwords:** bcrypt (`bcryptjs`), cost 12. An unknown email still triggers a dummy compare, so response time doesn't reveal which emails exist.
- **Login** issues an HS256 JWT signed with `jose` using the server-only `AUTH_JWT_SECRET`.
  - Claims: `sub`, `role`, `authorId` (null for admins), `iss` and `aud`, and `exp` 8 hours after issue.
- **Storage:** the token is held only in the `bl_session` cookie, with `HttpOnly`, `SameSite=Lax`, `Secure` in production and `Path=/`.
  - It is never returned in a response body, stored in `localStorage` or readable by client JavaScript.
- **Verification:** every protected route handler is wrapped in `withApi(handler, { access })`, which:
  - verifies the signature with the algorithm pinned, plus issuer, audience and expiry;
  - validates the claims with Zod;
  - enforces the role.

  `proxy.ts` and portal layouts only redirect, as a UX convenience.
- **Data scoping:** author services take `authorId` only from the verified token, never from params, query or body. Another author's record returns 404.
- **Logout** clears the cookie.
- **CSRF:** SameSite=Lax, plus an Origin check on mutating requests.

## Rationale
- The owner chose this approach explicitly: simple email/password auth (which the brief permits), kept "straightforward, secure, and testable".
- An HttpOnly cookie keeps the token out of reach of client JavaScript, so an XSS bug cannot read it.
- A stateless token needs no session table and no DB lookup per request.
- Verification is one pure function, which makes it easy to unit-test.

## Alternatives considered
- **Database-backed opaque sessions.** These allow real server-side logout and revocation, at the cost of a Session table and a DB lookup per request. They were the earlier proposal; the owner chose the stateless approach for simplicity.
- **Auth.js, Better Auth or another provider.** More configuration and abstraction than two-role credentials login needs, and authorization would still be hand-written.
- **JWT in `localStorage` or an `Authorization: Bearer` header.** Exposed to XSS token theft. Rejected.

## Consequences
- **Upsides:** no session table and no DB lookup per request. The code is small (password, JWT and guard modules) and easy to unit test, because handlers read the cookie from the `Request` object.
- **Logout is client-side only.** A token copied before logout stays valid until `exp`. Mitigations: an 8-hour lifetime, HttpOnly (JavaScript can't read the token) and HTTPS. A production fix would add a `tokenVersion` on User or a short deny-list.
- **Claims are trusted until expiry.** Role changes or user deletion take effect only after the token expires, which is acceptable here: seeded users are never deleted and roles never change.
- **Secret management:**
  - `AUTH_JWT_SECRET` must be strong and different per environment.
  - Rotating it signs everyone out.
  - It is format-checked by `server/env.ts` when first read and fetched with `requireEnv`, so a missing secret fails at the first auth operation, not at boot (ADR-0007).
- **Out of scope:** password reset, email verification and login rate limiting. They are documented as limitations.

## History
- **2026-10-27:** this ADR number was first used for a *proposed* design: hand-rolled, database-backed opaque sessions (hashed tokens in a `Session` table). It was never accepted or committed.
- **2026-10-30:** the owner decided on the JWT-cookie approach, and the proposal was rewritten in place before the repository's first docs commit. The original text is therefore not in git history. Its substance survives as the first alternative above.
- **2026-10-30:** corrected the secret-validation consequence, which had said "validated at startup", to match ADR-0007.
- **2026-10-31:** added the **Implementation** and **Rationale** sections (documentation-format update). The decision is unchanged. The rationale was drawn from the owner's recorded instructions and the existing text.
- **2026-10-31 (T2.4):** naming correction only: `withApi({ role })` became `withApi(handler, { access })`, with access levels `PUBLIC`, `AUTHENTICATED`, `AUTHOR` and `ADMIN`, so that public and any-user routes can be declared explicitly. The decision is unchanged.
