---
name: brain-document
description: Documenter -- Propose sinapse updates and capture episodes after task completion
---

# brain-document -- Documenter

**Budget:** 1k read, 1k output

## Trigger

Called after brain-verify passes, or manually via `/brain-document`.

**Preconditions:** task implementation complete, task-completion file exists, tests passing.

**Input:** task-completion file (`working-memory/task-completion-{task_id}.md`) + `git diff --name-only`.

## Workflow

### Step 1: Identify Touched Regions

Map changed files to cortex regions using `cortex_registry.md`:

```bash
# Read file list from task-completion artifact (preferred)
# Fallback: git diff --name-only
```

Match each file path to its cortex region (backend, frontend, database, etc.).

### Step 2: Assess Knowledge Changes

For each touched region, answer:
- **New learning?** Pattern/technique not yet documented in cortex
- **Wrong knowledge?** Existing sinapse contradicts what we just did
- **Anti-pattern or insight?** Failure or non-obvious success worth recording

### Step 3: Create Proposals

Use `templates/sinapse-proposal.md` for each proposed update.
Save to `working-memory/sinapse-updates-{task_id}.md`.

Each proposal includes: region, additions/updates/removals with was/now/reason,
impact assessment (confidence, scope, related sinapses), and approval checkbox.

### Step 4: Capture Episodes

Use `templates/episode-format.md` for any anti-pattern, insight, correction, or discovery.
Save to `working-memory/episode-{task_id}-{type}.md`.

Episodes are factual records -- no opinions, no speculation.

### Step 5: Present to User

Show all proposals with brief diff summaries.
Explain that consolidation happens via `/brain-health` -- proposals stay in working-memory until then.

## Rules

1. **NEVER** write to hippocampus directly -- proposals only
2. **NEVER** auto-approve -- developer must approve each proposal
3. Episodes must be factual observations, not opinions
4. Skip documentation if changes are trivial (config tweaks, formatting)
5. All `[[sinapse]]` links must reference existing files
6. Use diff format for updates (add section, not rewrite entire sinapse)
7. Example code in proposals must come from actual implementation

## Pipeline Position

```
brain-task (verify passes) -> brain-document -> brain-health (consolidation)
```

## State Update

After completing:
- Update `brain-project-state.json` with documentation status
- Append activity entry to `activity.md`

---

**Created:** 2026-03-24 | **Agent Type:** Documenter
