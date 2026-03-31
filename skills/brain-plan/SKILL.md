---
name: brain-plan
description: Generate mutable implementation plans only after an approved spec exists in workflow_state.
---

# brain-plan

Write the mutable implementation plan after the spec is approved.

## Trigger

- Routed from `brain-spec`
- Never invoked directly from `brain-dev`

## Hard Gates

1. Read `.brain/working-memory/workflow-state.json` first.
2. Stop unless `workflow_state.phase = "plan"` and `workflow_state.spec_status = "approved"`.
3. No mutable plan before approved spec.
4. Plan is incomplete until `allowed_files`, `verify_commands`, `plan_status`, and `plan_mode` are written to `workflow_state`.

## Required Input

- `.brain/working-memory/spec-{task_id}.md`
- `.brain/working-memory/dev-context-{task_id}.md`
- `.brain/working-memory/workflow-state.json`

If any item is missing, stop and return to `brain-spec`.

## Step 1: Load Spec, Then Plan

Extract from the approved spec:
- scope
- constraints
- candidate files
- acceptance criteria

If the spec is vague, ask ONE clarifying question before writing the plan.

## Step 2: Write the Plan

Write `.brain/working-memory/implementation-plan-{task_id}.md` with:

1. Goal
2. File list with exact paths
3. Ordered execution steps
4. TDD checkpoints where applicable
5. Explicit `plan_mode`: `inline` | `subagent` | `subagent+review`
6. Exact verification commands
7. Risks or follow-up notes

Every mutable file must have an exact path.
Every verification step must be an executable command.
Every plan must choose exactly one `plan_mode`.

## Step 3: Write workflow_state

Before approval, write:

```json
{
  "phase": "plan",
  "spec_status": "approved",
  "plan_status": "draft",
  "plan_mode": "inline | subagent | subagent+review",
  "next_action": "approve_plan",
  "allowed_files": [
    "exact/path/one",
    "exact/path/two"
  ],
  "verify_commands": [
    "exact command one",
    "exact command two"
  ]
}
```

Rules:
- `allowed_files` must be exhaustive for all planned source changes
- `verify_commands` must cover the acceptance criteria
- `plan_mode` must be one of `inline`, `subagent`, or `subagent+review`
- Empty `allowed_files` is only acceptable for a no-code plan

## Step 4: Approval Gate

Ask for explicit plan approval.

Only after approval, update `workflow_state`:

```json
{
  "phase": "task",
  "plan_status": "approved",
  "plan_mode": "inline | subagent | subagent+review",
  "next_action": "execute_task",
  "allowed_files": [...],
  "verify_commands": [...]
}
```

Then hand off to `brain-task`.

## Pipeline

`brain-dev -> brain-spec -> brain-plan -> brain-task -> brain-review -> brain-verify`
