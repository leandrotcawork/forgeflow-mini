---
name: brain-health
description: Unified health dashboard + consolidation cycle — merges brain-status and brain-consolidate into a single skill
---

# brain-health Skill — Dashboard + Consolidation

**Purpose:** Unified entry point for Brain health monitoring and knowledge consolidation. Default mode shows a live dashboard; `--consolidate` triggers the full consolidation cycle (episode processing, proposal review, escalation, weight decay, cleanup).

**Token Budget:** Dashboard 5k in / 3k out | Consolidation 15-25k in / 8k out

## Trigger

| Command | Mode | Description |
|---|---|---|
| `/brain-health` | Dashboard | Read-only health report with metrics and recommendations |
| `/brain-health --consolidate` | Consolidation | Full consolidation cycle with approval gates |

## Mode 1: Dashboard (default)

### Step 1: Gather Metrics

Collect from:
- **brain.db** — sinapse count per region, average weight per region, staleness (`updated_at`)
- **brain-project-state.json** — circuit breaker state, subagent usage, avg task tokens
- **activity.md** — tasks since last consolidation checkpoint
- **working-memory/** — pending episodes, pending proposals, escalation proposals

### Step 2: Generate Report

Use `templates/health-report.md` to produce a formatted dashboard. Fill all template variables from Step 1 data.

Output the report directly to the terminal.

### Step 3: Recommendations

Flag automatically:
- **Stale regions** — any region with no update in >30 days
- **Pending episodes** — if >5 unprocessed episodes, recommend `/brain-health --consolidate`
- **Circuit breaker open** — warn and show cooldown timer
- **Low-weight sinapses** — any sinapse with weight < 0.2 (candidate for review or archival)
- **Orphaned sinapses** — sinapses in brain.db with no backlinks

### Step 4: Visualization (optional)

Regenerate `.brain/brain-graph.html`:
```bash
python scripts/generate_viz.py .brain
```

## Mode 2: Consolidation (`--consolidate`)

Follow `references/consolidation-pipeline.md` for the full 7-step cycle:

1. **Collect Episodes** — gather and sort episode files from working-memory
2. **Generate Proposals** — create sinapse update proposals from episodes
3. **Review Existing** — present ALL proposals (lesson-updates + sinapse-updates) for developer approval (y/n/m)
4. **Escalation Check** — patterns with 3+ occurrences across sinapses are candidates for convention promotion to hippocampus
5. **Apply Approved** — write approved changes to cortex files + brain.db + rebuild FTS5. Hippocampus writes trigger hippocampus-guard (this is expected)
6. **Weight Maintenance** — apply decay rules per `references/weight-decay-rules.md`
7. **Clean Working Memory** — archive processed files, remove applied proposals, update consolidation checkpoint in activity.md

Each step that modifies knowledge requires explicit developer approval via `AskUserQuestion`.

## Rules

| Rule | Rationale |
|---|---|
| NEVER auto-update sinapses | All changes require developer approval |
| Present ALL proposals before applying | Developer reviews the full batch, not one at a time blindly |
| Weight decay runs AFTER review | Decay only applies once approved updates are committed |
| Archive, don't delete | Working-memory files move to `completed-contexts/`, never deleted |
| Update BOTH file and DB | Sinapse markdown + brain.db row + FTS5 rebuild on every approved change |

## CRITICAL: Hippocampus Guard

During consolidation, any write to `.brain/hippocampus/` (convention promotions, escalation approvals) will trigger the hippocampus-guard hook. This is **expected behavior** — the guard will prompt for confirmation. Do not treat guard prompts as errors.

## Integration

**Inputs:** `episode-*.md`, `task-completion-*.md`, `sinapse-updates-*.md` (working-memory), `brain.db` + FTS5, `conventions.md`
**Outputs:** Dashboard report, updated sinapses (file + DB), `.brain/progress/brain-health.md`, consolidation checkpoint, `brain-graph.html`
