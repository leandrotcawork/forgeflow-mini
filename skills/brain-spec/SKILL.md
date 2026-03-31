---
name: brain-spec
description: Use when a debug, fix, build, refactor, or improve request needs a mandatory approved spec before mutable planning begins.
---

# brain-spec

Create the mandatory spec before any mutable plan exists.

## Trigger

- Routed from `brain-dev` for `debug`, `fix`, `build`, `refactor`, or `improve`
- Never skipped in the implementation pipeline

## Hard Gates

1. No implementation. No source edits. No plan writing.
2. No handoff to `brain-plan` until the spec is explicitly approved.
3. `workflow_state` is the contract. Write it before asking for approval.

## Step 1: Load Inputs

Required:
- `.brain/working-memory/dev-context-{task_id}.md`

Optional:
- Existing `.brain/working-memory/workflow-state.json`

If `dev-context` is missing, stop and return to `brain-dev`.

## Step 2: Open Spec Phase in workflow_state

Write or update `.brain/working-memory/workflow-state.json`:

```json
{
  "task_id": "{task_id}",
  "phase": "spec",
  "spec_status": "draft",
  "plan_status": "blocked",
  "plan_mode": null,
  "review_status": "pending",
  "next_action": "approve_spec",
  "allowed_files": [],
  "verify_commands": []
}
```

`allowed_files` and `verify_commands` stay empty here on purpose.
brain-spec defines intent and boundaries, not the mutable plan.

## Step 3: Write the Spec

Write `.brain/working-memory/spec-{task_id}.md` with:

1. Request summary
2. Problem / target behavior
3. In scope
4. Out of scope
5. Constraints and risks
6. Candidate files or domains likely to change
7. Acceptance criteria
8. Open questions, if any

Keep it short and concrete. If one blocker remains, ask ONE clarifying question.

## Step 4: Approval Gate

Show the spec summary and ask for explicit approval.

Before approval:
- `workflow_state.phase` must stay `spec`
- `spec_status` must stay `draft`
- `plan_status` must stay `blocked`

After approval, update `workflow_state`:

```json
{
  "phase": "plan",
  "spec_status": "approved",
  "plan_status": "required",
  "plan_mode": null,
  "next_action": "write_plan"
}
```

Then hand off to `brain-plan`.

## Pipeline

`brain-dev -> brain-spec -> brain-plan -> brain-task -> brain-review -> brain-verify`
