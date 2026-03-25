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
- Create `.brain/progress/activity.md` with header (required by TaskCompleted hook — append-only, never delete):
  ```markdown
  # Brain Activity Log
  <!-- Auto-appended by TaskCompleted hook. One entry per brain-task. Used by brain-consolidate to batch sinapse updates. -->
  ```
- Output: path to `.brain/`, next steps

### Phase 7: Build Index
- Run `python scripts/build_brain_db.py --brain-path .brain` to build `brain.db` from markdown files
- Schema source of truth: `docs/brain-db-schema.sql`
- Output: sinapse count, lessons count, indexing stats

## Output

- ✅ `.brain/` directory created with full structure
- ✅ `hippocampus/` with constitution files
- ✅ `cortex/` with region templates
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
# 📊 PHASE 7: Indexing...
# ✓ Built brain.db with 12 sinapses
#
# ✨ Brain initialized!
# Next: /brain-status
```

## Success Criteria

1. `.brain/` directory exists in project root
2. All hippocampus files present: `architecture.md`, `conventions.md`, `strategy.md`, `decisions_log.md`, `cortex_registry.md`
3. All cortex regions have `index.md` file
4. `brain.db` contains correct sinapse count
5. `brain.config.json` copied successfully

## Next Steps

1. Review generated files in `.brain/`
2. Edit `hippocampus/strategy.md` with product goals
3. Run `/brain-status` to check health
4. Run `/brain-task` to start using the Brain

---

**Created:** 2026-03-24 | **Agent Type:** Initializer
