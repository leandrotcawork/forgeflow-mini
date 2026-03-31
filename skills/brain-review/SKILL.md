---
name: brain-review
description: Use after brain-task to review implementation against the approved spec first, then perform code review before any verify handoff.
---

# brain-review

Run the review gate after implementation and before verification.

## Trigger

- Routed from `brain-task`
- Never skipped for implementation work

## Hard Gates

1. Review order is fixed: spec review -> code review.
2. Do not hand off to `brain-verify` unless `review_status = "passed"`.
3. If spec review fails, stop before code review.

## Required Input

- `.brain/working-memory/spec-{task_id}.md`
- `.brain/working-memory/implementation-plan-{task_id}.md`
- `.brain/working-memory/task-completion-{task_id}.md`
- `.brain/working-memory/workflow-state.json`

If any item is missing, stop and return to `brain-task`.

## Step 1: spec review

Check the changed files against:
- approved spec
- approved plan
- `allowed_files` from `workflow_state`

Fail the spec review if:
- scope changed without approval
- a changed source file is outside `allowed_files`
- the implementation skipped a required plan step

If blocked, write:

```json
{
  "phase": "task",
  "review_status": "changes_requested",
  "next_action": "rework_task"
}
```

Then stop and return to `brain-task`.

## Step 2: code review

Only run after spec review passes.

Check for:
- correctness
- regression risk
- missing tests or missing verification coverage
- obvious simplifications or defects

## Step 3: Output Review Result

Write `.brain/working-memory/review-result-{task_id}.md`:

```md
spec review: passed | blocked
code review: passed | blocked
review_status: passed | changes_requested
findings:
- ...
```

Update `workflow_state`:

```json
{
  "phase": "verify",
  "review_status": "passed",
  "next_action": "run_verify"
}
```

Only do this when both review stages pass.

## Step 4: Handoff

If `review_status = "passed"`, invoke `brain-verify`.
Otherwise return to `brain-task`.

## Pipeline

`brain-dev -> brain-spec -> brain-plan -> brain-task -> brain-review -> brain-verify`
