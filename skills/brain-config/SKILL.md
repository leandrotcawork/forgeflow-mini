---
name: brain-config
description: "Unified brain initialization and configuration — auto-detects mode based on .brain/ existence"
---

# brain-config Skill — Init + Configuration

## Trigger

```
/brain-config [section] [--reset section] [--export] [--upgrade] [--hooks-only]
```

---

## Mode Detection

| Condition | Mode | Behavior |
|-----------|------|----------|
| `.brain/` does not exist | **Init** | Full initialization wizard (scan, generate, review, persist) |
| `.brain/` exists | **Edit** | Interactive configuration editor for brain.config.json |
| `--upgrade` flag | **Upgrade** | Re-run hooks + state + env-check on existing .brain/ |
| `--hooks-only` flag | **Hooks** | Re-install or change hook profile only |

---

## Init Mode (no .brain/)

Follow `references/init-wizard.md` for the full 9-phase wizard:

1. **Project Scan** -- detect project type from package.json / go.mod / pyproject.toml
2. **Classify Cortex Regions** -- map detected domains to cortex regions
3. **Generate Hippocampus** -- create architecture.md, conventions.md, strategy.md, decisions_log.md, cortex_registry.md
4. **Generate Cortex** -- create per-region index.md from templates
5. **User Review** -- MUST present all generated files and get explicit approval
6. **Persist** -- write .brain/ directory structure and brain.config.json from `templates/brain-config-default.md`
7. **Initialize State** -- create brain-project-state.json, activity.md, working-memory/
8. **Build Index** -- run `python scripts/build_brain_db.py` (optional, requires Python)
9. **Environment Check** -- verify Node.js, Python, subagent availability; report capability level

After persist, run the hook installation wizard (same as `--hooks-only` flow).

---

## Edit Mode (.brain/ exists)

### Step 1: Show Config by Section

Read `.brain/brain.config.json`. Display section overview:

```
# Brain Configuration
Brain ID: {brain_id} | Version: {version}

| # | Section            | Description                          |
|---|--------------------|--------------------------------------|
| 1 | database           | DB path and schema version           |
| 2 | cortex_regions     | Active domain regions                |
| 3 | hooks              | Hook profile and overrides           |
| 4 | linters            | Extension-to-linter mapping          |
| 5 | resilience         | Circuit breaker + strategy rotation  |
| 6 | subagents          | Dispatch settings and model overrides|
| 7 | learning           | Confidence scoring and promotion     |
| 8 | context_loading    | Tier token budgets and always-loaded |
| 9 | consolidation      | Trigger mode and approval settings   |
|10 | weight_decay       | Decay rate and staleness thresholds  |
```

If `--export` flag: print full config as formatted JSON and stop.

### Step 2: User Selects Section

Present numbered menu. User picks a section by number or name.

### Step 3: Edit with Validation

Display current values as a table (key, current value, type, range, description).
Validate every change against `references/config-schema.md` (type, range, enum,
protected fields). Batch multiple changes before showing diff.

### Step 4: Show Diff and Confirm

Display before/after table for all queued changes. On confirm: write to
brain.config.json and log to activity.md. On cancel: discard and return to menu.

---

## Flags

| Flag | Behavior |
|------|----------|
| `--reset <section>` | Reset section to template defaults from `templates/brain-config-default.md` |
| `--export` | Print full brain.config.json as formatted JSON, then stop |
| `--upgrade` | Skip init phases 1-6; re-run hooks, state, env-check only |
| `--hooks-only` | Run only hook profile selection and installation |

---

## Rules

1. **Never skip user review during init** -- Phase 5 approval is mandatory
2. **Never weaken protected fields** -- `developer_approval_required` MUST stay true; `failure_threshold` >= 1
3. **Always show diff before writing** -- no silent config mutations
4. **Read-only fields are immutable** -- brain_id, version, created_at, database.path, database.schema_version, hooks.profiles
5. **Safe hook merge** -- never overwrite existing non-brain hooks in settings.json
6. **Idempotent** -- re-running init on existing .brain/ switches to edit mode automatically

---

**Created:** 2026-03-30 | **Agent Type:** Initializer + Configuration
