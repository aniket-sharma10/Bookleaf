---
name: implement-task
description: Implement exactly one approved backlog task from docs/implementation-plan.md (e.g. "/implement-task T3.4"). Checks prerequisites, stays in scope, runs verification and reports results. Use when the user asks to implement, build or start a specific task ID.
argument-hint: <task-id, e.g. T3.4>
disable-model-invocation: true
---

# Implement task $ARGUMENTS

## 1. Load context (read, don't skim)
1. Find task `$ARGUMENTS` in `docs/implementation-plan.md`. If it doesn't exist, stop and say so.
2. Read the requirement IDs it lists in `docs/requirements.md`, and the relevant sections of `docs/architecture.md` and any ADR it touches.
3. Check that every prerequisite task on the board is `done`. If any is not, **stop**: list the missing prerequisites and ask whether to do them first. Don't partially implement around them.
4. Check the task's blockers (API keys, accounts, local JSON file). If one applies, stop and report it.
5. Look at the existing code the task builds on, and follow its patterns. Fetch current docs (context7) for any Next.js 16, Prisma 7, Gemini SDK or Zod API you're not certain about.

## 2. Plan briefly
Set the task status to `in-progress` on the board. In 3–6 bullets, state the files you'll create or change and how each acceptance criterion will be verified. If the scope is ambiguous, or needs work outside the task, ask before coding.

## 3. Implement within scope
- Only what the task's scope and acceptance criteria require. No drive-by refactors, no speculative abstractions, no new dependencies unless the task names them.
- Follow the CLAUDE.md module boundaries and security rules. For author data, the `authorId` comes from the verified JWT, never from client input.
- Write the tests the task's "Verify" line asks for, alongside the code. New API routes must be added to the authz matrix test.

## 4. Verify
Run `npm run lint`, `npm run typecheck` and `npm test`. Add `npm run build` if the task touches routing, config or a phase gate. For UI tasks, also check the page in the browser and describe what you checked. Fix any failures. Never mark acceptance criteria met without evidence.

## 5. Close out
- Board status: `done` only if every acceptance criterion is verified. Otherwise `blocked` with a one-line reason.
- Update `docs/architecture.md` or `docs/api.md` if what you built differs from, or adds to, what they describe. Add or update an ADR if a significant decision was made (see CLAUDE.md "Decisions and documentation"), and update the relevant `docs/learning-notes/` file for what was implemented.
- Report in the CLAUDE.md "Task completion report" format, which includes:
  - **Done:** each acceptance criterion and how it was verified (command output summary or manual check).
  - **Not done / deviations:** anything skipped or changed, and why.
  - **Trade-offs:** any non-obvious choice, in 1–2 plain sentences the owner can repeat in an interview.
  - **Implementation walkthrough:** the flow through the changed code (files, key functions, order).
  - **Decisions:** existing decisions applied, kept separate from new decisions introduced (with where each is recorded).
  - **Next:** the next unblocked task ID(s).
- Don't commit unless asked. If asked, use one commit for the task, with a message like `T3.4: ticket creation API`.
