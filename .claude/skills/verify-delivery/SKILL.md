---
name: verify-delivery
description: Pre-submission and phase-gate verification for the BookLeaf assignment — runs the full check suite, traces every mandatory requirement to evidence, checks docs/deliverables, and lists deployment or submission blockers. Use at a phase gate, before deploying, or before submitting.
argument-hint: "[optional: phase number to gate, e.g. 3; default = full delivery]"
disable-model-invocation: true
---

# Verify delivery

Scope: `$ARGUMENTS` (a phase number means "check that phase gate"; empty means full delivery).

Report facts only. If a check can't be run, say why, and don't assume it passes.

## 1. Automated checks
Run each command and record pass or fail, with the key output for failures:
`npm run lint` · `npm run typecheck` · `npm run format:check` · `npm test` · `npm run build`

If a phase number was given, also check that phase's **Gate** in `docs/implementation-plan.md`.

## 2. Requirement traceability
For each requirement in `docs/requirements.md` marked **Mandatory** or **Derived** (or only those in scope for the given phase):
- Find its evidence: a test name, a manual check recorded in `docs/test-checklist.md`, or a doc section.
- Classify it as ✅ evidenced, ⚠️ implemented but unverified, or ❌ missing.

Output a compact table that shows only the ⚠️ and ❌ rows, plus a count of ✅.

## 3. Data and security spot checks
- `npm run db:verify` against the target DB (local, or production if `DATABASE_URL` points there and the user confirms) shows 10 authors and 18 books, field-exact.
- Every `src/app/api/**/route.ts` appears in the authz matrix test and in `docs/api.md`.
- `git ls-files` contains no PDF, no `bookleaf_sample_data.json` and no `.env` (other than `.env.example`).
- `git grep` finds no API key patterns.

## 4. Deliverables (full delivery only)
- The README has: local setup, test credentials (authors and admin), live URL, architecture decisions and reasons, AI integration (prompt strategy, error handling, cost management), model choice, API docs link, and known limitations.
- `docs/api.md` covers every endpoint. `docs/write-up.md` exists and is one page or less (about 500 words).
- Live URL: if reachable, smoke-test login as an author and as an admin, a ticket round-trip, and the polling update. Otherwise list it as a blocker.
- Repo is private and the reviewer collaborator is added. These are user-confirmed items, so ask; don't assume.
- The commit history is clean (no committed secrets or confidential files in `git log --stat`).

## 5. Report
1. **Verdict:** ready, or not ready, for the gate or submission.
2. **Blockers:** ordered, each with the smallest fix.
3. **Gaps:** ⚠️ and ❌ requirements.
4. **Suggested next tasks** (IDs from the board).

Update the task board only if the user asks.
