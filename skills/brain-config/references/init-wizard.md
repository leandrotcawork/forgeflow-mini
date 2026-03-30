# Init Wizard — 9-Phase Initialization

Reference for brain-config Init mode. Each phase runs sequentially.
Phases marked REQUIRED cannot be skipped.

---

## Phase 1: Project Scan (REQUIRED)

- Read `package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml` to detect project type
- Read folder structure to identify domain directories
- Output: project name, tech stack, detected domains

## Phase 2: Classify Cortex Regions (REQUIRED)

- Map detected directories to cortex regions:
  - `src/`, `lib/`, `cmd/` --> backend
  - `components/`, `pages/`, `app/` --> frontend
  - `migrations/`, `models/`, `schema/` --> database
  - `terraform/`, `docker/`, `k8s/`, `.github/` --> infra
- Only create regions for domains actually found in the project
- Output: region list (e.g., `["backend", "frontend"]`)

## Phase 3: Generate Hippocampus (REQUIRED)

Create draft files under `.brain/hippocampus/`:

| File | Content |
|------|---------|
| `architecture.md` | Detected stack, folder layout, entry points |
| `conventions.md` | Naming rules, folder structure, coding patterns |
| `strategy.md` | Product goals placeholder (user fills in later) |
| `decisions_log.md` | Empty ADR log with header template |
| `cortex_registry.md` | Maps each region to its directory and purpose |

## Phase 4: Generate Cortex (REQUIRED)

- Create `.brain/cortex/{region}/index.md` for each region from Phase 2
- Each index.md uses the sinapse template with placeholder content
- Include domain-specific starter notes (e.g., API routes for backend)

## Phase 5: User Review (REQUIRED -- NEVER SKIP)

- Display all generated hippocampus and cortex files to the developer
- Present approval prompt: "Brain files generated. Proceed with persisting?"
- If YES: continue to Phase 6
- If NO: delete all generated content, leave project directory clean

## Phase 6: Persist (REQUIRED)

- Create `.brain/` directory tree:
  - `.brain/hippocampus/`
  - `.brain/cortex/{region}/` (per detected region only)
  - `.brain/sinapses/`
  - `.brain/working-memory/`
  - `.brain/progress/`
  - `.brain/progress/completed-contexts/`
- Write all generated markdown files
- Write `brain.config.json` from template, resolving placeholders:
  - `created_at`: actual ISO 8601 timestamp
  - `cortex_regions`: actual detected regions
  - `brain_id`: derived from project name

## Phase 7: Initialize State (REQUIRED)

- Copy `brain-state.json` template to `.brain/working-memory/brain-state.json`
- Copy `brain-project-state.json` template to `.brain/brain-project-state.json`
- Create `.brain/progress/activity.md` with header and consolidation checkpoint
- Verify both JSON files parse correctly

## Phase 8: Build Index (OPTIONAL)

- Run `python scripts/build_brain_db.py --brain-path .brain`
- Schema source of truth: `docs/brain-db-schema.sql`
- If Python unavailable: warn and skip (brain.db queries degraded)
- Output: sinapse count, indexing stats

## Phase 9: Environment Check (REQUIRED)

Verify runtime dependencies and report capability level:

| Component | Check | If missing |
|-----------|-------|------------|
| Node.js | `node --version` | Hooks DISABLED |
| Python | `python --version` | brain.db queries unavailable |
| Subagents | Agent tool presence | Falls back to inline execution |

Capability levels:
- **FULL** -- all components available
- **DEGRADED** -- one or more missing; list affected features
- **MINIMAL** -- only core pipeline works (no hooks, no DB, no subagents)

---

## Upgrade Flow (--upgrade)

Skip Phases 1-6. Run only:
- Hook installation wizard (profile selection + safe merge)
- Phase 7: State files
- Phase 9: Environment check

## Hooks-Only Flow (--hooks-only)

Run only hook profile selection and installation.
See SKILL.md Rules for safe hook merge algorithm.
