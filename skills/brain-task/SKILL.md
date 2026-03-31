---
name: brain-task
description: Execute approved implementation plans only. No inline fallback that bypasses plan approval or workflow_state file gates.
---

# brain-task -- Approved Plan Execution

Execute the approved plan. Nothing else.

## Trigger

- Routed from `brain-plan` after explicit approval
- Never routed directly from `brain-dev`

## Hard Gates

1. No inline fallback.
2. Stop unless `workflow_state.phase = "task"`.
3. Stop unless `workflow_state.plan_status = "approved"`.
4. Stop unless `workflow_state.plan_mode` is present and valid.
5. Stop if `allowed_files` is missing and the task requires source changes.
6. Never edit a source file that is not listed in `allowed_files`.

## Required Input

- `.brain/working-memory/implementation-plan-{task_id}.md`
- `.brain/working-memory/workflow-state.json`
- `.brain/working-memory/dev-context-{task_id}.md`

If any item is missing, stop and return to `brain-plan`.

## Step 1: Validate workflow_state

Read `workflow_state` first and confirm:

```json
{
  "phase": "task",
  "plan_status": "approved",
  "plan_mode": "inline | subagent | subagent+review",
  "allowed_files": [...],
  "verify_commands": [...]
}
```

If `verify_commands` is empty for a code task, stop and return to `brain-plan`.
If `plan_mode` is absent or invalid, stop and return to `brain-plan`.

If `workflow_state.next_action = "rework_task"`, treat this as re-entry from review.
Rework still follows the approved plan and stays inside `allowed_files` unless `brain-plan` updates the plan.

## Step 2: Enforce File Boundaries

Before each edit:
- check whether the target file is in `allowed_files`
- if yes, proceed
- if no, stop and return to `brain-plan` for plan revision

No opportunistic edits. No "while I am here" cleanup.

## Step 3: Execute the Plan

Execution mode comes from `workflow_state.plan_mode`, not from fallback routing.

| Plan mode | Action |
|---|---|
| `inline` | Execute the approved steps in the current session |
| `subagent` | Dispatch implementer against the approved plan only |
| `subagent+review` | Dispatch implementer, then continue to `brain-review` |

The plan remains the source of truth for sequence and scope.

## Step 4: Write Task Handoff

Write `.brain/working-memory/task-completion-{task_id}.md`:

```md
task: {original request verbatim}
status: complete | partial | failed
files_changed: [list]
verify_commands: [list from workflow_state]
```

Update `workflow_state` for review:

```json
{
  "phase": "review",
  "plan_status": "approved",
  "plan_mode": "inline | subagent | subagent+review",
  "review_status": "pending",
  "next_action": "run_review"
}
```

## Step 5: Invoke brain-review

Hand off to `brain-review`.

## Pipeline

`brain-dev -> brain-spec -> brain-plan -> brain-task -> brain-review -> brain-verify`
