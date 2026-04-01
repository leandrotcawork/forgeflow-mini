---
name: brain-review
description: Dispatch spec-compliance-reviewer then code-quality-reviewer sequentially. Both must PASS before handing off to brain-verify. Saves review to .brain/reviews/.
---

# brain-review

Run the two-stage review gate after implementation and before verification.

## Trigger

Routed from `brain-task` after implementer completes. `workflow-state.json` must have `phase: REVIEWING`.

## Hard Gates

1. Read `workflow-state.json` first.
2. Stop unless `phase = "REVIEWING"`.
3. Review order is fixed: spec-compliance-reviewer FIRST, then code-quality-reviewer.
4. Do NOT run code-quality-reviewer if spec-compliance-reviewer returns FAIL.
5. Do NOT hand off to `brain-verify` unless BOTH reviewers return PASS.
6. Review is saved to `.brain/reviews/` — not `.brain/working-memory/`.

## Required Input

- `.brain/specs/spec-{task_id}.md`
- `.brain/plans/plan-{task_id}.md`
- `.brain/working-memory/task-completion-{task_id}.md`
- `.brain/working-memory/workflow-state.json`
- Git diff of the implementation

If any item is missing, stop and return to `brain-task`.

## Step 1: Get Implementation Diff

Run:
```bash
git diff $(git merge-base HEAD main)..HEAD
```
This captures all implementation commits since branching from main. Passed to both reviewers.

## Step 2: Dispatch spec-compliance-reviewer

Dispatch the `agents/spec-compliance-reviewer.md` agent with INLINE:
- The full approved spec text
- The git diff

Handle result:
- **PASS** — proceed to Step 3
- **FAIL** — update `workflow-state.json`:
  ```json
  { "phase": "IMPLEMENTING", "review_status": "failed" }
  ```
  Return to `brain-task` with the failure findings as feedback. Implementer fixes and re-dispatches.

Do NOT proceed to code quality review if spec compliance FAILS.

## Step 3: Dispatch code-quality-reviewer

Only after spec-compliance-reviewer returns PASS.

Dispatch the `agents/code-quality-reviewer.md` agent with INLINE:
- The git diff
- The allowed_files list from workflow-state

Handle result:
- **PASS** — proceed to Step 4
- **FAIL** — update `workflow-state.json`:
  ```json
  { "phase": "IMPLEMENTING", "review_status": "failed" }
  ```
  Return to `brain-task` with the quality findings as feedback. Implementer fixes and re-dispatches.

## Step 4: Save Review and Update State

Write `.brain/reviews/review-{task_id}.md` using the template at `templates/review.md`.
Fill in:
- Spec compliance section: checklist, findings, result from Step 2
- Code quality section: checklist, findings, result from Step 3
- Overall: PASS

Update `workflow-state.json`:
```json
{
  "phase": "VERIFYING",
  "review_status": "passed"
}
```

Then hand off to `brain-verify`.

## Pipeline

`brain-dev → brain-spec → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document`
