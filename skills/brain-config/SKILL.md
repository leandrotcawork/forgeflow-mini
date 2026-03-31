---
name: brain-config
description: Unified brain initialization and configuration for repository-local `.claude/` rules and `.brain/` project memory.
---

# brain-config -- Init + Configuration

## Trigger

```text
/brain-config [section] [--reset section] [--export] [--upgrade] [--hooks-only]
```

## Mode Detection

| Condition | Mode |
|---|---|
| `.brain/` does not exist | Init |
| `.brain/` exists | Edit |
| `--upgrade` flag | Upgrade |
| `--hooks-only` flag | Hooks |

## Init Mode

Use TodoWrite to track each phase.

### Phase 1: Project Scan

Read common manifest files to detect project name and stack:
- `package.json`
- `go.mod`
- `pyproject.toml`
- `Cargo.toml`

If none exist, use the repository directory name.
Scan top-level directories to detect domains.

### Phase 2: Classify Cortex Regions

Map detected directories into regions and only create regions that exist.

| Directory | Region |
|---|---|
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

### Phase 3: Generate Hippocampus

Draft these files in memory first:

| File | Content |
|---|---|
| `.brain/hippocampus/architecture.md` | Stack, folder layout, entry points, major patterns |
| `.brain/hippocampus/conventions.md` | Naming rules, folder structure, coding patterns, absolute rules |
| `.brain/hippocampus/strategy.md` | Product vision placeholder and priorities |
| `.brain/hippocampus/decisions_log.md` | Empty ADR log |
| `.brain/hippocampus/cortex_registry.md` | Region to directory map |
| `.brain/hippocampus/rules-promotion-policy.md` | Separation of `.brain/` memory and `.claude/rules/` |

Use YAML frontmatter on each hippocampus file.

### Phase 4: Generate Cortex

Draft `.brain/cortex/{region}/index.md` for each detected region.

### Phase 5: User Review

Present generated hippocampus and cortex files before persisting anything.

Output exactly:
> **"Brain files generated. Proceed with persisting? (YES / NO)"**

- `YES` -> continue
- `NO` -> discard drafts and stop

Never write files before explicit `YES`.

### Phase 6: Persist

Create or update this repository-local layout:

```text
.claude/
+-- CLAUDE.md
+-- rules/
|   +-- workflow-core.md
|   +-- testing.md
|   +-- reuse-and-architecture.md
.brain/
+-- hippocampus/
+-- cortex/{region}/
+-- episodes/
+-- working-memory/
+-- progress/
|   +-- completed-contexts/
```

Create or update:
- `.claude/CLAUDE.md`
- `.claude/rules/workflow-core.md`
- `.claude/rules/testing.md`
- `.claude/rules/reuse-and-architecture.md`
- `.brain/hippocampus/`
- `.brain/cortex/`
- `.brain/episodes/`
- `.brain/working-memory/`

Write hippocampus files from Phase 3 and cortex files from Phase 4.
Write `.brain/brain.config.json` from `templates/brain/brain.config.json`.
`.claude/rules/` starts with regras-base do plugin and only receives future memory promotions with explicit approval.

Never store project memory in the plugin installation directory.
Project memory must live in `.brain/` inside the repository.

### Phase 7: Initialize State

Write from templates:
- `.brain/working-memory/brain-state.json`
- `.brain/working-memory/workflow-state.json`
- `.brain/progress/brain-project-state.json`

Create `.brain/progress/activity.md`.
Verify JSON files parse before continuing.

### Phase 8: Build Index

Optional, non-blocking:

```bash
python scripts/build_brain_db.py --brain-path .brain
```

If unavailable, continue with a clear warning.

### Phase 9: Environment Check

Run:

```bash
node --version
python --version
```

Report capability level: `FULL`, `DEGRADED`, or `MINIMAL`.

### Phase 10: Hook Installation Wizard

This phase is mandatory after persist.

Offer:

```text
Hook Profile Selection:
  1. minimal
  2. standard
```

Safely merge brain hooks into project-local or global Claude settings without overwriting non-brain hooks.

## Edit Mode

Read `.brain/brain.config.json`.
Show current sections, allow edits, show diff, and confirm before writing.

Read-only fields:
- `brain_id`
- `version`
- `created_at`
- `database.path`
- `database.schema_version`
- `hooks.profiles`

Protected constraint:
- `consolidation.developer_approval_required` must remain `true`

## Flags

| Flag | Behavior |
|---|---|
| `--reset <section>` | Reset from `templates/brain/brain.config.json` |
| `--export` | Print full config and stop |
| `--upgrade` | Run missing-init steps on existing `.brain/` |
| `--hooks-only` | Run hook installation only |

## Rules

1. Phase 5 is mandatory. Never persist without explicit `YES`.
2. Phase 10 is mandatory. Hook selection runs at the end of Init.
3. Never weaken protected fields.
4. Always show diff before writing.
5. Safe hook merge only. Never overwrite non-brain hooks.
6. Idempotent. Existing `.brain/` switches to Edit Mode.
7. Never store project memory. Memory belongs in `.brain/` in the repository, never in the plugin install directory.
