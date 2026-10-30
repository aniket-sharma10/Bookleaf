---
name: implement-task
description: Workflow for implementing exactly one task from docs/implementation-plan.md (IDs like T1.8, T2.1, T3.4). Use whenever the user asks to implement, build, start, proceed with or continue a specific plan task, e.g. "implement T1.8", "proceed with T2.1", "do the next task". Checks prerequisites and blockers, stays in scope, runs the standard checks, reports in the CLAUDE.md format, and stops afterwards.
argument-hint: <task-id, e.g. T3.4>
---

# Implement one plan task

Task: `$ARGUMENTS`. If that is empty, use the task ID named in the user's request. If no single task is identified, ask which one before doing anything.

All project rules live in `CLAUDE.md`: security, database guards, hosted-resource approval, documentation proportionality, the report format and task boundaries. Follow them; this skill only gives the order of work.

## 1. Load context
1. Find the task in `docs/implementation-plan.md`. If it doesn't exist, stop and say so.
2. Read the requirement IDs it lists (`docs/requirements.md`), the relevant parts of `docs/architecture.md`, and any ADR it touches.
3. **Prerequisites:** every prerequisite task must be `done`. If any isn't, stop and list them; don't implement around them.
4. **Blockers:** API keys, accounts, the local dataset JSON, a Proposed ADR it depends on, or any hosted/production operation. If one applies, stop and ask.
5. Read the existing code the task builds on and follow its patterns. Check library docs as `CLAUDE.md` § Conventions describes.

## 2. Plan briefly
Set the task to `in-progress` on the board. In 3–6 bullets, state the files you'll create or change and how each acceptance criterion will be verified. If the scope is ambiguous, or the task needs work outside its scope, ask before coding.

## 3. Implement within scope
Only what the task's scope and acceptance criteria require. Write the tests its **Verify** line asks for, alongside the code.

## 4. Verify
Run the standard checks from `CLAUDE.md` § Testing and verification, and fix any failures. For UI tasks, also check the page in the browser. Never mark an acceptance criterion met without evidence.

## 5. Close out
- Board status: `done` only if every acceptance criterion is verified. Otherwise `blocked`, with a one-line reason.
- Update documentation only as `CLAUDE.md` § Documentation (proportional) requires. Often only the board status and a brief Outcome note change.
- Report in the `CLAUDE.md` § Task completion report format.
- Then **stop**: no staging or commits unless asked, and don't start the next task.
