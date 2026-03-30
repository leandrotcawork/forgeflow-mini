---
name: brain-consolidate
description: Consolidation cycle — Process episode files into approval-gated sinapse updates, review sinapse proposals, detect recurring patterns for convention promotion, generate health report, update weights. Always propose — never auto-update without developer approval.
---

# brain-consolidate Skill — Consolidation Cycle

## Pipeline Position

```
brain-dev → brain-map → brain-task (Steps 1-3) → brain-document → brain-consolidate
                                                                        ↑ you are here
```

**Purpose:** Process episode files from working-memory into sinapse update proposals. Review all proposals (lesson-updates from episodes + sinapse-updates from brain-document) with developer approval gates. Detect recurring patterns across all sinapses for convention promotion. Generate health report. Update weights. Always propose — never auto-update without developer approval.

**Token Budget:** 15-25k in / 8k out (varies by proposal count)

**Trigger:**
- Developer invokes: `/brain-consolidate`
- Auto-suggested by brain-task Step 3 after 5+ completed tasks since last consolidation
- Recommended after major feature milestones

---

## Workflow

### Step 0: Process episodes → Generate Lesson Proposals

Read all `episode-*.md` files from `.brain/working-memory/`. Cross-reference with `task-completion-*.md` records for outcome context.

**0a: Find target sinapses for each episode**

For each episode file:
1. Read `sinapses_loaded` from the episode metadata
2. If `sinapses_loaded` is populated → use those as target sinapses
3. If `sinapses_loaded` is empty (task failed before context load, or new project) → fallback chain:
   - FTS5 search by episode tags: `SELECT id, path FROM sinapses_fts WHERE sinapses_fts MATCH '{episode_tags}'`
   - Domain-based fallback: match episode domain to `.brain/cortex/{domain}/` sinapses
   - Create new sinapse if zero matches (propose to developer before creating)

**0b: Missing-file recovery**

For each target sinapse: if brain.db has a `sinapses` row but the markdown file does not exist on disk → recreate the markdown file from the `sinapses.content` column, then proceed normally. Log: `"Recovered missing sinapse file: {path} (recreated from brain.db)"`

**0c: Dedup check**

Before proposing a lesson-update for a target sinapse, read the sinapse's existing `## Lessons Learned` section. If a bullet with matching tags AND similar description already exists → skip that proposal (don't duplicate). Compare by:
- Exact tag overlap (>80% shared tags)
- Description similarity (substring match or key-phrase overlap)

Log skipped proposals: `"Dedup: skipped lesson for {sinapse} — existing bullet already covers this pattern"`

**0d: Generate lesson-update proposals**

For each non-duplicate episode → target sinapse pair:
- Draft a new `## Lessons Learned` bullet with: tags, description, source episode ID, date
- Write proposal to `.brain/working-memory/lesson-update-PROPOSAL-{sinapse_id}-{timestamp}.md`

Output: List of lesson-update proposals generated, grouped by sinapse.

---

### Step 1: Review All Proposals

Present ALL proposals together as a single **numbered list** for developer review:
- **Lesson-update proposals** (from Step 0 — episode-derived)
- **Sinapse-update proposals** (from brain-document — `sinapse-updates-*.md` files)

```
LESSON UPDATES (from episodes):
  [1] .brain/cortex/backend/api.md — ## Lessons Learned
      + - [auth] Tenant isolation must be checked before any DB query (episode-20260328-001)
      Approve [y/n/m]:

  [2] .brain/sinapses/outbox-event-flow.md — ## Lessons Learned
      + - [outbox] Retry with exponential backoff; linear retry causes cascade (episode-20260328-002)
      Approve [y/n/m]:

SINAPSE UPDATES (from brain-document):
  [3] .brain/cortex/backend/api.md
      Status: modify
      Diff:
        - Pattern: handlers should validate input immediately
        + Pattern: handlers must validate input immediately; fail fast on auth/tenancy
      Approve [y/n/m]:

  [4] .brain/cortex/frontend/state.md
      Status: add section
      + ### Error Boundaries
      + Every route-level component wraps children in ErrorBoundary
      Approve [y/n/m]:
```

Developer choices per proposal:
- **y** = approve
- **n** = reject (discard proposal)
- **m** = modify (developer edits and re-submits)

**On approval — apply changes to BOTH file and DB:**
1. Update the sinapse markdown file on disk (append bullet to `## Lessons Learned` or apply diff)
2. `UPDATE sinapses SET content = ?, updated_at = ? WHERE id = ?` in brain.db
3. Rebuild FTS5: `INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild');`
4. Increment sinapse weight: `UPDATE sinapses SET weight = weight + 0.02 WHERE id = ?`

Track tallies: N approved / N rejected / N modified.

---

### Step 2: Escalation Check

Detect recurring patterns that should be promoted to project conventions.

**2a: Count `## Lessons Learned` bullets across ALL sinapses**

This counts ALL existing bullets accumulated across all consolidation runs (not just the current batch). Scan every sinapse markdown file for `## Lessons Learned` sections and extract bullets with their tags.

Group by domain + tag pattern:
```
backend + [auth]: 4 bullets across 3 sinapses
backend + [outbox]: 2 bullets across 2 sinapses
cross-domain + [tenant]: 3 bullets across 3 sinapses  ← ESCALATION CANDIDATE
```

**2b: FTS5 semantic grouping**

Supplement exact tag grouping with FTS5 semantic matching to catch related bullets with different tags but the same underlying pattern:

```sql
SELECT s.id, s.path, s.domain
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{pattern_keywords}'
  AND s.id NOT IN ({already_grouped_ids})
ORDER BY rank DESC
LIMIT 5
```

**Fallback:** If FTS5 tables don't exist, use standard domain+tags grouping only.

**2c: Escalation threshold — 3+ matching bullets**

When 3 or more `## Lessons Learned` bullets share the same domain+tag pattern (including FTS5-discovered matches):

1. Check `.brain/working-memory/escalation-PROPOSAL-*.md` — if a proposal for this pattern already exists, skip
2. Check `.brain/hippocampus/conventions.md` — if pattern is already documented:
   - Output: `"Pattern [name] already exists in conventions.md. No escalation needed."`
3. Otherwise, generate escalation proposal:
   - Read all matching bullets and their source sinapses
   - Extract the common rule/pattern
   - Draft convention text (matching conventions.md style)
   - Write to: `.brain/working-memory/escalation-PROPOSAL-{timestamp}.md`
   - Present to developer:
     ```
     ESCALATION PROPOSAL: [pattern name]
     Domain: [domain]
     Source: [N] bullets across [M] sinapses
     Review: .brain/working-memory/escalation-PROPOSAL-{timestamp}.md
     Actions: approve → conventions.md | reject → discard | modify → edit
     ```

4. On approval: append convention text to `.brain/hippocampus/conventions.md`, delete proposal file

---

### Step 3: Health Report

Write `.brain/progress/brain-health.md` (generated report, never manually edited):

```markdown
---
generated_at: [ISO 8601]
consolidation_cycle: [N]
---

# Brain Health Report — Consolidation Cycle [N]

**Generated:** [timestamp]
**Consolidation triggered by:** [5 tasks completed / developer invoked]

## Summary
- **Sinapse updates proposed:** [N] (approved: Y / rejected: R / modified: M)
- **Lesson-update proposals:** [N] (from episodes)
- **Escalation candidates surfaced:** [N]
- **Working memory records cleared:** [N]
- **Brain.db weights updated:** [N] sinapses adjusted

---

## Sinapse Staleness by Region

| Region | Total Sinapses | Updated This Cycle | Stale (>30d) | Last Updated |
|---|---|---|---|---|
| .brain/cortex/backend | 5 | 2 | 0 | [date] |
| .brain/cortex/frontend | 4 | 1 | 1 | [date] |
| .brain/cortex/database | 3 | 0 | 2 | [date] |
| .brain/cortex/infra | 2 | 0 | 2 | [date] |
| .brain/sinapses/ (cross-domain) | 6 | 1 | 2 | [date] |
| **TOTAL** | **20** | **4** | **7** | — |

---

## Episode Summary

| Domain | Episodes Processed | Lessons Proposed | Lessons Approved | Dedup Skipped |
|---|---|---|---|---|
| backend | 3 | 2 | 2 | 1 |
| frontend | 1 | 1 | 0 | 0 |
| cross-domain | 2 | 2 | 1 | 0 |
| **TOTAL** | **6** | **5** | **3** | **1** |

---

## Pending Escalations

| Proposal | Source Bullets | Pattern | Status |
|---|---|---|---|
| escalation-PROPOSAL-{ts}.md | 3 bullets across 3 sinapses | "Tenant isolation" | Awaiting review |

**Action:** Review `.brain/working-memory/escalation-PROPOSAL-*.md` files.

---

## Coverage Gaps

| Gap | Severity | Recommendation |
|---|---|---|
| .brain/cortex/infra last updated >90 days | high | Consider infra audit task |
| No sinapses for observability patterns | medium | Add after next logging feature |

---

## Weight Distribution (Top 10 Heaviest Sinapses)

| Rank | Sinapse | Weight | Last Accessed | Usage Count |
|---|---|---|---|---|
| 1 | .brain/cortex/backend/index.md | 0.92 | [date] | 47 |
| ... | ... | ... | ... | ... |

---

## Orphaned Sinapses

| Sinapse | Weight | Last Accessed | Backlinks | Recommendation |
|---|---|---|---|---|
| .brain/cortex/infra/deploy.md | 0.31 | [date] | 0 | Review for archival |

---

## Next Consolidation

- **Suggested trigger:** After 5 more completed tasks
- **Action items:**
  - [ ] Review pending escalation proposals
  - [ ] Address coverage gaps
  - [ ] Archive orphaned sinapses
```

---

### Step 4: Weight Updates + Cleanup

**4a: Weight adjustments**

For each approved sinapse update (already incremented in Step 1):
- Verify weight += 0.02 was applied

For each unused sinapse (not accessed since last consolidation):
- Apply decay: weight -= 0.005 per day since last access
- Minimum weight floor: 0.1 (weight cannot go below this)

```sql
UPDATE sinapses
SET weight = MAX(0.1, weight - (0.005 * days_since_last_access))
WHERE last_accessed < date('now', '-7 days');
```

**4a.2: Usage-based weight bonus (Hebbian learning, NEW in v1.2.0)**

Sinapses that contributed to successful tasks since last consolidation get an automatic weight bonus.

**Process:**

1. Read all `task-completion-*.md` files in `.brain/working-memory/` only (NOT archived ones — they were already counted in previous cycles)
2. Filter to `status: success` only
3. Filter to `created_at > last consolidation checkpoint` (read the latest `<!-- consolidation-checkpoint: ... -->` marker from `.brain/progress/activity.md`)
4. For each successful task-completion, extract the `sinapses_loaded` array
5. Count occurrences: how many successful tasks used each sinapse
6. Apply bonus:

```sql
UPDATE sinapses
SET weight = MIN(1.0, weight + (0.01 * {successful_use_count}))
WHERE id = '{sinapse_id}';
```

**Guard against double-counting:** Only task-completion files in `.brain/working-memory/` created after the last consolidation checkpoint are counted. Archived completions (in `completed-contexts/`) are skipped — they were already processed in previous consolidation cycles. Step 5a archives these files after processing, ensuring they aren't counted again.

**Weight change rules (complete):**

| Trigger | Change | Cap |
|---|---|---|
| Sinapse used in successful task | `+0.01` per successful use | max 1.0 |
| Sinapse update approved by developer | `+0.02` per approval (Step 1) | max 1.0 |
| Sinapse unused for 7+ days | `-0.005` per day (Step 4a) | min 0.1 |

**Why +0.01:** Usage bonus is smaller than approval bonus (+0.02) — human validation is worth more than automatic tracking. A sinapse used in 5 successful tasks gains +0.05, equivalent to 2.5 manual approvals.

**Log output:** Include usage bonus summary in the health report:
```
Hebbian learning: {N} sinapses received usage bonuses (avg +{X}, max +{Y})
```

**4b: Consultation artifact TTL**

Scan `.brain/working-memory/` for `consult-*.json` files:
- Delete any with timestamp older than 7 days
- If > 50 remain after TTL cleanup, prune oldest until 50
- Output: `"Consultation artifacts cleaned: {N} expired, {M} pruned"`

**4c: Episode TTL**

Scan `.brain/working-memory/` for `episode-*.md` files:
- Episodes older than 30 days that have been processed → archive to `.brain/progress/completed-contexts/`
- Unprocessed episodes older than 30 days → flag for developer review before archiving

**4d: Straggler archival**

Check `.brain/working-memory/` for leftover files that brain-task should have archived:
- `context-packet-*.md`
- `dev-context-*.md`
- `implementation-plan-*.md`

If found: move to `.brain/progress/completed-contexts/{task-id}-{original-name}.md`. Log: `"Straggler recovered: {filename} — brain-task archival may not have completed for this task"`

---

### Step 5: Clear Working Memory

**5a: Archive completion records**

Move processed `task-completion-*.md` and processed `episode-*.md` files to `.brain/progress/completed-contexts/`.

**5b: Reset counters**

- Set `tasks_since_last_consolidation` to 0
- Increment `total_consolidation_cycles`

**5c: Write consolidation checkpoint**

Append a checkpoint marker to `.brain/progress/activity.md` that `brain-post-task.js` uses to count tasks since last consolidation:

```
<!-- consolidation-checkpoint: {ISO8601} cycle-{N} -->
```

This HTML comment marker is what `brain-post-task.js` scans for when computing `consolidation_needed`. Without this marker, `consolidation_needed` stays true forever after 5 tasks.

Do NOT append task rows to activity.md — brain-task already wrote those during task execution.

**5d: Verify clean state**

After archival, `.brain/working-memory/` should contain only:
- Unprocessed items from concurrent tasks (if any)
- Active `consult-*.json` files within TTL
- Pending `escalation-PROPOSAL-*.md` files awaiting review

---

## Output Summary

After consolidation completes, present to developer:

```
CONSOLIDATION CYCLE [N] COMPLETE

Episodes processed: [N]
Lesson-update proposals: [P] generated, [A] approved, [S] skipped (dedup)
Sinapse-update proposals: [P] proposed, [A] approved, [R] rejected, [M] modified

Escalation proposals: [N] surfaced
  - [A] approved → conventions.md
  - [P] pending → .brain/working-memory/escalation-PROPOSAL-*.md
  - [D] dismissed

Context archived: [N] files → .brain/progress/completed-contexts/
Working memory: [N] records cleared
Brain.db: [N] sinapses reweighted, FTS5 rebuilt
Health report: .brain/progress/brain-health.md

Next consolidation suggested after 5 more completed tasks

Action items:
  [ ] Review [N] pending escalation proposals (if any)
  [ ] Address [N] coverage gaps (if any)
  [ ] Archive or update [N] orphaned sinapses (if any)
```

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Auto-updating sinapses without approval | Violates developer trust model — can introduce errors silently | Always propose, never auto-update. Wait for explicit y/n/m. |
| Updating markdown file but not brain.db | File and DB drift out of sync, FTS5 returns stale results | Always update BOTH: sinapse file + `UPDATE sinapses SET content` + rebuild `sinapses_fts` |
| Clearing working-memory without archiving | Loses history of completed tasks and episodes | Archive to `.brain/progress/completed-contexts/` before clearing |
| Duplicating existing lessons | Bloats `## Lessons Learned` sections with redundant bullets | Always run dedup check (Step 0c) before proposing |
| Counting only current-batch bullets for escalation | Misses patterns that accumulated over multiple consolidation cycles | Count ALL existing `## Lessons Learned` bullets across all sinapses (Step 2a) |
| Writing task rows to activity.md | Creates duplicate entries — brain-task already writes task rows | Only write the consolidation checkpoint marker (Step 5c) |
| Ignoring empty sinapses_loaded | Episodes from failed tasks or new projects get zero proposals | Use FTS5 → domain → new-sinapse fallback chain (Step 0a) |
| Skipping missing-file recovery | Sinapse exists in DB but file is gone — proposals fail silently | Recreate from `sinapses.content` column (Step 0b) |

---

## Failure Scenarios

| Scenario | Action |
|---|---|
| No completed tasks or episodes since last consolidation | Output: "No work to consolidate." Exit gracefully. |
| Working-memory directory is empty | Proceed with escalation check (Step 2) and weight updates (Step 4) only. |
| Episode has empty `sinapses_loaded` | Fallback chain: FTS5 by tags → domain match → propose new sinapse (Step 0a). |
| Target sinapse file missing from disk | Recreate from `sinapses.content` in brain.db (Step 0b). If DB row also missing, skip with warning. |
| Escalation proposal conflicts with existing convention | Flag in proposal file. Developer decides: approve (override) or reject. |
| Developer approves contradictory updates to same sinapse | Merge approved changes into single update. Clarify rationale to developer. |
| brain.db is corrupted or missing | Output: "Cannot access brain.db. Run `python scripts/build_brain_db.py` to rebuild." |
| FTS5 tables don't exist | Fall back to domain+tags grouping for escalation. Log warning. |
| Concurrent task running during consolidation | Skip any locked files. Process only completed, unlocked records. |

---

## Workflow Integration

**What triggers brain-consolidate:**
- Developer manually invokes `/brain-consolidate`
- brain-task Step 3 suggests it after 5+ completed tasks (via `tasks_since_last_consolidation` counter)
- Developer request after major milestones

**What brain-consolidate depends on:**
- `episode-*.md` files in `.brain/working-memory/` (written by brain-task Step 3)
- `task-completion-*.md` files in `.brain/working-memory/` (written by brain-task)
- `sinapse-updates-*.md` files in `.brain/working-memory/` (written by brain-document)
- `brain.db` with `sinapses` table and `sinapses_fts` FTS5 index
- `.brain/hippocampus/conventions.md` (for escalation dedup)

**What depends on brain-consolidate output:**
- `.brain/progress/brain-health.md` — consumed by brain-status dashboard
- `.brain/progress/activity.md` — consolidation checkpoint marker
- Updated sinapse files + brain.db — consumed by brain-map in future tasks
- `.brain/hippocampus/conventions.md` — if escalation approved

**Pipeline diagram:**
```
brain-dev → brain-map → brain-task (Steps 1-3) → brain-document → brain-consolidate
                                                                        │
                                          ┌─────────────────────────────┤
                                          ▼                             ▼
                                   sinapse updates              escalation proposals
                                   (file + DB + FTS5)           (→ conventions.md)
```

**Token budget:** ~15-25k per consolidation (depends on proposal count and escalation complexity)
