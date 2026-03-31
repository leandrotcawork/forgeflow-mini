---
name: brain-document
description: Documenter - propose sinapse updates and capture episodes only after successful verification.
---

# brain-document -- Documenter

**Budget:** 1k read, 1k output

## Trigger

Called after brain-verify passes, or manually via `/brain-document`.

## Hard Gates

1. brain-document requires successful verification.
2. Read `.brain/working-memory/workflow-state.json` first.
3. Stop unless `workflow_state.verify_status = "passed"` and `workflow_state.phase = "document"`.
4. If the gate fails, stop with this message:
   `brain-document: requires successful verification (verify_status=passed, phase=document).`

**Preconditions:** task implementation complete, task-completion file exists, and successful verification already recorded in workflow_state.

**Input:** task-completion file (`.brain/working-memory/task-completion-{task_id}.md`) + `git diff --name-only`.

## Workflow

### Step 1: Identify Touched Regions

Map changed files to cortex regions using `cortex_registry.md`.

### Step 2: Assess Knowledge Changes

For each touched region, ask:
- New learning?
- Wrong knowledge?
- Anti-pattern or insight worth recording?

### Step 3: Create Proposals

Use `templates/sinapse-proposal.md` for each proposed update.
Save to `.brain/working-memory/sinapse-updates-{task_id}.md`.

### Step 4: Capture Episodes

Use `templates/episode-format.md` for any anti-pattern, insight, correction, or discovery.
Save to `.brain/working-memory/episode-{task_id}-{type}.md`.

Episodes are factual records only.

### Step 5: Present to User

Show proposals with brief diff summaries.
Explain that consolidation happens via `/brain-health`.

## Rules

1. Never write to hippocampus directly.
2. Never auto-approve a proposal.
3. Episodes must be factual observations.
4. Skip documentation if changes are trivial.
5. All `[[sinapse]]` links must reference existing files.
6. Use diff format for updates.
7. Example code in proposals must come from actual implementation.

## Pipeline Position

```text
brain-review -> brain-verify -> brain-document -> brain-health
```
