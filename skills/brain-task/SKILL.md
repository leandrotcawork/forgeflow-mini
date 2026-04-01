---
name: brain-task
description: Dispatch the implementer agent to execute the approved plan. Always uses subagent. Updates phase to REVIEWING on completion.
---

# brain-task

Dispatch the implementer agent to execute the approved plan.

## Trigger

Routed from `brain-plan` after plan is written. `workflow-state.json` must have `phase: IMPLEMENTING` and `plan_status: approved`.

## Hard Gates

1. Read `workflow-state.json` first.
2. Stop unless `phase = "IMPLEMENTING"` and `plan_status = "approved"`.
3. ALWAYS dispatch the implementer as a subagent — no inline execution.
4. Never edit source files directly in this skill.
5. Only allowed_files may be written by the implementer.

## Required Input

- `.brain/plans/plan-{task_id}.md`
- `.brain/specs/spec-{task_id}.md`
- `.brain/working-memory/workflow-state.json`
- `.brain/working-memory/dev-context-{task_id}.md`

If plan or spec is missing, stop and return to `brain-plan`.

## Step 1: Assemble Context Packet

Prepare a context packet for the implementer subagent. Include INLINE (not file references):
- The full approved spec text
- The full approved plan text
- task_id, intent, phase, allowed_files list

The subagent must receive everything it needs inline. Do not tell it to "read the plan file" — paste the content.

## Step 2: Dispatch implementer Subagent

Dispatch the `agents/implementer.md` agent with the context packet.

The SubagentStart hook will automatically inject the discipline contract (allowed_files, phase).

Handle implementer status:
- **DONE** — proceed to Step 3
- **DONE_WITH_CONCERNS** — read the concerns; if about correctness, address before review; if observational, note and proceed
- **NEEDS_CONTEXT** — provide the missing context and re-dispatch implementer
- **BLOCKED** — stop; present the blocker to the user before proceeding

## Step 3: Update State and Hand Off

After implementer reports DONE (or DONE_WITH_CONCERNS with no correctness issues):

Update `workflow-state.json`:
```json
{
  "phase": "REVIEWING",
  "review_status": "pending"
}
```

Hand off to `brain-review`.

## Pipeline

`brain-dev → brain-spec → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document`
