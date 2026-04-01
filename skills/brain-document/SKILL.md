---
name: brain-document
description: Register episode and propose sinapse updates after verified task. Generates auto-commit. Updates phase to COMPLETED.
---

# brain-document

Register the episode, propose sinapse updates, generate the auto-commit, and mark the task complete.

## Trigger

Called after brain-verify passes. `workflow-state.json` must have `phase: DOCUMENTING` and `verify_status: passed`.

## Hard Gates

1. Read `workflow-state.json` first.
2. Stop unless `phase = "DOCUMENTING"` and `verify_status = "passed"`.
3. If the gate fails, stop with: `brain-document: requires verify_status=passed and phase=DOCUMENTING.`
4. Never write to `.brain/hippocampus/` directly.
5. Never auto-approve sinapse proposals.

## Required Input

- `.brain/working-memory/task-completion-{task_id}.md`
- `.brain/working-memory/workflow-state.json`
- Git diff of the implementation

## Step 1: Write Episode

Write `.brain/episodes/episode-{task_id}.md` using the template at `templates/episode.md`.

Fill every section:
- **What Was Done** — one paragraph summary of what was implemented and how
- **Errors Encountered** — every significant error hit and how it was resolved
- **Patterns Used** — patterns, techniques, or architectural decisions used
- **Proposed Sinapse Updates** — sinapse names + descriptions to propose (not to create directly)

## Step 2: Propose Sinapse Updates

For each pattern or convention discovered:
- Write a proposal to `.brain/working-memory/sinapse-updates-{task_id}.md`
- Format: `[[sinapse-name]]: description of the pattern to encode`
- Mark clearly as PROPOSED — developer must approve before becoming a convention

Rules:
- Only propose if the pattern is likely to recur
- All `[[sinapse]]` links must reference patterns that could become real files
- Example code in proposals must come from the actual implementation

## Step 3: Generate Auto-Commit

Run:
```bash
# Stage only allowed_files from workflow-state.json
git add <each file from allowed_files>
git add .brain/episodes/episode-{task_id}.md
git add .brain/working-memory/sinapse-updates-{task_id}.md
git commit -m "feat({domain}): {task_id} — {one-line summary} [forgeflow]"
```

Where:
- `{domain}` = primary area affected (e.g., hooks, skills, tests, agents)
- `{task_id}` = the task_id from workflow-state
- `{one-line summary}` = brief description of what was built

Only stage files from `allowed_files` in workflow-state plus the episode and sinapse-updates files. Never use `git add -A` — it can stage unintended files (credentials, binaries, .env).

## Step 4: Update State and Present Result

Update `workflow-state.json`:
```json
{
  "phase": "COMPLETED",
  "commit_sha": "<sha from the auto-commit>"
}
```

Present to the user:
```
Task {task_id} — COMPLETED

Branch: forgeflow/{task_id}
Commit: <sha>

To merge: git merge forgeflow/{task_id} (manual, never automated)
Episode saved to: .brain/episodes/episode-{task_id}.md
Sinapse proposals: .brain/working-memory/sinapse-updates-{task_id}.md
```

## Pipeline

`brain-dev → brain-spec → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document`
