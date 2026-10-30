---
name: review-security
description: Security review of the BookLeaf portal — authentication (JWT cookie), role checks, cross-author data ownership, input validation, CSRF, secret handling and AI-specific risks (prompt injection, data leakage into prompts, unverified claims). Use after finishing an auth, API or AI task, before a phase gate, before deployment, or when the user asks for a security check.
argument-hint: "[optional: path or task ID to focus on; default = whole app]"
---

# Security review

Scope: `$ARGUMENTS` (if empty, review the whole application).

Review the code; don't assume. Findings must cite `file:line` and describe a concrete failure scenario. Report only real or plausible issues, not style.

## Checklist

**Authentication and JWT** (`src/server/auth`, `src/app/api/auth`)
- `jwtVerify` pins `algorithms: ['HS256']` and checks `issuer` and `audience`. Expiry is enforced. Claims are Zod-validated: the role is a valid enum, and `authorId` is present if and only if the role is `AUTHOR`. There is no `decodeJwt`-without-verify anywhere.
- `AUTH_JWT_SECRET` is read only via `server/env.ts`, is at least 32 bytes, and is never logged or given a `NEXT_PUBLIC_` prefix.
- Claims carry no sensitive data. The lifetime is short (8 hours).
- The token is only in the `bl_session` cookie, with `HttpOnly`, `SameSite=Lax`, `Secure` in production and `Path=/`. It is never in a response body, `localStorage` or client-readable state. Logout clears the cookie.
- Login uses a bcrypt compare and the same generic error for an unknown email and a wrong password. A dummy compare prevents timing-based user enumeration.

**Authorization boundary** (`src/app/api/**/route.ts`)
- Enumerate every route file. Each one, except login, is wrapped in `withApi` with the correct `role`. Confirm the authz matrix test lists every route.
- Nothing relies on `proxy.ts` or layouts for protection.
- Admin-only mutations (status, overrides, notes, drafts, classification) reject authors.
- `assigneeId` is limited to the caller or null.

**Ownership and data exposure**
- Author services derive `authorId` from the verified token only. Search for `authorId` coming from params, the body or query strings.
- Every author-facing Prisma query filters by `authorId`. A `findUnique` by ID followed by a missing ownership check is a bug.
- `bookId` on ticket creation is verified to belong to the author.
- Author DTOs use explicit `select` with no notes, drafts, AI fields, priority or assignee. Check list and detail endpoints, and error messages.

**Input validation and errors**
- Every body and query is parsed with Zod, with length limits on free text. IDs are validated.
- Errors don't leak stack traces, SQL or internal IDs. Unknown errors are logged server-side and return a generic 500.
- Mutations check Origin and Content-Type (CSRF).

**Secrets and configuration**
- `git grep -nE "AIza|GEMINI_API_KEY\s*=|postgres(ql)?://[^ ]*:[^ ]*@"` finds only `.env.example` placeholders.
- No `NEXT_PUBLIC_` secret. `src/server/**` files import `server-only`. After `npm run build`, grep `.next/static` for the key and for `GEMINI`.
- `.gitignore` covers `.env*`, the PDF and the dataset JSON. `git ls-files` shows none of them.

**AI-specific**
- Ticket text is delimited as untrusted data in prompts. There is no tool or function calling. The output is Zod-validated before use.
- The draft context contains no internal notes, author email, phone or city, and no other authors' data.
- Drafts are never sent automatically. The `commitments` and `needsVerification` fields and the safety warnings are visible to the admin.
- A late classification never overwrites admin overrides.
- AI errors never surface provider error bodies to clients.

## Output
List findings grouped as **Critical / High / Medium / Low**. Each finding includes the file and line, the issue, the exploit or failure scenario, and a minimal fix. Then give a short "Verified OK" list of the checklist areas you confirmed. If asked to fix, make minimal changes, add a regression test per finding, and re-run `npm test`.
