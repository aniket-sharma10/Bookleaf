# 0003. AI integration: provider boundary, structured outputs, graceful degradation

- **Status:** Accepted (owner, 2026-10-30). The exact Gemini model IDs are still open and will be confirmed in T5.1.
- **Date:** 2026-10-27
- **Implementation:** partial. Only the persistence side exists: the `AiDraft` and `AiCallLog` tables, and the AI fields on `Ticket` (T1.5). `GEMINI_*` variables are defined in `src/server/env.ts`. No provider, prompt, KB module or classification code yet (Phase 5).
- **Requirements:** AI-01–09, DRAFT-01–09, TICKET-05, MGMT-04

## Context
AI quality is the highest-weighted criterion (25%). The evaluation covers prompt design, KB usage, classification accuracy, graceful degradation and cost awareness. The AI must be grounded in real data, must never claim actions that did not happen, and must never block ticket creation or manual replies. The Knowledge Base is small: a handful of short policy sections. The brief names Gemini as the starting provider, and the assignment allows any provider if the choice is justified.

## Decision
1. **Provider boundary.** A `StructuredGenerator` interface is implemented by a single `gemini.ts` adapter (`@google/genai`). Prompts, schemas and business logic are provider-agnostic, and tests use a fake implementation.
2. **Structured outputs everywhere.** Each call sends a JSON schema generated from Zod and validates the response with the same Zod schema. Invalid output is a failure and is never persisted.
3. **Two tasks, two cost profiles:**
   - **Classification:** one call per ticket returns `{category, priority, rationale}` on a small model with truncated input. It runs after the ticket insert has committed, via `after()`. It never overwrites admin overrides.
   - **Drafting:** a stronger fast model, generated when an admin first opens a ticket, cached, and regenerated only on request.
4. **Grounding by construction.** Code builds an allow-listed context: the ticket, the referenced book's verified fields, and policy facts computed deterministically (payout deadline, ₹1,000 threshold).
   - **KB module:** the Knowledge Base is a small, structured, server-side module (`knowledge-base.ts`). It contains a concise summary of the brief's policy facts in our own words. The brief is never copied verbatim, and no policies are added.
   - **Selection:** only the sections for the ticket's category are included, plus tone guidance.
   - **Exclusions:** no internal notes or contact PII are sent.
5. **Action safety.** The model returns `commitments[]` (actions BookLeaf will take) and `needsVerification[]` separately from the reply. The prompt forbids stating that an action (escalation, re-sync, reprint, refund, payment) has already happened unless the application records that it was performed. Today it records none of these, so drafts may only commit to future actions. A deterministic post-check warns about unverified amounts and completed-action phrasing. Only an explicit admin "Send" publishes anything.
6. **Degradation.** Typed `AiError` kinds are `TIMEOUT`, `RATE_LIMITED`, `INVALID_OUTPUT`, `PROVIDER_ERROR` and `DISABLED`. Classification failure leaves the ticket "Needs triage" with manual override and retry available. Draft failure returns 503 `AI_UNAVAILABLE` and the manual composer still works. There is at most one retry, and only for transient provider errors.
7. **Observability.** `AiCallLog` records the model, outcome, token counts and latency per call, without prompt text.

## Rationale
- The owner's brief named Gemini as the starting provider, subject to availability and rate limits.
- The assignment weights graceful degradation and cost-consciousness explicitly. That drives two choices: AI runs only after the ticket has been saved, and the cheaper of two models handles classification.
- The owner's requirements state that the AI must not claim actions it cannot verify, which drives the `commitments` and `needsVerification` split.
- Structured, validated output turns "the model said something odd" into a typed failure that the app can handle.

## Alternatives considered
- **OpenAI gpt-4o-mini or Claude Haiku.** These are equally suitable, and the assignment suggests them as cheap options. Gemini is preferred for its free tier and native JSON-schema output. The boundary keeps a switch to a one-file change.
- **Embedding/vector retrieval over the KB.** Unjustified for a handful of short sections. Category-keyed selection is deterministic, testable and cheaper.
- **Synchronous classification inside the create request.** Simpler, but it adds LLM latency to author submission and couples creation to AI uptime.
- **Pre-generating drafts at ticket creation.** This spends tokens on tickets that may be closed or answered manually. It is also not what the spec describes ("when an admin opens a ticket").
- **LangChain, agent or tool-calling frameworks.** No tools are needed. They would add risk (autonomous actions) without benefit.

## Consequences
- AI can be fully disabled, and the app and test suite still work.
- Background classification can be lost if the serverless instance dies. Retry in the UI mitigates this, and a durable queue is the production path.
- The priority rubric is our assumption (the PDF gives only examples). It is calibrated with `scripts/ai-eval.ts` and documented.
- **Open questions:** current Gemini model IDs, free-tier rate limits, and whether `responseJsonSchema` is still the preferred config field. All are to be verified in T5.1.

## History
- **2026-10-30:** the KB-size wording was changed from a token estimate to "a handful of short sections", because the KB module is not built yet. The KB module, now a structured summary rather than a verbatim copy of the brief, and the rule against claiming completed actions were refined on the owner's instruction before acceptance.
- **2026-10-31:** added the **Implementation** and **Rationale** sections (documentation-format update). The decision is unchanged. The rationale was drawn from the owner's recorded instructions and the existing text.
