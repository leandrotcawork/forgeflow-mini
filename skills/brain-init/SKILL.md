---
name: brain-init
description: "Initialize Brain for any project (scan → generate → review → persist)"
---

# Brain Init Skill

## Purpose

Initialize a Brain for any project. Scans the project → detects type → generates hippocampus + cortex → presents for developer review → persists to .brain/

## Command

```
/brain-init [project-path]
```

## Input

- **project-path** (optional): Path to project root. Default: current directory (`.`)

## Execution Flow

### Phase 1: Scan Project
- Read `package.json` / `go.mod` / `pyproject.toml` to detect project type
- Read folder structure to identify domains
- Output: project name, tech stack, detected domains

### Phase 2: Classify
- Determine if backend / frontend / database / infra domains exist
- Identify cortex regions needed: `backend`, `frontend`, `database`, `infra`
- Output: classification results

### Phase 3: Generate Hippocampus
- Create draft `architecture.md` from detected stack
- Create draft `conventions.md` with basic naming/folder rules
- Create draft `strategy.md` for product goals
- Create `decisions_log.md` (empty, for ADRs)
- Create `cortex_registry.md` (mapping of all regions)

### Phase 4: Generate Cortex
- Create `cortex/[region]/index.md` for each detected region
- Each region gets a template sinapse with placeholder content

### Phase 5: Review with Developer
- Display all generated files
- Ask: "Proceed with persisting?" (yes/no)
- If NO: cancel without persisting
- If YES: proceed to Phase 6

### Phase 6: Persist to .brain/
- Create `.brain/` directory structure:
  - `.brain/hippocampus/`
  - `.brain/cortex/` — with per-region subdirectories:
    - `.brain/cortex/backend/` + `.brain/cortex/backend/lessons/`
    - `.brain/cortex/frontend/` + `.brain/cortex/frontend/lessons/`
    - `.brain/cortex/database/` + `.brain/cortex/database/lessons/`
    - `.brain/cortex/infra/` + `.brain/cortex/infra/lessons/`
  - `.brain/sinapses/`
  - `.brain/lessons/` — distributed lesson directories:
    - `.brain/lessons/cross-domain/`
    - `.brain/lessons/inbox/`
    - `.brain/lessons/archived/`
  - `.brain/working-memory/`
  - `.brain/progress/`
  - `.brain/progress/completed-contexts/`
- Write all generated markdown files
- Copy `brain.config.json` from template
- Create `.brain/progress/activity.md` with header and initial consolidation checkpoint (required by TaskCompleted hook — append-only, never delete):
  ```markdown
  # Brain Activity Log
  <!-- Auto-appended by TaskCompleted hook. One entry per brain-task. Used by brain-consolidate to batch sinapse updates. -->
  <!-- consolidation-checkpoint: YYYY-MM-DD (updated by brain-consolidate after each cycle) -->
  ```
- Add `"last_consolidation": null` to `brain.config.json` template
- Output: path to `.brain/`, next steps

### Phase 7: Configure Hooks

Install Brain hooks into the project's Claude Code settings **without destroying existing hooks.**

#### Hook Definitions

Two hook groups are required. Each has a unique `matcher` tag (`brain:session-start`, `brain:task-completed`) used for idempotent detection:

**SessionStart hook group:**
```json
{
  "matcher": "brain:session-start",
  "hooks": [
    {
      "type": "prompt",
      "prompt": "Brain session startup protocol:\n(1) Read .brain/hippocampus/architecture.md — understand current platform state\n(2) Read tasks/todo.md — current sprint backlog and blocked items\n(3) Scan .brain/cortex/ for any region marked stale (last_updated older than 7 days or weight < 0.4)\n(4) Output briefing in exactly this format:\nBRAIN: [healthy | stale: <region> | needs-consolidate: <N tasks since last consolidate>]\nSTATE: [clean | in-progress: <task> | blocked: <reason>]\nNEXT: <next incomplete task from todo.md>\nWATCH: <one relevant convention or lesson from hippocampus/conventions.md for NEXT, or omit if none>\n(5) Wait for user direction. Do not start any task autonomously."
    }
  ]
}
```

**TaskCompleted hook group:**
```json
{
  "matcher": "brain:task-completed",
  "hooks": [
    {
      "type": "prompt",
      "prompt": "Run the brain post-task sequence:\n(1) Generate a task-id as YYYY-MM-DD-<short-slug> from the task just completed\n(2) Create .brain/working-memory/task-completion-[task-id].md — include: task description, status (success|failed), model used, files changed with line counts, tests result (pass/fail/count), sinapses referenced, lessons identified\n(3) Invoke /brain-document to propose sinapse updates in .brain/working-memory/sinapse-updates-[task-id].md — NEVER auto-write sinapses, always propose for approval\n(4) Archive: move .brain/working-memory/codex-context-*.md and .brain/working-memory/opus-debug-context-*.md and .brain/working-memory/sonnet-context-*.md and .brain/working-memory/context-packet-*.md to .brain/progress/completed-contexts/ using pattern [task-id]-[original-name].md\n(5) Append entry to .brain/progress/activity.md: timestamp, task-id, description, model, status, files count, sinapses loaded count\n(6) Evaluate whether this task established a durable project-level fact — if yes, update the relevant memory file and MEMORY.md index\n(7) Commit all changes via /commit with format <type>(<scope>): <what>\n(8) Count entries in .brain/progress/activity.md after the last consolidation-checkpoint marker — if 5 or more entries exist since last checkpoint, output: 'BRAIN: 5+ tasks accumulated — run /brain-consolidate to batch-process sinapse updates'\nIf any step fails, report immediately and stop the sequence."
    }
  ]
}
```

#### Safe Merge Algorithm

**CRITICAL: Never overwrite existing hooks.** The `hooks` object in `settings.json` uses arrays — each event type (`SessionStart`, `TaskCompleted`, `PreToolUse`, etc.) holds an **array of hook groups**. Other plugins, user scripts, and project hooks may already exist in these arrays.

```
Step 1: Read `.claude/settings.json`
  - If file exists → parse JSON into `settings`
  - If file does not exist → `settings = {}`

Step 2: Ensure `settings.hooks` exists
  - If `settings.hooks` is undefined → `settings.hooks = {}`

Step 3: For each Brain hook event (SessionStart, TaskCompleted):

  3a. If `settings.hooks[event]` does not exist:
      → Create it: `settings.hooks[event] = [brainHookGroup]`
      → Status: "created"

  3b. If `settings.hooks[event]` exists (is an array):
      → Search the array for an entry where `matcher === "brain:<tag>"`
      → If found: REPLACE that entry only (update in place)
        → Status: "updated"
      → If NOT found: APPEND `brainHookGroup` to the end of the array
        → Status: "appended"

Step 4: Preserve ALL other keys in settings
  - `permissions`, `enabledPlugins`, `PreToolUse`, `PostToolUse`, etc. — untouched

Step 5: Write `settings` back to `.claude/settings.json`
```

**Why `matcher` tags:** The `matcher` field (`brain:session-start`, `brain:task-completed`) serves as a stable identifier. On re-init, the algorithm finds the existing Brain hook group by its matcher and updates it in place — without duplicating or removing other hooks in the same array.

**Example — existing settings with other hooks:**

Before brain-init:
```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "echo 'my custom startup'" }] }
    ],
    "PreToolUse": [
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "lint-check" }] }
    ]
  },
  "permissions": { "allow": ["Bash(npm test)"] }
}
```

After brain-init:
```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "echo 'my custom startup'" }] },
      { "matcher": "brain:session-start", "hooks": [{ "type": "prompt", "prompt": "Brain session startup protocol:..." }] }
    ],
    "TaskCompleted": [
      { "matcher": "brain:task-completed", "hooks": [{ "type": "prompt", "prompt": "Run the brain post-task sequence:..." }] }
    ],
    "PreToolUse": [
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "lint-check" }] }
    ]
  },
  "permissions": { "allow": ["Bash(npm test)"] }
}
```

Note: the existing `SessionStart` hook, `PreToolUse` hooks, and `permissions` are all preserved. Brain hooks are **appended** as new entries.

- Output: hook status per event (created | appended | updated | already present)

### Phase 8: Build Index
- Run `python scripts/build_brain_db.py --brain-path .brain` to build `brain.db` from markdown files
- Schema source of truth: `docs/brain-db-schema.sql`
- Output: sinapse count, lessons count, indexing stats

## Output

- ✅ `.brain/` directory created with full structure
- ✅ `hippocampus/` with constitution files
- ✅ `cortex/` with region templates
- ✅ Claude Code hooks configured (SessionStart + TaskCompleted)
- ✅ `brain.db` SQLite index built
- ✅ Ready for `/brain-status` health check

## Example

```bash
/brain-init ~/my-project

# Output:
# 📍 PHASE 1: Scanning project...
# ✓ Found project: my-project
#
# 🔍 PHASE 2: Classifying...
# ✓ Stack detected: Go, React
# ✓ Cortex regions needed: backend, frontend, database, infra
#
# 🧠 PHASE 3-4: Generating...
# ✓ Generated hippocampus files
# ✓ Generated 4 cortex regions
#
# 👀 PHASE 5: Review...
# [Shows generated files]
# Do you want to proceed? yes
#
# 💾 PHASE 6: Persisting...
# ✓ Created .brain/ directory
# ✓ Wrote hippocampus files
# ✓ Wrote cortex sinapses
#
# 🔗 PHASE 7: Configuring hooks...
# ✓ Created .claude/settings.json with SessionStart + TaskCompleted hooks
#
# 📊 PHASE 8: Indexing...
# ✓ Built brain.db with 12 sinapses
#
# ✨ Brain initialized!
# Next: /brain-status
```

## Success Criteria

1. `.brain/` directory exists in project root
2. All hippocampus files present: `architecture.md`, `conventions.md`, `strategy.md`, `decisions_log.md`, `cortex_registry.md`
3. All cortex regions have `index.md` file
4. `.claude/settings.json` exists with `SessionStart` and `TaskCompleted` hooks configured
5. `brain.db` contains correct sinapse count
6. `brain.config.json` copied successfully

## Next Steps

1. Review generated files in `.brain/`
2. Edit `hippocampus/strategy.md` with product goals
3. Run `/brain-status` to check health
4. Run `/brain-task` to start using the Brain

---

**Created:** 2026-03-24 | **Agent Type:** Initializer
