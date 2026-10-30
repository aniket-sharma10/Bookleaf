# 0002. Email/password auth with a signed JWT in an HttpOnly cookie

- **Status:** Accepted (decided by the project owner, 2026-10-30; replaces the earlier *proposed* database-session design, which was never accepted)
- **Date:** 2026-10-30
- **Requirements:** AUTH-01–08, API-05

## Context
- Login is email and password only, for two roles. The admin accounts are seeded because the dataset has none.
- The brief evaluates authentication middleware, role-based access and per-author data isolation.
- The owner wants auth that is simple, secure, testable and fully explainable, with no external provider, OAuth or OTP.
- No library performs per-record authorization for us, so that code is ours either way.

## Decision
- **Passwords:** bcrypt (`bcryptjs`), cost 12. An unknown email still triggers a dummy compare, so response time doesn't reveal which emails exist.
- **Login** issues an HS256 JWT signed with `jose` using the server-only `AUTH_JWT_SECRET`.
  - Claims: `sub`, `role`, `authorId` (null for admins), `iss` and `aud`, and `exp` 8 hours after issue.
- **Storage:** the token is held only in the `bl_session` cookie, with `HttpOnly`, `SameSite=Lax`, `Secure` in production and `Path=/`.
  - It is never returned in a response body, stored in `localStorage` or readable by client JavaScript.
- **Verification:** every protected route handler is wrapped in `withApi({ role })`, which:
  - verifies the signature with the algorithm pinned, plus issuer, audience and expiry;
  - validates the claims with Zod;
  - enforces the role.

  `proxy.ts` and portal layouts only redirect, as a UX convenience.
- **Data scoping:** author services take `authorId` only from the verified token, never from params, query or body. Another author's record returns 404.
- **Logout** clears the cookie.
- **CSRF:** SameSite=Lax, plus an Origin check on mutating requests.

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
  - It is validated at startup by `server/env.ts`.
- **Out of scope:** password reset, email verification and login rate limiting. They are documented as limitations.
