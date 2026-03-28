# Auto-Lesson Capture & Brain-Inspired Knowledge Integration

> **Goal:** Make the brain learn automatically. Failures and struggles are captured as temporary episodes, then consolidated into permanent sinapse knowledge — exactly how the human brain converts episodic memory into semantic memory. No manual `/brain-lesson` invocation. Lessons stop existing as separate entities.

---

## Design Decisions (from brainstorming + Codex review consensus)

| Decision | Choice | Why |
|----------|--------|-----|
| When to capture | Failure + success-after-struggle (adaptive) | Struggle produces the richest insights; clean success needs nothing |
| Where capture executes | brain-task writes episode as its FINAL step before reporting status back | Subagent lived through the failure — richest context. Episode must be written before the subagent returns to brain-dev. |
| Episode storage | File in `.brain/working-memory/` (temporary) | No DB needed for temporary data; brain-consolidate scans this directory |
| Knowledge destination | Merged INTO sinapses via approval-gated proposals (not auto-written) | Brain-inspired: episodic → semantic. Trust model preserved: developer approves all sinapse mutations. |
| brain-lesson skill | Deleted | Auto-capture + consolidation replaces it entirely |
| lessons table in brain.db | Removed (with migration script for existing data) | Knowledge lives in sinapses; no separate lesson storage needed |
| brain-consolidate role | Modernized: processes episodes into proposals, developer approves, then updates sinapses | Becomes the brain's "sleep consolidation" — extracts patterns, proposes knowledge updates |
| Approval model | Lesson updates are PROPOSED, not auto-written (Codex review consensus) | Consistent with brain-consolidate's trust contract: "never auto-update without developer approval" |

---

## The Neuroscience Model

| Human Brain | Our Plugin | What Happens |
|-------------|-----------|--------------|
| Episodic memory (hippocampus) | Episode file in working-memory/ | Raw failure captured with full context — temporary |
| Sleep consolidation (hippocampus → neocortex replay) | brain-consolidate Step 0 | Pattern extracted from episode, proposed as sinapse update |
| Semantic memory (neocortex) | Sinapse `## Lessons Learned` section | Generalized rule — permanent, loaded naturally by brain-map |
| Prediction error (surprise signal) | `strategy_rotation.attempts >= 2` | Struggle = surprise = stronger encoding (full episode vs draft) |
| Memory decay | Episode archived after consolidation | Temporary details discarded; only the rule survives in the sinapse |

---

## Section 1: Auto-Episode Capture in brain-task

### Capture Point

brain-task writes the episode as its **final step before reporting status back** to the orchestrator (brain-dev). This is critical: the subagent has full failure context at this point. Once it returns, the context is lost.

For inline execution (no subagent): the LLM has full conversation context, same principle applies.

### Trigger Logic

After brain-post-task.js runs, brain-task checks the output:

| Condition | Signal | Action | Token Cost |
|-----------|--------|--------|------------|
| Struggled and recovered | `strategy_rotation.attempts.length >= 2` | Write **full episode** (What Happened + What Worked) | ~800-1.5k |
| Simple failure | `status === 'failure'`, attempts < 2 | Write **draft episode** (What Happened only) | ~300-500 |
| Clean success | No rotation, no failure | Nothing | 0 |

### brain-post-task.js Changes

New fields in JSON output (zero LLM cost — pure script logic):

```json
{
  "lesson_trigger": "full" | "draft" | null,
  "lesson_context": {
    "error_summary": "from last entry in strategy_rotation.attempts array",
    "strategies_tried": ["strategy1", "strategy2"],
    "consecutive_failures": 2
  }
}
```

Note: `error_summary` is extracted from the `strategy_rotation.attempts` array in brain-state.json (each entry contains the strategy and its outcome). There is no `strategy_rotation.last_error` field — use the last element of the `attempts` array instead.

Detection logic (~20 lines of Node.js):

```javascript
function computeLessonTrigger(status, brainState) {
  var attempts = 0;
  if (brainState && brainState.strategy_rotation && brainState.strategy_rotation.attempts) {
    attempts = brainState.strategy_rotation.attempts.length || 0;
  }
  if (attempts >= 2) return 'full';
  if (status === 'failure') return 'draft';
  return null;
}
```

### sinapses_loaded Contract

brain-task passes loaded sinapse IDs to brain-post-task.js via the existing `--sinapses-loaded` flag (accepts a JSON array of IDs, e.g., `'["sinapse-auth-001", "sinapse-session-003"]'`). brain-post-task.js already parses this at line 120. The episode file includes these IDs so brain-consolidate knows which sinapses to target.

brain-task SKILL.md must explicitly document: "Pass the sinapse ID array (not just the count) via `--sinapses-loaded`."

---

## Section 2: Episode File Format

Temporary file in `.brain/working-memory/`. Exists only between capture and consolidation.

```yaml
---
type: episode
task_id: {task_id}
domain: {domain}
severity: low | medium | high | critical
trigger: failure | struggled | consultation | anti-pattern
tags: ["{tag1}", "{tag2}"]
sinapses_loaded: ["sinapse-auth-001", "sinapse-session-003"]
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{error message or test failure — verbatim from the task}

## What Worked
{the fix or correct approach — only present if trigger=struggled or consultation}

## Files Involved
{list of files}
```

### Key Fields

- `sinapses_loaded` — tells brain-consolidate exactly which sinapses are candidates for update. Falls back to FTS5 tag search if empty.
- `related_completion` — links to the task-completion record for additional context (null for consultation episodes).
- `trigger: struggled` episodes have both "What Happened" and "What Worked" — brain-consolidate can extract the Rule directly.
- `trigger: failure` episodes only have "What Happened" — brain-consolidate needs LLM reasoning to determine what to add.
- `trigger: consultation` — written by brain-consult when a correction is discovered.
- `trigger: anti-pattern` — written by brain-document when an anti-pattern is discovered.

### Naming

`episode-{task_id}.md` in `.brain/working-memory/`

### Edge Case: Empty sinapses_loaded

If a task fails before context loading completes (or in a new project with zero sinapses), `sinapses_loaded` will be empty. brain-consolidate Step 0 handles this:
1. FTS5 search using episode tags
2. If no match: domain-based fallback (`WHERE region LIKE '%{domain}%'`)
3. If still no match (new project, zero sinapses): create a NEW sinapse in `cortex/<domain>/` with the learned pattern

### TTL for Unclaimed Episodes

If brain-consolidate never runs (or episodes are not processed), the `sessionEnd` hook sweeps episode files older than 30 days. This prevents indefinite pile-up.

---

## Section 3: brain-consolidate Modernized Flow

Old: 7 steps + 3 sub-steps with circular FTS5 dependency, stale brain-task step references, model-specific context counts.

New: 6 clean steps, episode processing first, approval-gated, no circular dependencies.

| Step | Name | What It Does |
|------|------|-------------|
| 0 | Process episodes → generate lesson proposals | Read episode files, cross-ref task-completion records, generate lesson-update proposals (which sinapse to update, what text to add). Does NOT auto-write to sinapses. |
| 1 | Review all proposals | Present lesson-update proposals + sinapse-update proposals (from brain-document) together. Developer approves/rejects/modifies each. Apply approved changes: update sinapse files + brain.db `sinapses.content` + rebuild FTS5. |
| 2 | Escalation check | Count `## Lessons Learned` bullets across ALL sinapses for each domain+tag pattern. If 3+ bullets share the same pattern (accumulated across consolidation runs) → propose convention update to hippocampus/. FTS5 semantic grouping integrated here. |
| 3 | Health report | Write brain-health.md (staleness, density, coverage, weights) |
| 4 | Weight updates + cleanup | Sinapse weight adjustments (+0.02 for updated sinapses), consultation artifact TTL pruning, straggler archival, episode 30-day TTL sweep |
| 5 | Clear working memory | Archive task-completion + episode files, reset counters, write consolidation checkpoint |

### Step 0 Detail: Episode Processing (Proposal Generation)

```
For each episode-*.md in working-memory:
  1. Read the episode file
  2. Read linked task-completion-{task_id}.md for full context (if exists)
  3. Find target sinapse:
     a. Check sinapses_loaded — first candidate
     b. If empty or no match: FTS5 search using episode tags
     c. If still no match: domain-based fallback (region LIKE '%{domain}%')
     d. If zero sinapses exist for this domain: flag for new sinapse creation

  4. Dedup check: read target sinapse's existing ## Lessons Learned section.
     If a bullet with matching tags + similar description already exists:
       → Skip (don't add duplicate). Archive episode.
     Otherwise → proceed to proposal.

  5. Generate lesson-update proposal:
     - For struggled episodes (trigger=struggled): extract Rule from What Happened + What Worked
     - For failure/consultation/anti-pattern: use LLM reasoning to generate the Rule
     - Proposal format:

       Target: sinapse-auth-001
       Append to ## Lessons Learned:
       - **{date}:** {one-line rule}
         Severity: {severity} | Tags: {tags} | From: {task_id}

  6. If target is "new sinapse" (step 3d): generate a full sinapse creation proposal
     with naming, placement (cortex/<domain>/), and initial content.

  7. Collect all proposals for Step 1 review.
  8. Archive episode to .brain/progress/completed-contexts/
```

### Step 1 Detail: Approval Gate

```
Present ALL proposals to developer:

LESSON UPDATES (from Step 0):
  1. [sinapse-auth-001] Add lesson: "Always scope auth queries by tenant_id"
     Severity: critical | From: 2026-03-28-auth-token-fix
     → approve / reject / modify

  2. [NEW sinapse] Create sinapse-session-004: "Session token handling"
     Domain: backend | Content: {proposed content}
     → approve / reject / modify

SINAPSE UPDATES (from brain-document, existing flow):
  3. [sinapse-api-002] Update: add versioning section
     → approve / reject / modify

Developer approves → apply changes:
  - Update sinapse markdown file (append ## Lessons Learned bullet or create new file)
  - UPDATE sinapses SET content = ? WHERE id = ? (sync DB with file)
  - INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild')
  - weight += 0.02 for updated sinapses
```

This preserves brain-consolidate's trust contract: "Always propose — never auto-update without developer approval."

### Step 2 Detail: Escalation Check (Convention Proposals)

Counts `## Lessons Learned` bullets across all sinapses. This is the durable recurrence model — bullets persist in sinapses across consolidation runs.

```sql
-- Find sinapses that have 3+ lesson bullets with matching tags
-- (LLM reads the ## Lessons Learned sections and groups by tag pattern)
-- This replaces the old lessons table recurrence_count mechanism
```

If 3+ bullets with the same pattern found → generate escalation proposal for hippocampus/conventions.md update.

### Stale Reference Fixes in brain-consolidate

| Issue | Fix |
|-------|-----|
| "brain-task (Steps 1-6)" | → "brain-task (Steps 1-3)" |
| "brain-task Step 6 after 5+ tasks" | → "brain-task Step 3 after 5+ tasks" |
| "brain-task Step 5/6" everywhere | → "brain-task Step 3" |
| "Sonnet/Codex/Opus contexts" in summary | → Remove (model-specific context files don't exist) |
| activity.md contradiction | → brain-consolidate does NOT write to activity.md (brain-task already did) |
| FTS5 step 6.6 after step 4 | → Integrated into Step 2 (no circular dependency) |

### What "Update the Sinapse" Means (after approval)

The sinapse markdown file gets a section appended:

```markdown
## Lessons Learned

- **2026-03-28:** Always scope auth queries by tenant_id — shared connections leak across tenants.
  Severity: critical | Tags: auth, tenant | From: 2026-03-28-auth-token-fix
```

In brain.db (MUST update both file AND DB for FTS5 consistency):
- UPDATE `sinapses` SET `content` = {new file content} WHERE `id` = {sinapse_id}
- `weight += 0.02` (battle-tested sinapse = more important)
- `updated_at = now`
- Rebuild FTS5: `INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild')`

**Result:** Next time brain-map loads this sinapse via FTS5 + spreading activation, the lesson text is indexed and searchable. The AI sees the rule naturally.

### Missing File Recovery

If brain-consolidate tries to update a sinapse where the brain.db row exists but the markdown file was deleted:
- Recreate the markdown file from `sinapses.content` column in brain.db
- Then proceed with the update normally
- Log a warning: "Sinapse file missing, recreated from brain.db"

---

## Section 4: brain-consult Episode Capture

brain-consult doesn't run brain-task, so no automatic capture path exists. When a consultation reveals a correction or failure pattern (same conditions as current Step 6c), brain-consult writes an episode file directly:

```yaml
---
type: episode
task_id: consult-{timestamp}
domain: {domain}
severity: {estimated}
trigger: consultation
tags: ["{extracted from Q&A}"]
sinapses_loaded: ["{sinapse IDs used in answer}"]
related_completion: null
created_at: {ISO8601}
---

## What Happened
{what the developer believed or was doing wrong}

## What Worked
{the correct answer from the consultation}

## Files Involved
{if any files were discussed}
```

Token cost: ~300-400 tokens. No extra LLM reasoning — brain-consult already reasoned about the answer.

---

## Section 5: brain-document Episode Capture

When brain-document discovers an anti-pattern during sinapse proposal work, instead of routing to `/brain-lesson`, it writes an episode file:

```yaml
---
type: episode
task_id: document-{task_id}
domain: {domain}
severity: {severity}
trigger: anti-pattern
tags: ["{pattern tags}"]
sinapses_loaded: ["{sinapses being documented}"]
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{the anti-pattern discovered}

## What Worked
{the correct pattern, if known}
```

---

## Section 6: Data Migration

### Migration script: `scripts/brain-migrate-lessons.js`

For existing projects with lesson files and a populated `lessons` table:

```
1. Query brain.db: SELECT id, title, domain, tags, severity, parent_synapse,
   confidence, recurrence_count FROM lessons WHERE status IN ('active', 'promoted')
2. For each lesson:
   a. If parent_synapse exists → target that sinapse
   b. Else: FTS5 search by domain + tags → find best matching sinapse
   c. Else: create new sinapse in cortex/<domain>/
3. Read the lesson markdown file → extract ## Rule section
4. Append to target sinapse's ## Lessons Learned section
5. Update sinapses.content in brain.db
6. After all lessons migrated: DROP lessons table, DROP lessons_fts
7. Delete lesson directories
8. Rebuild FTS5 index
```

Run as: `node scripts/brain-migrate-lessons.js --brain-path .brain/`

This script runs once during upgrade from v0.9.x to v0.10.0. brain-init's `--upgrade` flag should invoke it.

### Draft/archived lessons

Lessons with `status: draft` (unreviewed, confidence 0.3): migrate only if `recurrence_count >= 2` (seen multiple times). Otherwise discard — they were never validated.

Lessons with `status: archived` or `status: superseded`: do not migrate. They were explicitly retired.

---

## Section 7: What Gets Removed

### Skill deleted
- `skills/brain-lesson/SKILL.md` — entire skill and directory

### Directories removed from brain-init scaffold
- `.brain/cortex/<domain>/lessons/` (per domain)
- `.brain/lessons/inbox/`
- `.brain/lessons/cross-domain/`
- `.brain/lessons/archived/`

### brain.db schema changes
- DROP `lessons` table (22 columns, 4 indexes) — after migration
- DROP `lessons_fts` FTS5 table — after migration
- Update `build_brain_db.py` to not process lesson files

### SQL queries removed
- brain-map: `SELECT id, title, severity, tags FROM lessons WHERE domain = ? LIMIT 3`
- brain-consult: `SELECT ... FROM lessons WHERE domain = ? AND status IN (...) LIMIT 1/3`
- brain-lesson: all INSERT/SELECT queries (skill deleted)
- brain-consolidate: `SELECT ... FROM lessons WHERE status = 'promotion_candidate'` → replaced by `## Lessons Learned` bullet counting across sinapses

### Text changes
- brain-dev Phase 3c: "suggest /brain-lesson" → "Episodes are auto-captured by brain-task"
- brain-consult Step 6c: manual suggestion → auto episode file write
- brain-document: "route to /brain-lesson" → auto episode file write
- hooks (strategyRotation, circuitBreakerCheck): "Consider /brain-lesson" → "Episode will be auto-captured when this task completes"
- brain-post-task.js: keep `--lessons-loaded` flag but rename semantics to "sinapses that contained lesson content"

### Counts
- Skill count: 14 (was 15, brain-lesson removed)
- brain.db tables: sinapses + sinapses_fts only (was +lessons +lessons_fts)
- Lesson directories: 0 (was 4+)

---

## Section 8: Files Affected

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | Modify | `scripts/brain-post-task.js` | Add `lesson_trigger` + `lesson_context` to JSON output |
| 2 | Modify | `skills/brain-task/SKILL.md` | Add episode capture as final step before status return |
| 3 | Rewrite | `skills/brain-consolidate/SKILL.md` | Modernized 6-step flow: Step 0 episode proposals, Step 1 approval gate |
| 4 | Modify | `skills/brain-consult/SKILL.md` | Step 6c writes episode instead of suggesting /brain-lesson |
| 5 | Modify | `skills/brain-document/SKILL.md` | Anti-pattern → episode file instead of /brain-lesson routing |
| 6 | Modify | `skills/brain-dev/SKILL.md` | Phase 3c: remove /brain-lesson suggestion |
| 7 | Modify | `hooks/brain-hooks.js` | Update strategyRotation + circuitBreakerCheck messages |
| 8 | Delete | `skills/brain-lesson/SKILL.md` | Entire skill removed |
| 9 | Modify | `skills/brain-map/SKILL.md` | Remove lessons table query from Tier 1 |
| 10 | Modify | `skills/brain-init/SKILL.md` | Remove lesson directories from scaffold, add migration to --upgrade |
| 11 | Modify | `docs/brain-db-schema.sql` | DROP lessons + lessons_fts tables |
| 12 | Modify | `scripts/build_brain_db.py` | Remove lesson file processing |
| 13 | Modify | `skills/brain-status/SKILL.md` | Remove lesson density metrics, update for episode counts |
| 14 | Create | `scripts/brain-migrate-lessons.js` | One-time migration: lessons → sinapse ## Lessons Learned sections |
| 15 | Modify | `README.md` | 14 skills, updated description |
| 16 | Modify | `CHANGELOG.md` | v0.10.0 entry |

---

## Section 9: Token Impact

| Scenario | Old Cost | New Cost | Delta |
|----------|----------|----------|-------|
| Clean success (per task) | 200 tokens (lesson metadata query) | 0 tokens (no query) + ~50-100 extra per sinapse (lesson text in content) | **~-50 to -100** |
| Simple failure (per task) | 200 tokens (query) + 0 (no one runs /brain-lesson) | 300-500 tokens (draft episode write) | **+100-300** |
| Struggled task | 200 tokens (query) + 5k (manual /brain-lesson IF user runs it) | 800-1.5k tokens (full episode, auto) | **-3.7k** (and it actually happens) |
| Consolidation (per batch) | N/A (lessons never integrated) | 1-2k per episode (proposal generation) + approval overhead | New cost, but creates real value |
| brain-consult (per consult) | 100-300 tokens (lesson query) | 0 tokens (no query) + 300 if correction found (episode write) | **-100 to 0** |
| Sinapse growth over time | Stable (lessons separate) | +50-100 tokens per lesson bullet in sinapse content | Gradual growth — monitored in health report |

**Note on sinapse growth:** Each `## Lessons Learned` bullet adds ~50-100 tokens to the sinapse content. brain-map loads 3-4 sinapses per task. Worst case: 4 sinapses × 5 lessons each × 75 tokens = 1,500 tokens additional context. This is still less than the old approach (200 tokens for lesson metadata that was never actually useful). The lesson text IS useful — it's the actual rule, not just a title.

---

## Success Criteria

- [ ] brain-task auto-writes episode files on failure/struggle (no human action needed)
- [ ] brain-task writes episode as final step BEFORE returning status to brain-dev
- [ ] brain-consult auto-writes episode files on corrections (no "suggest /brain-lesson")
- [ ] brain-consolidate Step 0 generates lesson-update PROPOSALS (not auto-writes)
- [ ] brain-consolidate Step 1 presents proposals for developer approval
- [ ] Approved proposals: sinapse file updated + brain.db `sinapses.content` updated + FTS5 rebuilt
- [ ] Sinapse files gain `## Lessons Learned` sections with real rules + tags + task_id
- [ ] brain-map loads lesson rules naturally via sinapse content (zero extra queries)
- [ ] Dedup: brain-consolidate checks for existing similar bullets before proposing
- [ ] brain-lesson skill deleted, lessons table dropped (after migration)
- [ ] Migration script converts existing lessons → sinapse `## Lessons Learned` sections
- [ ] 3+ lesson bullets with same pattern across sinapses triggers convention proposal
- [ ] No skill file contains "suggest /brain-lesson" or "route to /brain-lesson"
- [ ] Episode TTL: sessionEnd hook sweeps episodes older than 30 days
- [ ] Missing sinapse file recovery: recreate from brain.db content column
- [ ] Skill count = 14 in README
- [ ] brain-post-task.js tests include lesson_trigger detection (3 test cases)
