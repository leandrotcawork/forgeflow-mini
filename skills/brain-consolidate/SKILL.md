---
name: brain-consolidate
description: Consolidation cycle — Batch process completed tasks, propose sinapse updates, escalate lessons
---

# brain-consolidate Skill — Consolidation Cycle

**Purpose:** Batch process all completed tasks since last consolidation. Review proposed sinapse updates, surface escalation candidates, generate health report, update weights in brain.db. Always propose — never auto-update without developer approval.

**Token Budget:** 15k in / 8k out

**Trigger:**
- Developer invokes: `/brain-consolidate`
- Auto-suggested after 5 completed tasks
- Recommended after major feature milestones

## Workflow

### Step 1: Inventory Completed Work

Scan `working-memory/`:
- List all `task-XXXXX.md` files with status = "completed"
- Extract: task ID, description, touched files (from git diff), outcome (success/fail), sinapses loaded, token usage
- Group by cortex region touched (backend, frontend, database, infra, cross-domain)

Output: Working inventory in memory (not persisted yet).

### Step 2: Collect Sinapse Update Proposals

For each completed task:
- Check if `working-memory/sinapse-updates-TASK-ID.md` exists
- If yes: read the proposed unified diffs, extract which sinapses would be updated
- Group all proposals by cortex region and sinapse ID
- Count: total proposals, by region, by action type (add/modify/delete)

Output: List of all proposed updates, grouped by region.

### Step 3: Batch Review Display

For developer approval, present all proposed updates as a **numbered list with unified diffs**:

```
CORTEX REGION: backend
  [1] cortex/backend/api.md
      Status: modify
      Diff:
        - Pattern: handlers should validate input immediately
        + Pattern: handlers must validate input immediately; fail fast on auth/tenancy

      Approve [y/n/m for modify]:

  [2] cortex/backend/index.md
      Status: add
      New section:
        + ### Observability
        + Every handler logs: trace_id, action, result, duration_ms

      Approve [y/n/m]:

CROSS-DOMAIN
  [3] sinapses/outbox-event-flow.md
      Status: modify
      [diff shown]
      Approve [y/n/m]:

...
```

Developer choices per update:
- **y** = approve this update
- **n** = reject this update (discard proposal)
- **m** = modify (developer edits and re-submits, or explicit changes marked)

Track tallies: N approved / N rejected / N modified.

### Step 4: Escalation Check

Run pattern escalation query on brain.db:

```sql
SELECT domain, tag, COUNT(*) as lesson_count, array_agg(id) as lesson_ids
FROM lessons
WHERE escalated = 0
GROUP BY domain, tag
HAVING COUNT(*) >= 3
ORDER BY lesson_count DESC
```

For each escalation candidate:
- Read all 3+ matching lessons from disk (cortex/*/lessons/ or lessons/cross-domain/)
- Extract common pattern/rule
- Read hippocampus/conventions.md — check if this pattern is already documented
- If NOT already documented:
  - Draft convention text (same style as existing conventions.md entries)
  - Write to: `lessons/inbox/escalation-PROPOSAL-XXXXXX.md`
  - Output to developer: "⚠ Escalation detected: [N] [domain] lessons on [pattern name]. Review: lessons/inbox/escalation-PROPOSAL-XXXXXX.md"
- If already documented:
  - Mark those lessons as escalated=1 in brain.db
  - Output: "✓ [N] [domain] lessons match existing convention [name]. Marked escalated."

### Step 5: Generate brain-health.md

Write `progress/brain-health.md` (generated report, never manually edited):

```markdown
---
generated_at: [ISO 8601]
consolidation_cycle: [N]
---

# Brain Health Report — Consolidation Cycle [N]

**Generated:** [timestamp]
**Consolidation triggered by:** [5 tasks completed / developer invoked]

## Summary
- **Sinapses proposed for update:** [N] (approved: Y / rejected: R / modified: M)
- **Escalation candidates surfaced:** [N]
- **Working memory records cleared:** [N]
- **Brain.db weights updated:** [N] sinapses adjusted

---

## Sinapse Staleness by Region

| Region | Total Sinapses | Updated This Cycle | Stale (>30d) | Last Updated |
|---|---|---|---|---|
| cortex/backend | 5 | 2 | 0 | [latest date] |
| cortex/frontend | 4 | 1 | 1 | [latest date] |
| cortex/database | 3 | 0 | 2 | [latest date] |
| cortex/infra | 2 | 0 | 2 | [latest date] |
| sinapses/ (cross-domain) | 6 | 1 | 2 | [latest date] |
| **TOTAL** | **20** | **4** | **7** | — |

---

## Lesson Density by Domain

| Domain | Total Lessons | Kept | Archived | Escalation Candidates |
|---|---|---|---|---|
| backend | 5 | 5 | 0 | 0 |
| frontend | 5 | 5 | 0 | 0 |
| cross-domain | 3 | 3 | 0 | 1 ← PENDING APPROVAL |
| **TOTAL** | **13** | **13** | **0** | **1** |

---

## Pending Escalations

| Proposal | Source Lessons | Pattern | Status |
|---|---|---|---|
| escalation-PROPOSAL-001.md | lesson-0001, 0002, 0004 | "Tenant isolation failure modes" | ⏳ Awaiting developer review |

**Action:** Review lessons/inbox/escalation-PROPOSAL-*.md files. If approved, move convention text to hippocampus/conventions.md.

---

## Coverage Gaps

| Gap | Severity | Recommendation |
|---|---|---|
| cortex/infra last updated >90 days ago | high | Consider infra audit task |
| No sinapses for observability patterns | medium | Add observability-cross-cutting.md after next logging feature |
| Frontend data-flow not updated since Phase 2 | medium | Review after SDK update |

---

## Weight Distribution (Top 10 Heaviest Sinapses)

| Rank | Sinapse | Current Weight | Last Accessed | Usage Count |
|---|---|---|---|---|
| 1 | cortex/backend/index.md | 0.92 | 2026-03-24 | 47 |
| 2 | cortex/backend/auth.md | 0.89 | 2026-03-24 | 43 |
| 3 | cortex/backend/outbox.md | 0.88 | 2026-03-23 | 41 |
| 4 | sinapses/tenant-isolation-flow.md | 0.84 | 2026-03-22 | 38 |
| 5 | cortex/frontend/index.md | 0.79 | 2026-03-24 | 35 |
| ... | ... | ... | ... | ... |
| 10 | cortex/database/schema.md | 0.61 | 2026-03-10 | 18 |

---

## Orphaned Sinapses

| Sinapse | Current Weight | Last Accessed | Backlink Count | Recommendation |
|---|---|---|---|---|
| cortex/infra/deploy.md | 0.31 | 2026-02-15 | 0 | Review for archival or update |
| sinapses/analytics-routing.md | 0.28 | 2026-01-20 | 0 | Likely outdated; review or archive |

**Recommendation:** If these sinapses are no longer relevant, move to lessons/archived/ or document when they'll be needed again.

---

## Next Consolidation

- **Suggested trigger:** After [5 more completed tasks]
- **Target date:** [approximate date 5 tasks from now]
- **Health action items:**
  - [ ] Review and approve/reject all [N] proposed sinapse updates
  - [ ] Review [N] pending escalation proposal(s)
  - [ ] Address [N] coverage gaps (if any)
  - [ ] Archive or update [N] orphaned sinapses (if any)
```

### Step 6: Weight Updates in brain.db

For each approved sinapse update:
- Set weight += 0.02 (indicates recent, successful refinement)
- Update last_accessed = now

For each unused sinapse (not accessed in past N days):
- Apply decay: weight -= 0.005 per day since last access (e.g., 30 days unused = 0.15 point decay)
- Note: weight cannot go below 0.1

For each escalated lesson:
- Set escalated = 1 in lessons table
- Do NOT update sinapse weights (lesson escalation is orthogonal to sinapse usage)

### Step 6.5: Archive Context Files (Learning Loop)

**Before clearing working-memory, preserve completed context files for pattern analysis:**

For each completed task:

1. **Move context files to permanent archive:**
   ```bash
   mv working-memory/[task-id]-codex-context.md \
      progress/completed-contexts/[task-id]-codex-context.md

   mv working-memory/[task-id]-opus-context.md \
      progress/completed-contexts/[task-id]-opus-context.md

   mv working-memory/[task-id]-completion-record.md \
      progress/completed-contexts/[task-id]-completion-record.md
   ```

2. **Create outcome analysis file:**
   ```
   Create: progress/completed-contexts/[task-id]-OUTCOME.md

   ---
   task_id: [uuid]
   status: success | failed
   root_cause: [if failed]
   context_size: [N lines]
   sinapses_loaded: [N]
   created_at: [ISO8601]
   ---

   # Task [task-id] — Outcome Analysis

   ## Result
   [Brief outcome: successful / bug found / failed]

   ## What Context Had
   - Sinapses: [N] (domains: backend, frontend)
   - Lessons: [N] (domains: backend, cross-domain)
   - Code examples: [N] patterns shown

   ## What Worked Well
   - [Pattern A was helpful]
   - [Pattern B prevented mistake X]

   ## What Was Missing (if any)
   - [Missing context: should have loaded lesson-00NN]
   - [Missing pattern: need new sinapse for cortex/backend]

   ## For Future Improvements
   - Create lesson-XXXX.md: [pattern found]
   - Update sinapse-YYYY.md: [became stale]
   - Add example code: [new pattern]
   ```

3. **Output archival status:**
   ```
   Archived [N] context files to progress/completed-contexts/:
     - [N] codex-context.md files
     - [N] opus-context.md files
     - [N] completion-record.md files
     - [N] OUTCOME.md analysis files

   These files form permanent learning record for pattern analysis.
   ```

---

### Step 7: Clear Working Memory

After developer approves or explicitly skips:
1. For each completed task:
   - Move task record to `progress/activity.md` (append as log entry)
   - Delete `working-memory/task-XXXXX.md`
   - Delete `working-memory/sinapse-updates-XXXXX.md` (proposal consumed)
   - Delete `working-memory/context-packet-XXXXX.md` (archived at Step 6.5)
2. Commit all working-memory deletions with message: "chore: consolidation cycle [N] — clear working memory"
3. Output: "✓ Working memory cleared. [N] records archived to progress/activity.md. Context files in progress/completed-contexts/."

## Output Summary

After consolidation completes, output to developer:

```
✅ CONSOLIDATION CYCLE [N] COMPLETE

Sinapse updates: [Y] approved / [R] rejected / [M] modified
Escalation proposals: [N] surfaced
  - [A] approved → moving to hippocampus/conventions.md
  - [P] pending review → in lessons/inbox/escalation-*.md
  - [D] dismissed → discarded

Context files archived: [N] task contexts → progress/completed-contexts/
  - Codex contexts: [N]
  - Opus contexts: [N]
  - Outcome analysis files: [N]

Working memory: [N] records cleared
Brain.db: [N] sinapses reweighted
Health report: progress/brain-health.md (generated)

Next consolidation suggested after [5 more completed tasks] (approx [date])

Action items:
  [ ] Review [N] pending escalation proposals (if any)
  [ ] Address [N] coverage gaps (if any)
  [ ] Archive or update [N] orphaned sinapses (if any)
  [ ] Analyze OUTCOME.md files in progress/completed-contexts/ for patterns
```

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Auto-updating sinapses without approval | Violates developer trust, can introduce errors | Always propose, never auto-update. Wait for approval. |
| Clearing working-memory without archiving | Loses history of completed tasks | Archive to progress/activity.md before deleting |
| Ignoring escalation candidates | Misses opportunities to promote lessons to conventions | Always surface 3+ same-pattern lessons |
| Updating weights without clear rationale | Makes ranking opaque | Only adjust weights on task completion (success ±) or decay on disuse |
| Generating brain-health.md at wrong frequency | Staleness report becomes stale | Generate fresh on every consolidation cycle |

## Failure Scenarios

| Scenario | Action |
|---|---|
| No completed tasks since last consolidation | Output: "No work to consolidate." Exit gracefully. |
| Working-memory directory is empty | Proceed with escalation check and weight updates only. |
| Escalation proposal conflicts with existing convention | Flag in escalation file. Let developer decide: approve (override) or reject. |
| Developer approves contradictory updates to same sinapse | Merge the approvals into a single update, or split into subtasks. Clarify rationale. |
| brain.db is corrupted or missing | Output error: "Cannot update brain.db. Run `python build_brain_db.py` to rebuild." |

## Integration with Task Workflow

Consolidation cycle is **post-task**, never blocking:
1. Task completes → brain-document proposes updates → developer approves/rejects
2. Multiple tasks accumulate proposals in working-memory/
3. After 5 tasks OR developer request → trigger `/brain-consolidate`
4. Consolidation reviews all proposals, surfaces escalations, updates weights
5. Developer approves consolidation results
6. working-memory/ cleared, brain-health.md generated, activity.md updated

**Token budget:** ~15–25k per consolidation (depends on proposal count and escalation complexity)
