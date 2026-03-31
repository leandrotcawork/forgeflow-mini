---
name: brain-config
description: "Unified brain initialization and configuration — auto-detects mode based on .brain/ existence"
---

# brain-config — Init + Configuration

## Trigger

```
/brain-config [section] [--reset section] [--export] [--upgrade] [--hooks-only]
```

## Mode Detection

| Condition | Mode |
|-----------|------|
| `.brain/` does not exist | **Init** — run Phases 1–10 below |
| `.brain/` exists | **Edit** — run Edit Mode below |
| `--upgrade` flag | **Upgrade** — run Phases 7, 9, 10 only |
| `--hooks-only` flag | **Hooks** — run Phase 10 only |

---

## Init Mode — 10-Phase Wizard

Use TodoWrite to track each phase. Mark complete immediately when done.

### Phase 1: Project Scan

Read these files to detect project type:
- `package.json` → name, scripts, dependencies
- `go.mod` → module name
- `pyproject.toml` → tool.poetry.name or project.name
- `Cargo.toml` → package.name

If none found: use directory name as project name.

Scan top-level directories to identify domains.

**Output:** project name, tech stack, detected directories.

### Phase 2: Classify Cortex Regions

Map detected directories to regions. **Only create regions for directories that actually exist.**

| Directory | Region |
|-----------|--------|
| `src/`, `lib/`, `cmd/` | backend |
| `components/`, `pages/`, `app/` | frontend |
| `migrations/`, `models/`, `schema/` | database |
| `terraform/`, `docker/`, `k8s/`, `.github/` | infra |
| `skills/` | skills |
| `scripts/` | scripts |
| `hooks/` | hooks |
| `mcp/` | mcp |
| `tests/` | testing |
| `docs/` | docs |

**Output:** `["region1", "region2", ...]`

### Phase 3: Generate Hippocampus

Draft these files (hold in context — do not write to disk until Phase 5 approval):

| File | Content |
|------|---------|
| `.brain/hippocampus/architecture.md` | Detected stack, folder layout, entry points, major patterns |
| `.brain/hippocampus/conventions.md` | Naming rules, folder structure, coding patterns, absolute rules |
| `.brain/hippocampus/strategy.md` | Product vision placeholder + priorities checklist |
| `.brain/hippocampus/decisions_log.md` | Empty ADR log with `## ADR-0001: (Title)\n\n**Decision:**\n\n**Rationale:**\n\n**Consequences:**` template |
| `.brain/hippocampus/cortex_registry.md` | Table: Region | Directory | Purpose |

Use YAML frontmatter on each file: `id`, `title`, `region: hippocampus`, `tags`, `weight: 1.0`, `updated_at`.

### Phase 4: Generate Cortex

Draft `.brain/cortex/{region}/index.md` for each region from Phase 2.

Each file uses YAML frontmatter (`id: cortex-{region}`, `title: {Region} Domain`, `region: cortex/{region}`, `tags`, `weight: 0.5`, `updated_at`) followed by a domain-specific starter table (e.g., scripts inventory, hooks table, skills table).

### Phase 5: User Review — MANDATORY. NEVER SKIP.

**Present all generated hippocampus and cortex files to the developer now.**
Show each file's path and full content.

Then output exactly:
> **"Brain files generated. Proceed with persisting? (YES / NO)"**

- **YES** → continue to Phase 6
- **NO** → discard all generated content, output "Init cancelled. Project directory is clean." and stop completely.

**Do not write a single file to disk before receiving YES.**

### Phase 6: Persist

Create directory structure:

```
.brain/
├── hippocampus/
├── cortex/{region}/     (one per detected region only)
├── sinapses/
├── working-memory/
├── progress/
│   └── completed-contexts/
└── lessons/
    ├── cross-domain/
    ├── inbox/
    └── archived/
```

Write all hippocampus files from Phase 3 and cortex index files from Phase 4.

Write `.brain/brain.config.json` from `templates/brain/brain.config.json`, replacing:
- `{project-name}` → project name from Phase 1
- `{ISO8601_TIMESTAMP}` → current timestamp (`new Date().toISOString()`)
- `{detected_regions}` → JSON array from Phase 2 (e.g., `["skills","scripts","hooks"]`)

### Phase 7: Initialize State

Write these files exactly from their templates — do not modify content:

- `.brain/working-memory/brain-state.json` ← copy from `templates/brain/working-memory/brain-state.json`
- `.brain/progress/brain-project-state.json` ← copy from `templates/brain/progress/brain-project-state.json`

Create `.brain/progress/activity.md`:

```markdown
# Activity Log

## Consolidation Checkpoint
Last consolidation: never
Tasks since last consolidation: 0

---

## {YYYY-MM-DD} — Brain Initialized
- Brain initialized via /brain-config
- Regions: {detected_regions}
- Hook profile: (set in Phase 10)
```

Verify both JSON files parse correctly before continuing. If either fails to parse, stop and report the error.

### Phase 8: Build Index (Optional — non-blocking)

```bash
python scripts/build_brain_db.py --brain-path .brain
```

If Python unavailable: output "Phase 8: SKIP — Python not available. brain.db queries will be degraded." and continue.
If script fails: output the error and continue. Phase 8 is **non-blocking**.

### Phase 9: Environment Check

Run each command and record result:

```bash
node --version   # FAIL → "Hooks DISABLED — Node.js not found"
python --version # FAIL → "brain.db queries unavailable — Python not found"
```

Check Agent tool availability. Report capability level:

| Level | Condition |
|-------|-----------|
| **FULL** | Node.js + Python + subagents all available |
| **DEGRADED** | One or more missing — list affected features |
| **MINIMAL** | No hooks, no DB, no subagents |

### Phase 10: Hook Installation Wizard — MANDATORY. NEVER SKIP. MANDATORY. RUNS AFTER PHASE 6.

**This phase is not optional. It runs every time Init Mode completes.**

Present profile menu:

```
Hook Profile Selection:
  1. minimal  — No hooks. Raw pipeline execution.
  2. standard — session-start + hippocampus-guard (recommended)

Which profile? (1 or 2, default: 2)
```

Wait for user response. Default to `standard` if no answer given.

Find the user's Claude Code settings file. Check in order:
1. `.claude/settings.json` (project-local)
2. `~/.claude/settings.json` (global)

**SAFE MERGE RULE — apply exactly:**
1. Read existing `settings.json` (create empty `{"hooks":{}}` if missing)
2. Remove only hook entries whose `name` starts with `brain-`
3. Add new brain hooks for the selected profile (see below)
4. Write merged result back

**Hooks for `standard` profile** — replace `{PROJECT_ROOT}` with the absolute path to this project:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "name": "brain-session-start",
        "command": "bash {PROJECT_ROOT}/hooks/session-start.sh"
      }
    ],
    "PreToolUse": [
      {
        "name": "hippocampus-guard",
        "command": "bash {PROJECT_ROOT}/hooks/hippocampus-guard.sh",
        "toolNames": ["Write", "Edit"]
      }
    ]
  }
}
```

**Hooks for `minimal` profile:** remove any existing `brain-*` hooks. Add nothing.

Output confirmation: `"Hooks installed: {profile}. settings.json updated at {path}."`

---

## Edit Mode (.brain/ exists)

### Step 1: Show Config Overview

Read `.brain/brain.config.json`. Display:

```
# Brain Configuration
Brain ID: {brain_id} | Version: {version}

| # | Section         | Description                          |
|---|-----------------|--------------------------------------|
| 1 | database        | DB path and schema version           |
| 2 | cortex_regions  | Active domain regions                |
| 3 | hooks           | Hook profile and overrides           |
| 4 | linters         | Extension-to-linter mapping          |
| 5 | resilience      | Circuit breaker + strategy rotation  |
| 6 | subagents       | Dispatch settings                    |
| 7 | learning        | Confidence scoring and promotion     |
| 8 | context_loading | Tier token budgets                   |
| 9 | consolidation   | Trigger mode and approval settings   |
|10 | weight_decay    | Decay rate and staleness thresholds  |
```

If `--export` flag: print full `brain.config.json` as formatted JSON and stop.

### Step 2: User Selects Section → Edit → Diff → Confirm

Display current values for selected section as a table: key | current value | type | allowed range.

**Read-only fields (reject any write attempt):** `brain_id`, `version`, `created_at`, `database.path`, `database.schema_version`, `hooks.profiles`

**Protected constraint:** `consolidation.developer_approval_required` MUST remain `true`. Reject any attempt to set it to `false`.

Batch all changes before showing diff. Show before/after diff table. On confirm: write to `brain.config.json` and append change log to `.brain/progress/activity.md`. On cancel: discard all changes.

---

## Flags

| Flag | Behavior |
|------|----------|
| `--reset <section>` | Reset section to defaults from `templates/brain/brain.config.json` |
| `--export` | Print full brain.config.json as formatted JSON, then stop |
| `--upgrade` | Run Phases 7, 9, 10 only on existing .brain/ |
| `--hooks-only` | Run Phase 10 only |

---

## Rules

1. **Phase 5 is mandatory** — never write files to disk without explicit YES
2. **Phase 10 is mandatory** — hook wizard runs at the end of every Init
3. **Never weaken protected fields** — `developer_approval_required` stays `true`
4. **Always show diff before writing** — no silent config mutations
5. **Safe hook merge** — never overwrite non-brain hooks in settings.json
6. **Idempotent** — running init on existing `.brain/` switches to Edit Mode automatically

---

**Refactored:** 2026-03-30 | **Agent Type:** Initializer + Configuration
