# Architecture Decision Records

An ADR records one architectural decision whose rationale is worth keeping: it affects several modules, is costly to reverse, or is likely to be questioned later. Library picks and routine implementation details do not need ADRs; they belong in the architecture doc, the implementation-plan outcome notes or code comments.

## Conventions

- File name: `NNNN-short-kebab-title.md`, numbered sequentially from `0001`. Numbers are never reused.
- Status: `Proposed` (recommended, awaiting approval) → `Accepted` → optionally `Superseded by NNNN` or `Rejected`. Do not mark a decision Accepted until the project owner approves it. Say who decided (owner, or proposed by the assistant and accepted by the owner).
- Do not rewrite an accepted ADR to change the decision. Write a new ADR that supersedes it, and update the old one's status line. Factual corrections that don't change the decision (e.g. a wrong file reference) are allowed and must be listed under **History**.
- **Implementation** says what exists in the code today. An Accepted decision may still be unimplemented. When a task changes what is implemented, update both the ADR's Implementation line and the index's Implementation column below.
- **Retrospective** ADRs (written after the decision was made) say so. They record only rationale that was documented at the time. Where reasoning was never written down, they say "rationale not recorded" rather than reconstructing it.
- Alternatives are listed only if they were actually considered. If none were, say so.
- Keep each ADR to about one page. Describe *why*, and leave *how it works* to the architecture doc and learning notes.

## Template

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted (decided by …, date) | Superseded by NNNN | Rejected
- **Date:** YYYY-MM-DD
- **Implementation:** not started | partial (…) | implemented (tasks/files)
- **Requirements:** IDs from docs/requirements.md

## Context
What forces the decision: requirements, constraints, risks.

## Decision
What we do, stated concretely.

## Rationale
Why this option, in a few points. Mark anything not recorded at the time.

## Alternatives considered
- Option: why not chosen. (Only options that were actually considered.)

## Consequences
Positive, negative, and follow-ups or open questions.

## History
Optional. Dated factual corrections, or how the decision evolved.
```

## Index

| ADR | Title | Status | Implementation |
|---|---|---|---|
| [0001](0001-single-nextjs-app-with-rest-route-handlers.md) | Single Next.js app with REST Route Handlers | Accepted | Partial |
| [0002](0002-jwt-cookie-auth.md) | Email/password auth with a signed JWT in an HttpOnly cookie | Accepted | Partial (hashing, JWT, cookie, guards, login/logout/me) |
| [0003](0003-ai-integration-structured-outputs-graceful-degradation.md) | AI integration: provider boundary, structured outputs, graceful degradation | Accepted (model IDs open) | Partial (schema tables only) |
| [0004](0004-polling-for-near-real-time-updates.md) | Polling for near-real-time ticket updates | Accepted | Not started |
| [0005](0005-dataset-preserving-data-model.md) | Dataset-preserving data model | Accepted (retrospective) | Implemented |
| [0006](0006-isolated-local-databases-and-write-guards.md) | Isolated local databases and write-target guards | Accepted (retrospective; dev DB amended to Neon) | Implemented |
| [0007](0007-lazy-environment-validation.md) | Lazy environment validation with point-of-use requirements | Accepted (retrospective) | Implemented |
| [0008](0008-prisma-cli-target-guard.md) | Guard every Prisma CLI command's database target in `prisma.config.ts` | Proposed (awaiting owner approval) | Implemented |
