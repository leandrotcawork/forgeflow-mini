---
name: brain-plan
description: Generate implementation plan after spec is approved. Defines allowed_files, TDD micro-steps, and verify plan. Saves to .brain/plans/.
---

# brain-plan

Write the implementation plan after the spec is approved.

## Trigger

Routed from `brain-spec` after user approves the spec. `workflow-state.json` must have `phase: PLAN_PENDING` and `spec_status: approved`.

## Hard Gates

1. Read `workflow-state.json` first.
2. Stop unless `phase = "PLAN_PENDING"` and `spec_status = "approved"`.
3. No plan without an approved spec.
4. `allowed_files` must be exhaustive — every file the implementer will touch.
5. Plan is saved to `.brain/plans/` — not `.brain/working-memory/`.

## Required Input

- `.brain/specs/spec-{task_id}.md`
- `.brain/working-memory/dev-context-{task_id}.md`
- `.brain/working-memory/workflow-state.json`
- Active stack pack from `.claude/rules/stacks/` (if present)

If spec is missing, stop and return to `brain-spec`.

## Step 1: Load Spec and Context

Read the approved spec and extract:
- Objective and constraints
- Reuse decisions (from Reuse Strategy section)
- Affected areas and acceptance criteria

Load stack pack rules if present in `.claude/rules/stacks/`. These define test framework, lint commands, and verify expectations.

## Step 2: Write the Plan

Write `.brain/plans/plan-{task_id}.md` using the template at `templates/plan.md`.

Fill every section:
- **Execution Strategy** — overall approach in 2-3 sentences
- **Agent Selection** — always `implementer` for code-writing tasks
- **Allowed Files** — exhaustive list of every file to be created or modified
- **TDD Micro-Steps** — numbered steps, each independently testable:
  - write failing test → implement → pass → commit
  - be specific: exact test names, exact commands, expected output
- **Verify Plan** — exact commands for: build, types, lint, tests, security, diff

The plan must explicitly reference reuse decisions from the spec.

## Step 3: Update workflow-state and Hand Off

Update `workflow-state.json`:
```json
{
  "phase": "IMPLEMENTING",
  "plan_status": "approved",
  "allowed_files": ["path/to/file1", "path/to/file2"]
}
```

Note: In V1, plan approval is automatic (no separate user gate for the plan). The spec user approval is the control point.

Then hand off to `brain-task`.

## Pipeline

`brain-dev → brain-spec → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document`
