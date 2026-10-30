# Architecture Decision Records

An ADR records one architectural decision whose rationale is worth keeping: it affects several modules, is costly to reverse, or will be questioned in the technical interview. Library picks and routine implementation details do not need ADRs.

## Conventions

- File name: `NNNN-short-kebab-title.md`, numbered sequentially from `0001`. Numbers are never reused.
- Status: `Proposed` (recommended, awaiting approval) → `Accepted` → optionally `Superseded by NNNN` or `Rejected`. Do not mark a decision Accepted until the project owner approves it.
- Do not rewrite an accepted ADR to change the decision. Write a new ADR that supersedes it, and update the old one's status line.
- Keep each ADR to about one page.

## Template

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted | Superseded by NNNN | Rejected
- **Date:** YYYY-MM-DD
- **Requirements:** IDs from docs/requirements.md

## Context
What forces the decision: requirements, constraints, risks.

## Decision
What we do, stated concretely.

## Alternatives considered
- Option — why not chosen.

## Consequences
Positive, negative, and follow-ups or open questions.
```

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-single-nextjs-app-with-rest-route-handlers.md) | Single Next.js app with REST Route Handlers | Accepted |
| [0002](0002-jwt-cookie-auth.md) | Email/password auth with a signed JWT in an HttpOnly cookie | Accepted |
| [0003](0003-ai-integration-structured-outputs-graceful-degradation.md) | AI integration: provider boundary, structured outputs, graceful degradation | Accepted (model IDs open) |
| [0004](0004-polling-for-near-real-time-updates.md) | Polling for near-real-time ticket updates | Accepted |
