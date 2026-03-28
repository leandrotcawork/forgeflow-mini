# Auto-Lesson Capture & Brain-Inspired Knowledge Integration

> **Goal:** Make the brain learn automatically. Failures and struggles are captured as temporary episodes, then consolidated into permanent sinapse knowledge — exactly how the human brain converts episodic memory into semantic memory. No manual `/brain-lesson` invocation. Lessons stop existing as separate entities.

---

## Design Decisions (from brainstorming)

| Decision | Choice | Why |
|----------|--------|-----|
| When to capture | Failure + success-after-struggle (adaptive) | Struggle produces the richest insights; clean success needs nothing |
| Where capture executes | brain-task subagent (has full failure context) | Subagent lived through the failure — richest context, best quality |
| Episode storage | File in `.brain/working-memory/` (temporary) | brain-consolidate scans this directory already; no DB needed for temporary data |
| Knowledge destination | Merged INTO sinapses (not separate lesson files) | Brain-inspired: episodic memory consolidates into semantic memory. AI loads lessons naturally via associative retrieval. |
| brain-lesson skill | Deleted | Auto-capture + consolidation replaces it entirely |
| lessons table in brain.db | Removed | Knowledge lives in sinapses; no separate lesson storage needed |
| brain-consolidate role | Modernized: processes episodes, updates sinapses, proposes conventions | Becomes the brain's "sleep consolidation" — extracts patterns, strengthens knowledge |
| Inbox draft enrichment | brain-consolidate Step 0 | Single curator for lesson quality |

---

## The Neuroscience Model

| Human Brain | Our Plugin | What Happens |
|-------------|-----------|--------------|
| Episodic memory (hippocampus) | Episode file in working-memory/ | Raw failure captured with full context — temporary |
| Sleep consolidation (hippocampus → neocortex replay) | brain-consolidate Step 0 | Pattern extracted from episode, merged into sinapse |
| Semantic memory (neocortex) | Sinapse `## Lessons Learned` section | Generalized rule — permanent, loaded naturally by brain-map |
| Prediction error (surprise signal) | `strategy_rotation.attempts >= 2` | Struggle = surprise = stronger encoding (full episode vs draft) |
| Memory decay | Episode archived after consolidation | Temporary details discarded; only the rule survives |

---

## Section 1: Auto-Episode Capture in brain-task

### Trigger Logic

After brain-post-task.js runs, brain-task checks the output:

| Condition | Signal | Action | Token Cost |
|-----------|--------|--------|------------|
| Struggled and recovered | `strategy_rotation.attempts >= 2` | Write **full episode** (What Happened + What Worked) | ~800-1.5k |
| Simple failure | `status === 'failure'`, no strategy rotation | Write **draft episode** (What Happened only) | ~300-500 |
| Clean success | No rotation, no failure | Nothing | 0 |

### brain-post-task.js Changes

New fields in JSON output (zero LLM cost — pure script logic):

```json
{
  "lesson_trigger": "full" | "draft" | null,
  "lesson_context": {
    "error_summary": "from strategy_rotation.last_error or test output",
    "strategies_tried": ["strategy1", "strategy2"],
    "consecutive_failures": 2
  }
}
```

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

---

## Section 2: Episode File Format

Temporary file in `.brain/working-memory/`. Exists only between capture and consolidation.

```yaml
---
type: episode
task_id: {task_id}
domain: {domain}
severity: low | medium | high | critical
trigger: failure | struggled | consultation
tags: ["{tag1}", "{tag2}"]
sinapses_loaded: ["sinapse-auth-001", "sinapse-session-003"]
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{error message or test failure — verbatim from the task}

## What Worked
{the fix or correct approach — only present if trigger=struggled}

## Files Involved
{list of files}
```

### Key Fields

- `sinapses_loaded` — tells brain-consolidate exactly which sinapses to update. No FTS5 search needed to find the target.
- `related_completion` — links to the task-completion record for additional context.
- `trigger: struggled` episodes have both "What Happened" and "What Worked" — brain-consolidate can extract the Rule directly.
- `trigger: failure` episodes only have "What Happened" — brain-consolidate needs LLM reasoning to determine what to add.
- `trigger: consultation` — written by brain-consult when a correction is discovered during Q&A.

### Naming

`episode-{task_id}.md` in `.brain/working-memory/`

---

## Section 3: brain-consolidate Modernized Flow

Old: 7 steps + 3 sub-steps with circular FTS5 dependency, stale brain-task step references, model-specific context counts.

New: 7 clean steps, episode processing first, no circular dependencies.

| Step | Name | What It Does |
|------|------|-------------|
| 0 | Process episodes | Read episode files, cross-ref task-completion records, update sinapses or create new ones, detect recurring patterns, archive episodes |
| 1 | Inventory + sinapse proposals | Scan task-completion records + sinapse-updates files, group by region, present for developer approve/reject/modify |
| 2 | Escalation check | Count `## Lessons Learned` entries across ALL sinapses for each domain+tag pattern. If 3+ entries share the same pattern (accumulated across multiple consolidation runs, not just the current batch) → propose convention update to hippocampus/. FTS5 semantic grouping integrated here (fixes circular dependency). |
| 3 | Health report | Write brain-health.md (staleness, density, coverage, weights) |
| 4 | Weight updates + cleanup | Sinapse weight adjustments, consultation artifact TTL pruning, straggler archival |
| 5 | Clear working memory | Archive task-completion files, reset counters, write consolidation checkpoint |

### Step 0 Detail: Episode Processing

```
For each episode-*.md in working-memory:
  1. Read the episode file
  2. Read linked task-completion-{task_id}.md for full context
  3. Find target sinapse:
     a. Check sinapses_loaded — first candidate
     b. If no match: FTS5 search using episode tags
     c. If still no match: domain-based fallback

  4. Decision: WHERE does the knowledge go?

     IF related sinapse found:
       → Append to sinapse's ## Lessons Learned section
       → weight += 0.02
       → Rebuild FTS5 for that sinapse (new text is searchable)

     IF no sinapse matches but domain is clear:
       → Create NEW sinapse in cortex/<domain>/ with the learned pattern
       → INSERT into brain.db sinapses table

     IF same pattern in 3+ episodes (matching tags + domain):
       → Flag for escalation in Step 2 (convention proposal)

  5. Archive episode to .brain/progress/completed-contexts/
  6. Delete from working-memory
```

### What "Update the Sinapse" Means

The sinapse markdown file gets a section appended:

```markdown
## Lessons Learned

- **2026-03-28:** Always scope auth queries by tenant_id — shared connections leak across tenants.
  Severity: critical | From: 2026-03-28-auth-token-fix
```

In brain.db:
- `weight += 0.02` (battle-tested sinapse = more important)
- `updated_at = now`
- FTS5 index rebuilt (lesson text now searchable via spreading activation)

**Result:** Next time brain-map loads this sinapse for a related task, the lesson is right there in the content. Zero extra queries.

### Stale Reference Fixes in brain-consolidate

| Issue | Fix |
|-------|-----|
| "brain-task (Steps 1-6)" | → "brain-task (Steps 1-3)" |
| "brain-task Step 6 after 5+ tasks" | → "brain-task Step 3 after 5+ tasks" |
| "brain-task Step 5/6" everywhere | → "brain-task Step 3" |
| "Sonnet/Codex/Opus contexts" in summary | → Remove (model-specific context files don't exist) |
| activity.md contradiction | → brain-consolidate does NOT write to activity.md (brain-task already did) |
| FTS5 step 6.6 after step 4 | → Integrated into Step 2 (no circular dependency) |

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

## Section 6: What Gets Removed

### Skill deleted
- `skills/brain-lesson/SKILL.md` — entire skill and directory

### Directories removed from brain-init scaffold
- `.brain/cortex/<domain>/lessons/` (per domain)
- `.brain/lessons/inbox/`
- `.brain/lessons/cross-domain/`
- `.brain/lessons/archived/`

### brain.db schema changes
- DROP `lessons` table (22 columns, 4 indexes)
- DROP `lessons_fts` FTS5 table
- Update `build_brain_db.py` to not process lesson files

### SQL queries removed
- brain-map: `SELECT id, title, severity, tags FROM lessons WHERE domain = ? LIMIT 3`
- brain-consult: `SELECT ... FROM lessons WHERE domain = ? AND status IN (...) LIMIT 1/3`
- brain-lesson: all INSERT/SELECT queries (skill deleted)
- brain-consolidate: `SELECT ... FROM lessons WHERE status = 'promotion_candidate'` → replaced by episode tag grouping

### Text changes
- brain-dev Phase 3c: "suggest /brain-lesson" → "Episodes are auto-captured by brain-task"
- brain-consult Step 6c: manual suggestion → auto episode file write
- brain-document: "route to /brain-lesson" → auto episode file write
- hooks (strategyRotation, circuitBreakerCheck): "Consider /brain-lesson" → "Episode will be auto-captured"

### Counts
- Skill count: 14 (was 15, brain-lesson removed)
- brain.db tables: sinapses + sinapses_fts only (was +lessons +lessons_fts)
- Lesson directories: 0 (was 4+)

---

## Section 7: Files Affected

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | Modify | `scripts/brain-post-task.js` | Add `lesson_trigger` + `lesson_context` to JSON output |
| 2 | Modify | `skills/brain-task/SKILL.md` | Add episode capture step after post-task |
| 3 | Rewrite | `skills/brain-consolidate/SKILL.md` | Modernized 7-step flow with Step 0 episode processing |
| 4 | Modify | `skills/brain-consult/SKILL.md` | Step 6c writes episode instead of suggesting /brain-lesson |
| 5 | Modify | `skills/brain-document/SKILL.md` | Anti-pattern → episode file instead of /brain-lesson routing |
| 6 | Modify | `skills/brain-dev/SKILL.md` | Phase 3c: remove /brain-lesson suggestion |
| 7 | Modify | `hooks/brain-hooks.js` | Update strategyRotation + circuitBreakerCheck messages |
| 8 | Delete | `skills/brain-lesson/SKILL.md` | Entire skill removed |
| 9 | Modify | `skills/brain-map/SKILL.md` | Remove lessons table query from Tier 1 |
| 10 | Modify | `skills/brain-init/SKILL.md` | Remove lesson directories from scaffold |
| 11 | Modify | `docs/brain-db-schema.sql` | DROP lessons + lessons_fts tables |
| 12 | Modify | `scripts/build_brain_db.py` | Remove lesson file processing |
| 13 | Modify | `skills/brain-status/SKILL.md` | Remove lesson density metrics, update for episodes |
| 14 | Modify | `README.md` | 14 skills, updated description, CHANGELOG |
| 15 | Modify | `CHANGELOG.md` | v0.10.0 entry |

---

## Section 8: Token Impact

| Scenario | Old Cost | New Cost | Delta |
|----------|----------|----------|-------|
| Clean success (per task) | 200 tokens (lesson metadata query) | 0 tokens | **-200** |
| Simple failure (per task) | 200 tokens (query) + 0 (no one runs /brain-lesson) | 300-500 tokens (draft episode) | **+100-300** |
| Struggled task | 200 tokens (query) + 5k (manual /brain-lesson IF user runs it) | 800-1.5k tokens (full episode, auto) | **-3.7k** (and it actually happens) |
| Consolidation (per batch) | N/A (lessons never integrated into sinapses) | 1-2k per episode (sinapse update) | New cost, but creates real value |
| brain-consult (per consult) | 100-300 tokens (lesson query) | 0 tokens (no query) + 300 if correction found | **-100 to 0** |

**Net:** Clean successes are cheaper. Failures cost slightly more but produce actual learning. Struggled tasks are much cheaper AND the lesson actually gets captured.

---

## Success Criteria

- [ ] brain-task auto-writes episode files on failure/struggle (no human action needed)
- [ ] brain-consult auto-writes episode files on corrections (no "suggest /brain-lesson")
- [ ] brain-consolidate Step 0 processes episodes and updates sinapses
- [ ] Sinapse files gain `## Lessons Learned` sections with real rules
- [ ] brain-map loads lesson rules naturally via sinapse content (zero extra queries)
- [ ] brain-lesson skill deleted, lessons table dropped
- [ ] 3+ episodes with same pattern triggers convention proposal
- [ ] No skill file contains "suggest /brain-lesson" or "route to /brain-lesson"
- [ ] Skill count = 14 in README
- [ ] brain-post-task.js tests include lesson_trigger detection
