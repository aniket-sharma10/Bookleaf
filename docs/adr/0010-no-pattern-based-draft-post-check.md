# 0010. No pattern-based post-check on AI drafts

- **Status:** Accepted (owner, 2026-10-31: remove the pattern check, or keep it only if replaced by an established practice; the assistant chose removal, see Alternatives). Supersedes the post-check in ADR-0003 point 5.
- **Date:** 2026-10-31
- **Implementation:** implemented (T7.9): `src/server/ai/safety.ts` and the `AiDraft.warnings` column removed (migration `20261031180000_drop_ai_draft_warnings`); the eval's "no safety warnings" check removed.
- **Requirements:** DRAFT-02, DRAFT-04, DRAFT-05

## Context
T5.7 added `checkDraft`, which scanned each draft with hand-written regular expressions: ₹ amounts and numbers not in the context, unknown links, emails and phone numbers, and "already happened" phrases such as "has been processed". Findings appeared as "Warnings" above the editor. In manual testing it flagged a correct future commitment ("we'll confirm once the update has been processed"). Earlier it had flagged a payment the facts did record (T5.9). The owner judged that wrong warnings give a poor impression and that hand-written phrase lists aren't production practice. They asked for the check to be removed, or replaced with an established practice.

## Decision
Remove the post-check. Drafts rely on the controls that were already in place:
- the prompt's rules and grounding: only allow-listed verified facts and the KB, no invented figures, no claims that an action happened, ticket text treated as data (ADR-0003 points 4 and 5);
- schema-validated structured output, where the model itself lists the reply's `commitments` and the facts in `needsVerification`, shown to the admin as "Promises in this reply" and "Check before sending";
- mandatory human review: nothing is sent without an explicit admin Send (DRAFT-02).

## Rationale
- Phrase lists can't tell a claim from a commitment ("has been processed" versus "once it has been processed"). Each fix adds an exception, and false alarms teach reviewers to ignore warnings.
- The admin reads every draft before sending. That human review, plus a grounded prompt and structured output, is the usual control for AI-drafted replies.
- It removes a module, a database column and the UI noise without weakening anything that blocks a bad reply.

## Alternatives considered
- **Keep the check and add exceptions** (e.g. ignore phrases after "once" or "when"). Rejected: the same brittleness, with more patterns.
- **A second model call to review each draft against the facts (LLM as judge).** This is the established way to automate a groundedness check. It doubles AI calls and latency per draft on the free-tier quota, for a reply an admin reviews anyway. Worth adding if drafts were ever sent without review, or at higher volume.

## Consequences
- An invented figure or a "has been refunded" claim is no longer highlighted. The admin's review has to catch it, helped by the two lists.
- `npm run ai:eval` keeps its per-category content checks and still runs the injection case; it no longer reports "no safety warnings".
