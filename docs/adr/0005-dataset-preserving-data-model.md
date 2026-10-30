# 0005. Dataset-preserving data model

- **Status:** Accepted. The modelling was proposed during planning and approved by the owner with the architecture on 2026-10-30. The exact-preservation rules come from the owner's instructions.
- **Date:** 2026-10-30 (retrospective record of decisions made 2026-10-27 to 30)
- **Implementation:** implemented. `prisma/schema.prisma` and `prisma/migrations/*_init` (T1.5); `prisma/dataset.ts` and `prisma/seed.ts` (T1.6). Effective-vs-AI field behaviour is enforced in code later (T5.3).
- **Requirements:** DATA-01, DATA-02, BOOK-01–04, MGMT-02, AI-03, AI-04, AI-06, AUTH-06

## Context
- The app must work out of the box with the exact supplied records, so the seeded data must match the JSON field for field.
- The dataset has masked placeholder ISBNs, nullable fields for books still in production, empty platform lists, and money as whole rupees.
- There are no users, admins or tickets in the data.
- Admins must be able to override AI classification, and internal notes must never reach authors.

## Decision
1. **Dataset IDs are the primary keys** for `Author` and `Book` (e.g. `AUTH001`, `BK001`). The seed upserts by these IDs.
2. **Values are stored as supplied:**
   - Money is `Int` (whole rupees). Dataset dates are Postgres `DATE`.
   - `Book.status` is free text.
   - `isbn` is text with a unique constraint and no format validation.
   - `availableOn` is `text[]`.
   - Nullable dataset fields stay nullable.
3. **Credentials live in `User`, separate from `Author`.**
   - The link is an optional, unique `authorId` (1:1).
   - A hand-written SQL CHECK requires `authorId` exactly when `role = 'AUTHOR'`.
4. **Two sets of classification fields on `Ticket`:**
   - `category`/`priority` hold the effective values, which the queue uses and admins write.
   - `aiCategory`/`aiPriority` hold the model's original suggestion.
5. **Internal notes have their own table** (`InternalNote`). They are not a flag on `TicketMessage`.
6. **Delete rules:**
   - `Restrict` for dataset records and for users that content refers to.
   - `Cascade` from a ticket to its messages, notes and drafts.
   - `SetNull` for optional links.

## Rationale
- **(1)** Keeps every row traceable to the JSON, and makes re-seeding a simple, idempotent upsert. This was documented in architecture §3.
- **(2)** The owner's instructions require values to be preserved, with nothing calculated, normalised or overwritten. Free-text status was chosen because the source values must round-trip exactly (architecture §9). `Int` for money: every supplied amount is a whole number; the choice of `Int` over `Decimal` was not otherwise recorded.
- **(3)** One login path for both roles. Admins need no fake Author row. The CHECK guarantees author-scoped code can rely on `User.authorId` (architecture §3, T1.5).
- **(4)** Keeping the AI's original values lets "overridden" be derived, and lets the AI write effective values only while they are null, so it never overwrites an admin choice (AI-06).
- **(5)** A separate table means author-facing queries can't select notes by accident (architecture §3).
- **(6)** Rationale for the delete rules was written down at implementation time (T1.5): history must not disappear silently, while a ticket's own children go with it.

## Alternatives considered
- **Book status as a Postgres enum:** rejected because the values must round-trip verbatim (architecture §9).
- **A composite FK `(bookId, authorId)` so the database itself enforces book ownership on tickets:** deferred as optional hardening. Ownership is enforced and tested in the service layer instead.
- **Surrogate keys, `Decimal` money, or a visibility flag for notes:** no comparison was recorded for these.

## Consequences
- Dataset IDs are strings chosen by the data supplier, so new records created in the app (tickets, users) use generated `cuid` IDs instead. The two ID styles coexist.
- The CHECK constraint is invisible to Prisma's schema. It lives only in migration SQL, and Prisma ignores it when diffing (verified: no drift, T1.5).
- The seed never deletes rows. Extra rows are only warned about, so a stale database needs a manual cleanup or a reset.
- `Restrict` means dataset authors and books cannot be deleted while tickets reference them. That is intended for this application.
