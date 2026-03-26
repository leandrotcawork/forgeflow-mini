---
name: brain-init
description: "Initialize Brain for any project (scan > generate > review > persist > hooks > index > state > env-check)"
---

# Brain Init Skill

## Purpose

Initialize a Brain for any project. Scans the project, detects type, generates hippocampus + cortex, presents for developer review, persists to .brain/, installs tiered hooks, builds the SQLite index, initializes state files, and verifies the runtime environment.

## Command

```
/brain-init [project-path] [--upgrade] [--hooks-only]
```

## Input

- **project-path** (optional): Path to project root. Default: current directory (`.`)
- **--upgrade** (optional): Skip Phases 1-6 and 8. Runs only Phases 7, 9, and 10 on an existing `.brain/` directory. Use this when migrating between versions (e.g., v0.2.0 to v0.3.0) to install new hooks and state files without regenerating the brain.
- **--hooks-only** (optional): Run only Phase 7 (hook installation). Use this to change hook profiles or reinstall hooks without touching anything else.

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
- Create `.brain/cortex/[region]/index.md` for each detected region
- Each region gets a template sinapse with placeholder content

### Phase 5: Review with Developer
- Display all generated files
- Ask: "Proceed with persisting?" (yes/no)
- If NO: cancel without persisting
  **On cancel:** Delete all `.brain/` files and directories generated during Phases 1-4. Do NOT write `.brain/brain.config.json`. Leave the project directory in its original clean state. Inform the developer: 'brain-init cancelled. No files were persisted.'
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
- Create `.brain/progress/activity.md` with header and initial consolidation checkpoint (append-only, never delete):
  ```markdown
  # Brain Activity Log
  <!-- Auto-appended by brain-task Step 5 after each task. Used by brain-consolidate to batch sinapse updates. -->
  <!-- consolidation-checkpoint: YYYY-MM-DD (updated by brain-consolidate after each cycle) -->
  ```
- Add `"last_consolidation": null` to `brain.config.json` template
- Output: path to `.brain/`, next steps

### Phase 7: Tiered Hook Installation

Hooks are optional enhancements implemented in `hooks/brain-hooks.js` and defined in `hooks/hooks.json` within the plugin directory. The brain pipeline is fully self-contained — all skills run inline without any hooks. Hooks add convenience (automatic session briefing, hippocampus guard, strategy rotation) but are never in the critical path.

#### Step 7.1: Select Hook Profile

Ask the developer which hook profile they want:

| Profile | Tiers | Hooks Included | Description |
|---------|-------|----------------|-------------|
| **minimal** | Tier 1 only | `brain-state-restore`, `brain-hippocampus-guard`, `brain-config-protection`, `brain-session-end` | Session briefing, hippocampus immutability guard, config protection, session-end persistence |
| **standard** (DEFAULT) | Tier 1 + 2 | All minimal hooks + `brain-strategy-rotation`, `brain-quality-gate`, `brain-task-safety-net` | Adds strategy rotation after consecutive failures, post-write linter suggestions, stalled-task warnings |
| **strict** | All tiers | All standard hooks + `brain-activity-observer` | Adds file modification tracking in `modified-files.json` |

Present the choice as:
```
Which hook profile? [minimal / standard / strict] (default: standard)
```

If the developer declines hooks entirely, skip the rest of Phase 7.

#### Step 7.2: Read Hook Definitions

Read the hook definitions from `hooks/hooks.json` in the plugin directory. This file defines hooks organized by Claude Code event type (`PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`), each with an `id`, `description`, `matcher`, and `command` field.

The hooks defined in `hooks.json` are:

**Tier 1 (minimal):**
- `brain-state-restore` (SessionStart) — Restores brain state summary into session context
- `brain-hippocampus-guard` (PreToolUse, matcher: `Write|Edit`) — Blocks writes to `.brain/hippocampus/`
- `brain-config-protection` (PreToolUse, matcher: `Write|Edit`) — Blocks config changes that weaken rules
- `brain-session-end` (SessionEnd) — Persists `brain-state.json` with session-end timestamp

**Tier 2 (standard):**
- `brain-strategy-rotation` (PreToolUse, matcher: `*`) — Suggests strategy rotation after 2+ consecutive failures
- `brain-quality-gate` (PostToolUse, matcher: `Write|Edit`) — Checks for associated linter command after file writes
- `brain-task-safety-net` (PreToolUse, matcher: `*`) — Warns if pipeline step > 3 but no task-completion file found

**Tier 3 (strict):**
- `brain-activity-observer` (PostToolUse, matcher: `Write|Edit|Bash`) — Tracks all modified file paths in `modified-files.json`

#### Step 7.3: Resolve Plugin Path

The command for each hook runs `node "{plugin-path}/hooks/brain-hooks.js" {hookName}`. The `{plugin-path}` must be resolved to the actual absolute path where the ForgeFlow Mini plugin is installed. This varies by installation method:
- If installed via `~/.claude/plugins/`, resolve from there
- If installed to a project-local path, resolve relative to the project

Use `$CLAUDE_PLUGIN_DIR` as provided in hooks.json — Claude Code resolves this variable at hook execution time to the plugin's installed directory. Do **not** substitute a literal absolute path, as this breaks portability when the plugin cache location changes.

#### Step 7.4: Build Hook Groups and Install

For each event type in `hooks.json`, filter hooks by the selected profile's tier ceiling (minimal = tier 1, standard = tier 2, strict = tier 3). Then build Claude Code hook groups using this format:

```json
{
  "matcher": "{matcher-from-hooks.json}",
  "hooks": [
    {
      "type": "command",
      "command": "node \"{resolved-plugin-path}/hooks/brain-hooks.js\" {hookFunctionName}"
    }
  ]
}
```

Each hook becomes a separate hook group entry. Idempotency is detected by searching the existing hooks array for the hook's command string. If an entry already exists whose `command` contains `brain-hooks.js {hookName}` (e.g., `brain-hooks.js hippocampusGuard`), skip that hook — it is already installed. Do NOT use the matcher field for idempotency detection.

**Concrete example — standard profile produces these hook groups:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" hippocampusGuard" }]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" configProtection" }]
      },
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" strategyRotation" }]
      },
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" taskSafetyNet" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" qualityGate" }]
      }
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" stateRestore" }]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" sessionEnd" }]
      }
    ]
  }
}
```

#### Safe Merge Algorithm

**CRITICAL: Never overwrite existing hooks.** The `hooks` object in `settings.json` uses arrays — each event type (`SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, etc.) holds an **array of hook groups**. Other plugins, user scripts, and project hooks may already exist in these arrays.

```
Step 1: Read `.claude/settings.json`
  - If file exists -> parse JSON into `settings`
  - If file does not exist -> `settings = {}`

Step 2: Ensure `settings.hooks` exists
  - If `settings.hooks` is undefined -> `settings.hooks = {}`

Step 3: For each Brain hook group to install:

  3a. If `settings.hooks[event]` does not exist:
      -> Create it: `settings.hooks[event] = [brainHookGroup]`
      -> Status: "created"

  3b. If `settings.hooks[event]` exists (is an array):
      -> Search the array for an entry whose `hooks[0].command` contains
         the hook function name (e.g., "hippocampusGuard", "stateRestore")
      -> If found: REPLACE that entry only (update in place)
        -> Status: "updated"
      -> If NOT found: APPEND `brainHookGroup` to the end of the array
        -> Status: "appended"

Step 4: Preserve ALL other keys in settings
  - `permissions`, `enabledPlugins`, other hook events — untouched

Step 5: Write `settings` back to `.claude/settings.json`
```

**Why command-based detection:** Each brain hook has a unique function name in its command string (`hippocampusGuard`, `stateRestore`, etc.). On re-init, the algorithm finds the existing Brain hook group by checking if its command contains the function name and updates it in place — without duplicating or removing other hooks in the same array.

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

After brain-init (standard profile):
```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "echo 'my custom startup'" }] },
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" stateRestore" }] }
    ],
    "PreToolUse": [
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "lint-check" }] },
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" hippocampusGuard" }] },
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" configProtection" }] },
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" strategyRotation" }] },
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" taskSafetyNet" }] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" qualityGate" }] }
    ],
    "SessionEnd": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"/home/user/.claude/plugins/forgeflow-mini/hooks/brain-hooks.js\" sessionEnd" }] }
    ]
  },
  "permissions": { "allow": ["Bash(npm test)"] }
}
```

Note: the existing `SessionStart` hook, `PreToolUse` hooks, and `permissions` are all preserved. Brain hooks are **appended** as new entries.

#### Step 7.5: Store Profile Selection

Write the selected profile name into `.brain/brain.config.json` under the `hooks.profile` key:

```json
{
  "hooks": {
    "profile": "standard",
    "profiles": {
      "minimal": "Tier 1 only — session briefing, hippocampus guard, config protection, session end",
      "standard": "Tier 1+2 — adds strategy rotation, quality gate, task safety net",
      "strict": "All tiers — adds activity observer"
    },
    "individual_overrides": {}
  }
}
```

#### Step 7.6: Report

Output hook installation status per event type (created | appended | updated | already present), plus the selected profile and total hook count.

Example output:
```
Hook profile: standard (Tier 1+2, 7 hooks)
  SessionStart:  1 hook  — created
  SessionEnd:    1 hook  — created
  PreToolUse:    4 hooks — appended (existing hooks preserved)
  PostToolUse:   1 hook  — created
```

### Phase 8: Build Index
- Run `python scripts/build_brain_db.py --brain-path .brain` to build `brain.db` from markdown files
- Schema source of truth: `docs/brain-db-schema.sql`
- Output: sinapse count, lessons count, indexing stats

### Phase 9: Initialize State Files

Initialize the runtime state files that hooks and the pipeline use for session tracking and progress monitoring.

1. Copy `templates/brain/working-memory/brain-state.json` from the plugin directory to `.brain/working-memory/brain-state.json`
   - This file tracks: session ID, pipeline step, task counts, consecutive failures, strategy rotation state, context pressure, and active context files
2. Copy `templates/brain/progress/brain-project-state.json` from the plugin directory to `.brain/progress/brain-project-state.json`
   - This file tracks: total tasks completed, consolidation cycles, model usage counts, subagent usage, escalation velocity, average task tokens, and circuit breaker state
3. Verify both files are valid JSON after copying
4. Output: "State management initialized"

### Phase 10: Environment Check

Verify that the runtime environment supports all plugin capabilities. Report what is available and what will be degraded.

1. **Node.js check:** Run `node --version`
   - If available: hooks are fully functional
   - If missing: hooks will not work — warn the developer and suggest installing Node.js
2. **Python check:** Run `python --version` or `python3 --version`
   - If available: `brain.db` queries via `build_brain_db.py` are enabled
   - If missing: Phase 8 (Build Index) would have failed — warn if brain.db was not built
3. **Subagent availability:** Note that subagent dispatch (used by brain-task for parallel review, brain-codex-review for Codex delegation) works if the Agent tool is available in Claude Code. No active test is needed — the plugin degrades gracefully by falling back to inline execution when the Agent tool is not present.
4. Output environment report:

```
Environment:
  Node.js:    v20.x  (hooks enabled)
  Python:     3.11   (brain.db queries enabled)
  Subagents:  available (Agent tool detected)

Capabilities: FULL
```

If any component is missing, adjust the report accordingly:

```
Environment:
  Node.js:    not found  (hooks DISABLED — install Node.js >= 18)
  Python:     3.11       (brain.db queries enabled)
  Subagents:  available  (Agent tool detected)

Capabilities: DEGRADED — hooks unavailable
```

Possible capability levels:
- **FULL** — Node.js, Python, and Agent tool all available
- **DEGRADED** — one or more components missing; list which features are affected
- **MINIMAL** — only core pipeline works (no hooks, no brain.db, no subagents)

## Output

- `.brain/` directory created with full structure
- `.brain/hippocampus/` with constitution files
- `.brain/cortex/` with region templates
- Hooks installed per selected profile (or skipped if declined)
- `brain.db` SQLite index built
- `brain-state.json` and `brain-project-state.json` initialized
- Environment verified and capability level reported
- Ready for `/brain-status` health check

## Example

```bash
/brain-init ~/my-project

# Output:
# PHASE 1: Scanning project...
# Found project: my-project
#
# PHASE 2: Classifying...
# Stack detected: Go, React
# Cortex regions needed: backend, frontend, database, infra
#
# PHASE 3-4: Generating...
# Generated hippocampus files
# Generated 4 cortex regions
#
# PHASE 5: Review...
# [Shows generated files]
# Do you want to proceed? yes
#
# PHASE 6: Persisting...
# Created .brain/ directory
# Wrote hippocampus files
# Wrote cortex sinapses
#
# PHASE 7: Installing hooks...
# Which hook profile? [minimal / standard / strict] (default: standard)
# > standard
# Hook profile: standard (Tier 1+2, 7 hooks)
#   SessionStart:  1 hook  — created
#   SessionEnd:    1 hook  — created
#   PreToolUse:    4 hooks — appended
#   PostToolUse:   1 hook  — created
#
# PHASE 8: Indexing...
# Built brain.db with 12 sinapses
#
# PHASE 9: State files...
# Copied brain-state.json to .brain/working-memory/
# Copied brain-project-state.json to .brain/progress/
# State management initialized
#
# PHASE 10: Environment check...
# Environment:
#   Node.js:    v20.11.1  (hooks enabled)
#   Python:     3.11.8    (brain.db queries enabled)
#   Subagents:  available (Agent tool detected)
# Capabilities: FULL
#
# Brain initialized!
# Next: /brain-status
```

### Example: Upgrade existing brain

```bash
/brain-init --upgrade

# Output:
# PHASE 7: Installing hooks...
# Hook profile: standard (Tier 1+2, 7 hooks)
#   SessionStart:  1 hook  — updated
#   SessionEnd:    1 hook  — updated
#   PreToolUse:    4 hooks — updated
#   PostToolUse:   1 hook  — updated
#
# PHASE 9: State files...
# Copied brain-state.json to .brain/working-memory/
# Copied brain-project-state.json to .brain/progress/
# State management initialized
#
# PHASE 10: Environment check...
# Environment:
#   Node.js:    v20.11.1  (hooks enabled)
#   Python:     3.11.8    (brain.db queries enabled)
#   Subagents:  available (Agent tool detected)
# Capabilities: FULL
#
# Brain upgraded!
```

### Example: Hooks only

```bash
/brain-init --hooks-only

# Output:
# PHASE 7: Installing hooks...
# Which hook profile? [minimal / standard / strict] (default: standard)
# > strict
# Hook profile: strict (All tiers, 8 hooks)
#   SessionStart:  1 hook  — updated
#   SessionEnd:    1 hook  — updated
#   PreToolUse:    4 hooks — updated
#   PostToolUse:   2 hooks — updated
#
# Hooks installed. Profile saved to .brain/brain.config.json
```

## Success Criteria

1. `.brain/` directory exists in project root
2. All hippocampus files present: `architecture.md`, `conventions.md`, `strategy.md`, `decisions_log.md`, `cortex_registry.md`
3. All cortex regions have `index.md` file
4. `brain.db` contains correct sinapse count
5. `brain.config.json` copied successfully with `hooks.profile` set to the selected profile
6. `.claude/settings.json` has hooks installed matching the selected profile (or no brain hooks if developer declined)
7. `.brain/working-memory/brain-state.json` exists and contains valid JSON
8. `.brain/progress/brain-project-state.json` exists and contains valid JSON
9. Environment check completed with capability level reported

## Next Steps

1. Review generated files in `.brain/`
2. Edit `.brain/hippocampus/strategy.md` with product goals
3. Run `/brain-status` to check health
4. Run `/brain-task` to start using the Brain

---

**Created:** 2026-03-24 | **Updated:** 2026-03-26 | **Agent Type:** Initializer
