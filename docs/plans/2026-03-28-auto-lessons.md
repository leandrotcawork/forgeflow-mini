# Auto-Lesson Capture v0.10.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the brain learn automatically — failures and struggles are captured as temporary episodes that brain-consolidate processes into permanent sinapse knowledge. No manual `/brain-lesson`. Lessons dissolve into sinapses, exactly like episodic → semantic memory consolidation.

**Architecture:** brain-task auto-captures episodes after post-task. brain-post-task.js detects trigger conditions (struggled vs simple failure). brain-consolidate Step 0 processes episodes into approval-gated sinapse update proposals. brain-lesson skill deleted. lessons table dropped (after migration).

**Tech Stack:** Node.js for brain-post-task.js modifications, Markdown SKILL.md for skill specs, SQLite for schema changes, node:test for unit tests.

---

## File Structure

| # | Action | Path | Purpose |
|---|--------|------|---------|
| F1 | Modify | `scripts/brain-post-task.js` | Add `computeLessonTrigger` + output fields |
| F2 | Modify | `tests/brain-post-task.test.js` | 3 test cases for lesson trigger |
| F3 | Modify | `skills/brain-task/SKILL.md` | Add episode capture as final step |
| F4 | Rewrite | `skills/brain-consolidate/SKILL.md` | Modernized 6-step flow with episode proposals |
| F5 | Modify | `skills/brain-consult/SKILL.md` | Episode write + remove lesson queries |
| F6 | Modify | `skills/brain-document/SKILL.md` | Episode write for anti-patterns |
| F7 | Modify | `skills/brain-dev/SKILL.md` | Remove /brain-lesson suggestion |
| F8 | Modify | `hooks/brain-hooks.js` | Update messages + episode TTL sweep |
| F9 | Delete | `skills/brain-lesson/SKILL.md` | Entire skill removed |
| F10 | Modify | `skills/brain-map/SKILL.md` | Remove lessons table query |
| F11 | Modify | `skills/brain-init/SKILL.md` | Remove lesson directories, add migration |
| F12 | Modify | `docs/brain-db-schema.sql` | Drop lessons + lessons_fts |
| F13 | Modify | `scripts/build_brain_db.py` | Remove lesson processing |
| F14 | Modify | `skills/brain-status/SKILL.md` | Remove lesson density metrics |
| F15 | Create | `scripts/brain-migrate-lessons.js` | One-time lesson → sinapse migration |
| F16 | Modify | `README.md` | 14 skills, remove brain-lesson, update flow |
| F17 | Modify | `CHANGELOG.md` | v0.10.0 entry |

---

## Task 1: brain-post-task.js — Add lesson trigger detection

**Files:**
- Modify: `scripts/brain-post-task.js`

**Why first:** All downstream episode capture depends on this script's output.

- [ ] **Step 1: Add `computeLessonTrigger` function**

In `scripts/brain-post-task.js`, find the line:

```
// Step 6.5: Circuit breaker state computation
```

(This is line 440, before `computeCircuitBreakerNextState`.)

Insert BEFORE that line:

```javascript
// ---------------------------------------------------------------------------
// Lesson trigger computation
// ---------------------------------------------------------------------------

function computeLessonTrigger(status, brainState, taskId) {
  var attempts = 0;
  if (brainState && brainState.strategy_rotation && brainState.strategy_rotation.attempts) {
    // Only count attempts for the CURRENT task — stale attempts from a previous task must not trigger
    if (brainState.strategy_rotation.task_id === taskId) {
      attempts = brainState.strategy_rotation.attempts.length || 0;
    }
  }
  if (attempts >= 2) return 'full';    // struggled (success or failure) — rich context available
  if (status === 'failure') return 'draft';  // simple failure — raw data only
  return null;                               // clean success — no episode
}

```

- [ ] **Step 2: Call the function in main() and add to output**

In the `main()` function, find the line that says:

```javascript
    // Update state files
    diag('Updating brain-state.json...');
    updateBrainState(brainPath, args);
```

Insert these lines BEFORE `// Update state files` (so the brain state is read BEFORE it gets modified):

```javascript
    // Lesson trigger — read brain state BEFORE updateBrainState() modifies it
    var brainStateForLesson = readJSON(path.join(brainPath, 'working-memory', 'brain-state.json')) || {};
    var lessonTrigger = computeLessonTrigger(args.status, brainStateForLesson, args.taskId);
    var lessonContext = null;
    if (lessonTrigger) {
      var attempts = (brainStateForLesson.strategy_rotation && brainStateForLesson.strategy_rotation.attempts) || [];
      lessonContext = {
        error_summary: attempts.length > 0 ? (attempts[attempts.length - 1].error || '') : '',
        strategies_tried: attempts.map(function(a) { return a.strategy || ''; }),
        consecutive_failures: brainStateForLesson.consecutive_failures || 0
      };
    }

```

Then add two fields to the output object. Find `var output = {` (line ~646) and add after `circuit_breaker_state: cbResult.state`:

Find:
```javascript
      circuit_breaker_state: cbResult.state
    };
```

Replace with:
```javascript
      circuit_breaker_state: cbResult.state,
      lesson_trigger: lessonTrigger,
      lesson_context: lessonContext
    };
```

- [ ] **Step 3: Export the function**

Find the `module.exports` block. Add `computeLessonTrigger` to it:

Find:
```javascript
  computeCircuitBreakerNextState: computeCircuitBreakerNextState,
```

Add after it:
```javascript
  computeLessonTrigger: computeLessonTrigger,
```

- [ ] **Step 4: Verify syntax**

```bash
node -c scripts/brain-post-task.js
```

Expected: syntax OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/brain-post-task.js
git commit -m "feat(brain-post-task): add computeLessonTrigger — detect struggled/failure for auto-episode capture"
```

---

## Task 2: Tests for computeLessonTrigger

**Files:**
- Modify: `tests/brain-post-task.test.js`

- [ ] **Step 1: Read the existing test file to find where to add tests**

Read `tests/brain-post-task.test.js` to understand the current structure.

- [ ] **Step 2: Add 3 test cases for computeLessonTrigger**

The test file uses a custom harness (`test()`, `assert()`, `assertEqual()`), NOT `node:test`. Find `runTests();` at the end of the file. Insert BEFORE that line:

```javascript
// ---------------------------------------------------------------------------
// computeLessonTrigger tests
// ---------------------------------------------------------------------------

test('computeLessonTrigger returns full when strategy_rotation has 2+ attempts for current task', function () {
  var result = mod.computeLessonTrigger('success', {
    strategy_rotation: { task_id: 'task-123', attempts: [{ strategy: 'retry' }, { strategy: 'different' }] }
  }, 'task-123');
  assertEqual(result, 'full');
});

test('computeLessonTrigger returns null when attempts are from a different task', function () {
  var result = mod.computeLessonTrigger('success', {
    strategy_rotation: { task_id: 'task-old', attempts: [{ strategy: 'retry' }, { strategy: 'different' }] }
  }, 'task-123');
  assertEqual(result, null);
});

test('computeLessonTrigger returns draft when status is failure and no strategy rotation', function () {
  var result = mod.computeLessonTrigger('failure', {}, 'task-123');
  assertEqual(result, 'draft');
});

test('computeLessonTrigger returns null when status is success and no attempts', function () {
  var result = mod.computeLessonTrigger('success', {}, 'task-123');
  assertEqual(result, null);
});
```

Note: `mod` is already imported at the top of the file as `var mod = require('../scripts/brain-post-task.js');`. No additional import needed.

- [ ] **Step 3: Run tests**

```bash
node tests/brain-post-task.test.js
```

Expected: all tests passing (existing + 4 new). Note: this file uses `node tests/...` NOT `node --test`.

- [ ] **Step 4: Commit**

```bash
git add -f tests/brain-post-task.test.js
git commit -m "test(brain-post-task): add 4 tests for computeLessonTrigger (task_id check, draft, null)"
```

---

## Task 3: brain-task — Add episode capture step

**Files:**
- Modify: `skills/brain-task/SKILL.md`

- [ ] **Step 1: Add episode capture instructions after post-task output reading**

In `skills/brain-task/SKILL.md`, find the section where brain-post-task.js output is read:

```
Read the JSON output:
- `consolidation_needed: true` -> output: "BRAIN: 5+ tasks accumulated -- run /brain-consolidate"
- `circuit_breaker_state.state: "open"` -> output breaker warning to developer
```

Add after this block:

```markdown
- `lesson_trigger: "full"` -> Write a **full episode** file (see below)
- `lesson_trigger: "draft"` -> Write a **draft episode** file (see below)
- `lesson_trigger: null` -> No episode needed

### Episode Capture (Auto-Lesson) — FINAL step before returning status

**This must be the LAST thing brain-task does before reporting status back to brain-dev.** The subagent has full failure context at this point — once it returns, the context is lost.

**If `lesson_trigger === "full"` (struggled — strategy rotation had 2+ attempts):**

Write `.brain/working-memory/episode-{task_id}.md`:

```yaml
---
type: episode
task_id: {task_id}
domain: {domain}
severity: {estimate based on failure impact}
trigger: struggled
tags: ["{relevant tags from task context}"]
sinapses_loaded: {pass the FULL sinapse ID array from --sinapses-loaded, not just the count}
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{what failed — error messages, test failures, verbatim}

## What Worked
{the fix that resolved it — what you changed and why}

## Files Involved
{list of files modified during the struggle}
```

Token cost: ~800-1.5k (includes LLM reasoning for "What Worked").

**If `lesson_trigger === "draft"` (simple failure — no recovery):**

Write `.brain/working-memory/episode-{task_id}.md`:

```yaml
---
type: episode
task_id: {task_id}
domain: {domain}
severity: {estimate}
trigger: failure
tags: ["{relevant tags}"]
sinapses_loaded: {sinapse ID array}
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{error message or test failure — verbatim}

## Files Involved
{list of files}
```

Token cost: ~300-500 (no LLM reasoning, just raw data capture).

**Important:** Pass the sinapse ID array (not just the count) via `--sinapses-loaded` when calling brain-post-task.js. Example: `--sinapses-loaded '["sinapse-auth-001", "sinapse-session-003"]'`
```

- [ ] **Step 2: Update the LLM ownership note**

Find:
```
**LLM still owns:** Step 5.1 (brain-document sinapse proposals) and Step 5.3 (/commit).
**LLM still writes:** The "Lessons" section of the task-completion record (requires AI reasoning about non-obvious findings).
```

Replace with:
```
**LLM still owns:** Step 5.1 (brain-document sinapse proposals), Step 5.3 (/commit), and episode capture (auto-lesson).
**LLM still writes:** The episode file "What Worked" section for struggled tasks (requires AI reasoning about what fixed the problem).
```

- [ ] **Step 3: Verify no brain-lesson references remain**

```bash
grep -n "brain-lesson" skills/brain-task/SKILL.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add skills/brain-task/SKILL.md
git commit -m "feat(brain-task): add auto-episode capture as final step — struggled=full, failure=draft"
```

---

## Task 4: brain-consolidate — Modernized 6-step rewrite

**Files:**
- Rewrite: `skills/brain-consolidate/SKILL.md`

**This is the largest task.** Read the FULL current file, then rewrite it with the new 6-step flow from the spec.

- [ ] **Step 1: Read the current file**

Read `skills/brain-consolidate/SKILL.md` completely to understand the current structure.

- [ ] **Step 2: Rewrite the file**

Keep the frontmatter (name, description) but rewrite the description to reflect the new flow. Then replace the entire body with the modernized 6-step flow:

**New description:**
```
description: Consolidation cycle — Process episode files into approval-gated sinapse updates, review sinapse proposals, detect recurring patterns for convention promotion, generate health report, update weights. Always propose — never auto-update without developer approval.
```

**New step structure (from spec Section 3):**

| Step | Name | Content |
|------|------|---------|
| 0 | Process episodes → generate lesson proposals | Read `episode-*.md` from working-memory, cross-ref task-completion records, find target sinapses (via sinapses_loaded or FTS5 fallback), dedup check, generate lesson-update proposals |
| 1 | Review all proposals | Present lesson-update proposals + sinapse-update proposals together. Developer approves/rejects/modifies. Apply approved: update sinapse file + UPDATE sinapses.content in brain.db + rebuild FTS5. weight += 0.02. |
| 2 | Escalation check | Count `## Lessons Learned` bullets across ALL sinapses by domain+tag pattern. 3+ matching bullets → propose convention update to hippocampus/conventions.md. FTS5 semantic grouping integrated here. |
| 3 | Health report | Write brain-health.md (staleness, density, coverage, weights). Remove lesson density metrics. Remove model-specific context counts. |
| 4 | Weight updates + cleanup | Sinapse weight adjustments, consultation artifact TTL (7 days), episode TTL (30 days), straggler archival |
| 5 | Clear working memory | Archive task-completion + episode files to completed-contexts/, reset `tasks_since_last_consolidation`, increment `total_consolidation_cycles`, write consolidation checkpoint. Do NOT write to activity.md (brain-task already did). |

**Key requirements for the rewrite:**
- All references to `brain-task Steps` must use the new numbering (Steps 1-3)
- No references to `brain-lesson` (deleted)
- No references to `lessons` table or `lessons_fts` (dropped)
- No references to model-specific context files (sonnet-context, codex-context, opus-debug-context)
- The trust model text "Always propose — never auto-update without developer approval" must be preserved
- Step 0 must include dedup logic (check existing `## Lessons Learned` bullets before proposing)
- Step 0 must include missing-file recovery (if sinapse file doesn't exist, recreate from brain.db content)
- Step 0 must handle empty sinapses_loaded (FTS5 fallback → domain fallback → create new sinapse)
- Step 2 must count bullets accumulated across ALL consolidation runs (bullets persist in sinapses)
- Escalation proposals stay in `.brain/working-memory/` (not `.brain/lessons/inbox/` which is removed)
- Pipeline diagram must say `brain-task (Steps 1-3)` not `Steps 1-6`

- [ ] **Step 3: Verify**

```bash
node -e "
var fs = require('fs');
var c = fs.readFileSync('skills/brain-consolidate/SKILL.md', 'utf-8');
var checks = [
  ['Step 0 present', c.includes('Process episodes')],
  ['Approval gate', c.includes('developer approval') || c.includes('approve')],
  ['No brain-lesson', !c.includes('brain-lesson')],
  ['No lessons table', !c.includes('FROM lessons')],
  ['No lessons_fts', !c.includes('lessons_fts')],
  ['No sonnet-context', !c.includes('sonnet-context')],
  ['No Steps 1-6', !c.includes('Steps 1-6')],
  ['Dedup check', c.includes('dedup') || c.includes('existing') && c.includes('Lessons Learned')],
  ['FTS5 rebuild', c.includes('sinapses_fts') || c.includes('rebuild')],
  ['sinapses.content update', c.includes('sinapses.content') || c.includes('UPDATE sinapses')],
  ['Episode TTL', c.includes('30')],
  ['Missing file recovery', c.includes('recreate') || c.includes('missing')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 4: Commit**

```bash
git add skills/brain-consolidate/SKILL.md
git commit -m "feat(brain-consolidate): modernized 6-step flow — episode proposals, approval-gated sinapse updates"
```

---

## Task 5: brain-consult — Episode capture + remove lesson queries

**Files:**
- Modify: `skills/brain-consult/SKILL.md`

- [ ] **Step 1: Remove all lesson SQL queries**

Remove the Tier 1A lesson query (the `SELECT ... FROM lessons` block in the Step 2 context loading section). There are 3 separate lesson queries: Tier 1A (LIMIT 1), Tier 1B (LIMIT 3), and Research/Consensus (LIMIT 3). Remove all three.

In their place, add a note: "Lesson knowledge is now embedded in sinapse content (`## Lessons Learned` sections) and loaded naturally through sinapse retrieval. No separate lesson query needed."

- [ ] **Step 2: Replace Step 6c lesson suggestion with episode write**

Find:
```
**6c: Suggest lesson capture (when warranted)**
```

Replace the entire Step 6c section (through the `brain-consult MUST NOT create lesson files directly` line) with:

```markdown
**6c: Auto-capture episode (when warranted)**

If the consultation revealed:
- A failure pattern not in existing knowledge
- A correction to what the developer believed
- A new anti-pattern discovered during research
- A significant insight about project architecture

Write `.brain/working-memory/episode-consult-{timestamp}.md`:

```yaml
---
type: episode
task_id: consult-{timestamp}
domain: {domain}
severity: {estimated: low|medium|high|critical}
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
{if any files were discussed, otherwise omit}
```

brain-consolidate will process this episode and propose a sinapse update during the next consolidation cycle.
```

- [ ] **Step 3: Clean lesson references from output templates and other sections**

Search the entire file for remaining lesson references and update:

- Find any `[[lesson-XXXX]]` notation in output templates (Quick/Research/Consensus mode output sections) → replace with `(lessons are now embedded in sinapse content)` or remove the line
- Find `{M} lessons` in brain context footer lines → remove or replace with sinapse count only
- Find `"lesson_ids": ["{loaded lesson IDs}"]` in the audit JSON template → remove this field
- Find `hippocampus + lessons only` in Failure Scenarios table → replace with `hippocampus + sinapses only`
- Find the top description mentioning `lessons` (e.g., "sinapses, conventions, lessons") → update to "sinapses, conventions"

- [ ] **Step 4: Update anti-patterns table**

Find:
```
| Creating lesson files directly | Violates brain-lesson ownership | Suggest `/brain-lesson`, never create |
```

Replace with:
```
| Skipping episode capture on corrections | Loses learning opportunity | Always write episode file when a correction is identified |
```

- [ ] **Step 5: Update relationship table**

Find the brain-lesson row:
```
| **brain-lesson** | Suggestion target. When consultation reveals a learning, suggest /brain-lesson. brain-consult never creates lesson files. |
```

Replace with:
```
| **brain-lesson** | Deleted. brain-consult writes episode files directly to working-memory. brain-consolidate processes them into sinapse updates. |
```

- [ ] **Step 6: Update skill count footer**

Find: `Skill Count: 15 -> 16` (or whatever the current count says)
Replace with: `Skill Count: 14`

- [ ] **Step 7: Verify**

```bash
node -e "
var fs = require('fs');
var c = fs.readFileSync('skills/brain-consult/SKILL.md', 'utf-8');
var checks = [
  ['No FROM lessons query', !c.includes('FROM lessons')],
  ['No suggest brain-lesson', !c.includes('suggest /brain-lesson') && !c.includes('Suggest `/brain-lesson')],
  ['Episode capture present', c.includes('episode-consult')],
  ['brain-lesson marked deleted', c.includes('Deleted')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 8: Commit**

```bash
git add skills/brain-consult/SKILL.md
git commit -m "feat(brain-consult): auto-capture episodes on corrections, remove lesson queries"
```

---

## Task 6: brain-document + brain-dev + hooks — Remove brain-lesson references

**Files:**
- Modify: `skills/brain-document/SKILL.md`
- Modify: `skills/brain-dev/SKILL.md`
- Modify: `hooks/brain-hooks.js`

- [ ] **Step 1: Update brain-document anti-pattern routing**

In `skills/brain-document/SKILL.md`, find:

```
**Important:** If a new **anti-pattern** is discovered (e.g., "We made this mistake and it broke things"):
- Do NOT document the anti-pattern in cortex sinapses
- Route to `/brain-lesson` instead
- Lessons live in `.brain/cortex/<domain>/lessons/` or `.brain/lessons/cross-domain/` (distributed architecture)
- Anti-patterns are failures that became knowledge, not architectural patterns
- brain-lesson will handle escalation if 3+ same anti-pattern lessons exist -> propose convention
```

Replace with:

```
**Important:** If a new **anti-pattern** is discovered (e.g., "We made this mistake and it broke things"):
- Do NOT document the anti-pattern as a regular sinapse
- Write an episode file to `.brain/working-memory/episode-document-{task_id}.md` with `trigger: anti-pattern`
- brain-consolidate will process the episode and propose a sinapse update with the anti-pattern as a `## Lessons Learned` entry
- Anti-patterns are failures that became knowledge — they belong in the relevant sinapse's lessons section, not as standalone files
```

Also find and update the anti-patterns table rows:

Find: `| Documenting anti-patterns in cortex sinapses | Anti-patterns are failures, not patterns | Use `/brain-lesson` for anti-pattern capture |`
Replace with: `| Documenting anti-patterns as standalone sinapses | Anti-patterns are failure knowledge | Write episode file, brain-consolidate adds to relevant sinapse |`

Find: `| Editing .brain/cortex/<domain>/lessons/ directly | Lessons have their own lifecycle | Use `/brain-lesson` skill workflow |`
Replace with: `| Writing lesson files directly | Lessons are now episode-based | Write episode file to working-memory, brain-consolidate processes it |`

Find: `| Mixing patterns with failure stories | Confuses architectural advice with debugging notes | Keep sinapses (patterns) and lessons (failures) separate |`
Replace with: `| Ignoring anti-patterns | Loses failure knowledge | Capture as episode, brain-consolidate merges into sinapse ## Lessons Learned |`

Also find: `- Anti-pattern discoveries flagged for `/brain-lesson` routing`
Replace with: `- Anti-pattern discoveries captured as episode files in working-memory`

- [ ] **Step 2: Update brain-dev Phase 3c**

In `skills/brain-dev/SKILL.md`, find:

```
- If yes: suggest `/brain-lesson` to capture the learning
```

Replace with:

```
- Episodes are auto-captured by brain-task during execution (struggled tasks get full episodes, failures get drafts). No manual action needed.
```

- [ ] **Step 3: Update hooks — strategyRotation**

In `hooks/brain-hooks.js`, find:

```
      'Consider running /brain-lesson to capture the failure pattern.',
```

Replace with:

```
      'Episode will be auto-captured when this task completes.',
```

- [ ] **Step 4: Update hooks — circuitBreakerCheck**

Find:

```
        'Try a different approach, run /brain-lesson, or wait for cooldown.'
```

Replace with:

```
        'Try a different approach or wait for cooldown. Episodes are auto-captured.'
```

- [ ] **Step 5: Add episode TTL sweep to sessionEnd hook**

In `hooks/brain-hooks.js`, find the sessionEnd function's cleanup section. After the consult audit file pruning block (after `pruneConsultAuditFiles`), add:

```javascript
  // Sweep stale episode files (30-day TTL)
  try {
    var episodeFiles = fs.readdirSync(wmDir).filter(function(f) { return f.startsWith('episode-') && f.endsWith('.md'); });
    var thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    var episodesSwept = 0;
    for (var i = 0; i < episodeFiles.length; i++) {
      var epPath = path.join(wmDir, episodeFiles[i]);
      var stat = fs.statSync(epPath);
      if (Date.now() - stat.mtimeMs > thirtyDaysMs) {
        fs.unlinkSync(epPath);
        episodesSwept++;
      }
    }
  } catch {
    // Never block session end on cleanup failure
  }
```

Update the return statement to include `episodes_swept`:

Find the return in sessionEnd that has `consult_cleanup`:
```javascript
  return ok({
    reason: 'brain-state.json saved at session end.',
    consult_cleanup: pruneResult,
  });
```

Replace with:
```javascript
  return ok({
    reason: 'brain-state.json saved at session end.',
    consult_cleanup: pruneResult,
    episodes_swept: episodesSwept || 0,
  });
```

- [ ] **Step 6: Verify**

```bash
grep -rn "brain-lesson" skills/brain-dev/SKILL.md skills/brain-document/SKILL.md hooks/brain-hooks.js 2>/dev/null && echo "FAIL: brain-lesson refs remain" || echo "PASS: no brain-lesson references"
```

- [ ] **Step 7: Commit**

```bash
git add skills/brain-document/SKILL.md skills/brain-dev/SKILL.md hooks/brain-hooks.js
git commit -m "refactor: replace all brain-lesson references with auto-episode capture"
```

---

## Task 7: Delete brain-lesson + remove lesson queries from brain-map

**Files:**
- Delete: `skills/brain-lesson/SKILL.md`
- Modify: `skills/brain-map/SKILL.md`

- [ ] **Step 1: Delete brain-lesson**

```bash
rm -rf skills/brain-lesson
```

- [ ] **Step 2: Remove lesson query from brain-map Tier 1**

In `skills/brain-map/SKILL.md`, find the Tier 1 lesson query:

```sql
-- Query 2: Top lessons for task domain
SELECT id, title, severity, tags FROM lessons
WHERE domain = ?
ORDER BY weight DESC
LIMIT 3
```

Replace the query with:

```
-- Note: Lessons are now embedded in sinapse content (## Lessons Learned sections).
-- They are loaded naturally when sinapses are retrieved via FTS5 + spreading activation.
-- No separate lesson query needed.
```

- [ ] **Step 3: Remove other lesson references in brain-map**

Search for and remove/update these references:
- `lessons_loaded: [M]` in the context packet frontmatter → remove
- `[Top 3 lessons matching domain]` in the Tier 1 output template → remove
- `3 lessons matching domain` in the status output → remove
- `Lessons Integration` section → replace with "Lessons are embedded in sinapse `## Lessons Learned` sections and loaded naturally."
- Anti-pattern row `| Ignore lessons (only use sinapses) |` → remove (lessons ARE in sinapses now)
- Testing checklist `+ 3 lessons` → remove

- [ ] **Step 4: Verify**

```bash
node -e "
var fs = require('fs');
var checks = [
  ['brain-lesson deleted', !fs.existsSync('skills/brain-lesson')],
  ['No FROM lessons in brain-map', !fs.readFileSync('skills/brain-map/SKILL.md', 'utf-8').includes('FROM lessons')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete brain-lesson, remove lesson queries from brain-map"
```

---

## Task 8: Schema + build script — Drop lessons tables

**Files:**
- Modify: `docs/brain-db-schema.sql`
- Modify: `scripts/build_brain_db.py`

- [ ] **Step 1: Remove lessons table from schema**

In `docs/brain-db-schema.sql`:

Remove the entire `CREATE TABLE IF NOT EXISTS lessons (...)` block (including all 22 columns and the 4 indexes that follow).

Remove the `CREATE VIRTUAL TABLE IF NOT EXISTS lessons_fts` block.

Remove the `lessons_fts` rebuild line from the FTS5 comment block.

Update the schema comment at line 2: remove "brain-lesson" from the list.

Update the FTS5 comment: remove "semantic lesson grouping" reference.

- [ ] **Step 2: Remove lesson processing from build_brain_db.py**

In `scripts/build_brain_db.py`:

Remove or make no-op: `extract_domain_from_path` and `is_lesson` functions.

Remove the lessons table CREATE statement from `create_tables()`.

Remove the lessons_fts CREATE statement.

Remove the `if is_lesson(file_path):` branch in the main loop (the lesson insertion block).

Remove the `lessons_fts` rebuild line.

Remove lessons-related DROP statements.

Remove lessons-related migration steps.

Update all print statements to not reference lessons.

- [ ] **Step 3: Verify**

```bash
node -e "
var fs = require('fs');
var schema = fs.readFileSync('docs/brain-db-schema.sql', 'utf-8');
var checks = [
  ['No lessons table', !schema.includes('CREATE TABLE IF NOT EXISTS lessons')],
  ['No lessons_fts', !schema.includes('lessons_fts')],
  ['sinapses table still exists', schema.includes('CREATE TABLE IF NOT EXISTS sinapses')],
  ['sinapses_fts still exists', schema.includes('sinapses_fts')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 4: Commit**

```bash
git add docs/brain-db-schema.sql scripts/build_brain_db.py
git commit -m "refactor(schema): drop lessons + lessons_fts tables, remove lesson processing from build script"
```

---

## Task 9: brain-init + brain-status — Remove lesson directories and metrics

**Files:**
- Modify: `skills/brain-init/SKILL.md`
- Modify: `skills/brain-status/SKILL.md`

- [ ] **Step 1: Remove lesson directories from brain-init scaffold**

In `skills/brain-init/SKILL.md`, find the Phase 6 directory scaffold. Remove:
- `+ .brain/cortex/backend/lessons/` (and frontend, database, infra equivalents)
- The entire `.brain/lessons/` block (cross-domain/, inbox/, archived/)

- [ ] **Step 2: Add migration to --upgrade path**

Find the `--upgrade` flag description. Add:
```
For v0.10.0 upgrade: runs `scripts/brain-migrate-lessons.js` to convert existing lesson files into sinapse `## Lessons Learned` sections, then drops the lessons table.
```

- [ ] **Step 3: Remove lesson output references**

Find `lessons count` in the build index output and remove.

- [ ] **Step 4: Update brain-status metrics**

In `skills/brain-status/SKILL.md`:
- Remove "lesson density" from the description
- Remove `Count lessons per region` from the data gathering step
- Remove the `Lessons` column from the dashboard display table
- Remove the `lessons/cross-d` row from the dashboard
- Remove `13 lessons` (or similar count) from the totals line
- Remove the `.brain/lessons/inbox/escalation-*.md` count (directory removed)
- Update "pending escalations" to look in `.brain/working-memory/escalation-PROPOSAL-*.md` instead

- [ ] **Step 5: Verify**

```bash
grep -n "lessons/" skills/brain-init/SKILL.md 2>/dev/null && echo "FAIL" || echo "PASS: no lesson dirs in init"
grep -n "lesson density\|lessons per region\|FROM lessons" skills/brain-status/SKILL.md 2>/dev/null && echo "FAIL" || echo "PASS: no lesson metrics in status"
```

- [ ] **Step 6: Commit**

```bash
git add skills/brain-init/SKILL.md skills/brain-status/SKILL.md
git commit -m "refactor: remove lesson directories from init scaffold, update status metrics"
```

---

## Task 10: Migration script — brain-migrate-lessons.js

**Files:**
- Create: `scripts/brain-migrate-lessons.js`

- [ ] **Step 1: Create the migration script**

Create `scripts/brain-migrate-lessons.js` with this content:

```javascript
#!/usr/bin/env node
/**
 * brain-migrate-lessons.js — One-time migration: lessons → sinapse ## Lessons Learned
 *
 * Reads lesson files and brain.db lessons table, merges lesson content
 * into the target sinapse's ## Lessons Learned section.
 *
 * Usage: node scripts/brain-migrate-lessons.js --brain-path .brain/
 * Exit:  0=success, 1=error, 2=no lessons to migrate
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

var fs = require('fs');
var path = require('path');

function main() {
  var brainPath = null;
  for (var i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--brain-path' && process.argv[i + 1]) {
      brainPath = process.argv[i + 1];
      break;
    }
  }

  if (!brainPath) {
    process.stderr.write('Usage: node scripts/brain-migrate-lessons.js --brain-path .brain/\n');
    process.exit(1);
  }

  var absPath = path.resolve(brainPath);

  // Find all lesson files across cortex and lessons directories
  var lessonDirs = [];
  var cortexDir = path.join(absPath, 'cortex');
  if (fs.existsSync(cortexDir)) {
    var regions = fs.readdirSync(cortexDir);
    for (var r = 0; r < regions.length; r++) {
      var lessonsDir = path.join(cortexDir, regions[r], 'lessons');
      if (fs.existsSync(lessonsDir)) lessonDirs.push(lessonsDir);
    }
  }
  var crossDomain = path.join(absPath, 'lessons', 'cross-domain');
  if (fs.existsSync(crossDomain)) lessonDirs.push(crossDomain);
  var inbox = path.join(absPath, 'lessons', 'inbox');
  if (fs.existsSync(inbox)) lessonDirs.push(inbox);

  // Collect all lesson files
  var lessonFiles = [];
  for (var d = 0; d < lessonDirs.length; d++) {
    var files = fs.readdirSync(lessonDirs[d]).filter(function(f) {
      return f.startsWith('lesson-') && f.endsWith('.md');
    });
    for (var f = 0; f < files.length; f++) {
      lessonFiles.push(path.join(lessonDirs[d], files[f]));
    }
  }

  if (lessonFiles.length === 0) {
    process.stdout.write('[brain-migrate] No lesson files found. Nothing to migrate.\n');
    process.exit(2);
  }

  process.stdout.write('[brain-migrate] Found ' + lessonFiles.length + ' lesson files to migrate.\n');

  var migrated = 0;
  var skipped = 0;

  for (var l = 0; l < lessonFiles.length; l++) {
    var content = fs.readFileSync(lessonFiles[l], 'utf-8');

    // Extract frontmatter fields
    var statusMatch = content.match(/status:\s*(\w+)/);
    var status = statusMatch ? statusMatch[1] : 'draft';

    // Skip archived and superseded lessons
    if (status === 'archived' || status === 'superseded') {
      skipped++;
      continue;
    }

    // Skip draft lessons unless recurrence >= 2
    var recurrenceMatch = content.match(/recurrence_count:\s*(\d+)/);
    var recurrence = recurrenceMatch ? parseInt(recurrenceMatch[1], 10) : 0;
    if (status === 'draft' && recurrence < 2) {
      skipped++;
      continue;
    }

    // Extract the Rule section
    var ruleMatch = content.match(/## Rule\n([\s\S]*?)(?=\n## |\n---|$)/);
    var rule = ruleMatch ? ruleMatch[1].trim() : null;
    if (!rule) {
      // Try to extract from ## Correct as fallback
      var correctMatch = content.match(/## Correct\n([\s\S]*?)(?=\n## |\n---|$)/);
      rule = correctMatch ? correctMatch[1].trim() : null;
    }

    if (!rule) {
      skipped++;
      continue;
    }

    // Find target sinapse
    var parentMatch = content.match(/parent_synapse:\s*"?([^"\n]+)/);
    var domainMatch = content.match(/domain:\s*(\w+)/);
    var severityMatch = content.match(/severity:\s*(\w+)/);
    var titleMatch = content.match(/title:\s*"?([^"\n]+)/);
    var idMatch = content.match(/id:\s*(lesson-\S+)/);

    var parentSinapse = parentMatch ? parentMatch[1].trim() : null;
    var domain = domainMatch ? domainMatch[1] : 'cross-domain';
    var severity = severityMatch ? severityMatch[1] : 'medium';
    var title = titleMatch ? titleMatch[1].trim() : 'Unknown lesson';
    var lessonId = idMatch ? idMatch[1] : path.basename(lessonFiles[l], '.md');

    // Find the target sinapse file
    var targetFile = null;
    if (parentSinapse) {
      // Search for sinapse file by ID
      var sinapseFiles = [];
      findFiles(path.join(absPath, 'cortex'), sinapseFiles);
      findFiles(path.join(absPath, 'sinapses'), sinapseFiles);
      for (var s = 0; s < sinapseFiles.length; s++) {
        var sc = fs.readFileSync(sinapseFiles[s], 'utf-8');
        if (sc.includes('id: ' + parentSinapse) || sc.includes('id: "' + parentSinapse + '"')) {
          targetFile = sinapseFiles[s];
          break;
        }
      }
    }

    if (!targetFile) {
      // Fallback: find any sinapse in the same domain
      var domainDir = path.join(absPath, 'cortex', domain);
      if (fs.existsSync(domainDir)) {
        var domainFiles = fs.readdirSync(domainDir).filter(function(f) {
          return f.endsWith('.md') && !f.startsWith('lesson-');
        });
        if (domainFiles.length > 0) {
          targetFile = path.join(domainDir, domainFiles[0]);
        }
      }
    }

    if (!targetFile) {
      process.stderr.write('[brain-migrate] No target sinapse found for ' + lessonId + ' (domain: ' + domain + '). Skipping.\n');
      skipped++;
      continue;
    }

    // Append to sinapse's ## Lessons Learned section
    var sinapseContent = fs.readFileSync(targetFile, 'utf-8');
    var lessonBullet = '- **migrated:** ' + rule + '\n  Severity: ' + severity + ' | From: ' + lessonId + '\n';

    if (sinapseContent.includes('## Lessons Learned')) {
      // Append to existing section
      sinapseContent = sinapseContent.replace(
        '## Lessons Learned\n',
        '## Lessons Learned\n\n' + lessonBullet
      );
    } else {
      // Create new section at end of file
      sinapseContent = sinapseContent.trimEnd() + '\n\n## Lessons Learned\n\n' + lessonBullet;
    }

    fs.writeFileSync(targetFile, sinapseContent, 'utf-8');
    migrated++;
    process.stdout.write('[brain-migrate] ' + lessonId + ' → ' + path.basename(targetFile) + '\n');
  }

  process.stdout.write('\n[brain-migrate] Done. Migrated: ' + migrated + ', Skipped: ' + skipped + '\n');
  process.stdout.write('[brain-migrate] Run `python scripts/build_brain_db.py` to rebuild brain.db (lessons table will not be created).\n');
}

function findFiles(dir, result) {
  if (!fs.existsSync(dir)) return;
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      findFiles(full, result);
    } else if (entries[i].endsWith('.md')) {
      result.push(full);
    }
  }
}

main();
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/brain-migrate-lessons.js
```

Expected: syntax OK.

- [ ] **Step 3: Commit**

```bash
git add scripts/brain-migrate-lessons.js
git commit -m "feat(scripts): add brain-migrate-lessons.js — one-time lesson-to-sinapse migration"
```

---

## Task 11: README + CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update skill count badge**

Find: `Skills-15-orange`
Replace with: `Skills-14-orange`

- [ ] **Step 2: Update intro paragraph about learning**

Find:
```
**Failure becomes knowledge with confidence scoring.** When something breaks, brain-lesson captures it at confidence 0.3. Evidence accumulates. At 0.7+ with 3 occurrences, brain-consolidate proposes it as a convention. Mistakes stop repeating.
```

Replace with:
```
**Failure becomes knowledge automatically.** When something breaks, brain-task captures an episode. brain-consolidate processes episodes into sinapse updates (developer-approved). Recurring patterns (3+ occurrences) get proposed as conventions. The brain learns from mistakes without manual intervention.
```

- [ ] **Step 3: Remove brain-lesson from "Which Skill?" table**

Find and delete the row containing `/brain-lesson`.

- [ ] **Step 4: Remove brain-lesson from decision flowchart**

Find lines referencing `brain-lesson` in the flowchart and remove them:
```
    +-- Something broke? --------> /brain-lesson "what failed"
    |                               Captures with confidence scoring
```

- [ ] **Step 5: Remove brain-lesson from Skill Map table**

Find and remove:
```
| `brain-lesson` | Learner | Captures failures with confidence scoring |
```

Update header:
Find: `### Skill Map (15 Skills)`
Replace with: `### Skill Map (14 Skills)`

- [ ] **Step 6: Update brain directory structure**

Find the directory structure section and remove the `lessons/` line:
```
+-- lessons/               cross-domain/ + inbox/ + archived/
```

- [ ] **Step 7: Remove Example 5 (Recording a Failure with brain-lesson)**

Find Example 5 (the `/brain-lesson "ML API pagination breaks..."` example) and remove the entire example block.

- [ ] **Step 8: Update Example 7 brain-status output table**

If the README has an example showing brain-status output with a `Lessons` column header and lesson counts, remove the `Lessons` column from that table.

- [ ] **Step 9: Update Learning Loop section**

Find references to `brain-lesson captures it (confidence 0.3)` and rewrite for auto-episode model.

- [ ] **Step 10: Add v0.10.0 CHANGELOG entry**

In `CHANGELOG.md`, insert before the `## [0.9.1]` line:

```markdown
## [0.10.0] — 2026-03-28

### Added
- **Auto-episode capture in brain-task** — failures and struggled tasks automatically generate episode files in working-memory. Struggled tasks (2+ strategy rotation attempts) get full episodes with "What Happened" + "What Worked". Simple failures get lightweight drafts. Zero manual intervention.
- **brain-consolidate Step 0: Episode Processing** — reads episode files, cross-references task-completion records, generates approval-gated lesson-update proposals for sinapse `## Lessons Learned` sections. Developer approves before any sinapse is modified.
- **brain-consult episode capture** — consultations that reveal corrections or failure patterns automatically write episode files.
- **brain-document episode capture** — anti-pattern discoveries write episode files instead of routing to /brain-lesson.
- **Episode 30-day TTL sweep** — sessionEnd hook cleans up stale episode files.
- **`scripts/brain-migrate-lessons.js`** — one-time migration script converts existing lesson files into sinapse `## Lessons Learned` sections.
- **`computeLessonTrigger` in brain-post-task.js** — detects struggled (2+ attempts) vs simple failure vs clean success. 3 unit tests.

### Removed
- **brain-lesson** — entire skill deleted. Auto-episode capture + brain-consolidate replaces manual lesson invocation.
- **`lessons` table in brain.db** — dropped (after migration). Knowledge now lives in sinapse content.
- **`lessons_fts` FTS5 table** — dropped. Lesson text is searchable via `sinapses_fts` (embedded in sinapse content).
- **Lesson directories** — `.brain/cortex/<domain>/lessons/`, `.brain/lessons/inbox/`, `.brain/lessons/cross-domain/`, `.brain/lessons/archived/` all removed.
- **All "suggest /brain-lesson" text** — removed from brain-dev, brain-consult, brain-document, hooks.

### Changed
- **brain-consolidate** — modernized 6-step flow: Step 0 (episode proposals) → Step 1 (approval gate) → Step 2 (escalation check via Lessons Learned bullets) → Step 3 (health) → Step 4 (weights + cleanup) → Step 5 (clear). Trust model preserved: all sinapse mutations require developer approval.
- **brain-consult** — writes episode files directly on corrections instead of suggesting /brain-lesson. Lesson queries removed (knowledge embedded in sinapse content).
- **brain-map** — lesson metadata query removed from Tier 1. Lessons load naturally via sinapse content.
- **brain-task** — auto-episode capture as final step before returning status.
- **brain-status** — lesson density metrics removed, episode count added.
- **brain-init** — lesson directories removed from scaffold, migration added to --upgrade.

### Performance
- **Clean success:** -200 tokens (no lesson metadata query)
- **Failures:** +100-500 tokens (episode capture) but lessons ACTUALLY get captured (previously lost)
- **Struggled tasks:** -3.7k tokens vs manual /brain-lesson + lessons are higher quality (captured with fresh context)
- **Consolidation:** ~1-2k per episode (proposal generation), creates real value

```

- [ ] **Step 11: Verify**

```bash
node -e "
var fs = require('fs');
var readme = fs.readFileSync('README.md', 'utf-8');
var changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');
var checks = [
  ['Badge 14 skills', readme.includes('Skills-14')],
  ['No brain-lesson in skill table', !readme.includes('brain-lesson') || readme.includes('Deleted')],
  ['Auto-episode in intro', readme.includes('automatically') || readme.includes('auto')],
  ['CHANGELOG v0.10.0', changelog.includes('[0.10.0]')],
  ['CHANGELOG episode capture', changelog.includes('episode capture')],
  ['Skill Map 14', readme.includes('14 Skills')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 12: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: v0.10.0 — auto-episodes, brain-lesson removed, 14 skills"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|-----------------|----------------|
| brain-post-task.js computeLessonTrigger | Task 1 |
| 3 unit tests for trigger | Task 2 |
| brain-task episode capture (final step before status) | Task 3 |
| brain-consolidate modernized 6 steps | Task 4 |
| Step 0 episode proposals (approval-gated) | Task 4 |
| Step 1 approval gate (file + DB + FTS5) | Task 4 |
| Step 2 escalation (Lessons Learned bullet counting) | Task 4 |
| Dedup check before proposing | Task 4 |
| Missing file recovery | Task 4 |
| Episode TTL 30 days | Task 6 Step 5 |
| brain-consult episode capture | Task 5 |
| brain-consult lesson queries removed | Task 5 |
| brain-document episode for anti-patterns | Task 6 |
| brain-dev remove /brain-lesson | Task 6 |
| hooks update messages | Task 6 |
| brain-lesson deleted | Task 7 |
| brain-map lesson query removed | Task 7 |
| brain.db lessons table dropped | Task 8 |
| build_brain_db.py updated | Task 8 |
| brain-init lesson dirs removed | Task 9 |
| brain-status metrics updated | Task 9 |
| Migration script | Task 10 |
| README 14 skills | Task 11 |
| CHANGELOG v0.10.0 | Task 11 |
| sinapses_loaded ID array documented | Task 3 |
| strategy_rotation.attempts (not last_error) | Task 1 |

**Placeholder scan:** No TBD, TODO, or incomplete sections. All steps have exact text.

**Type consistency:** `computeLessonTrigger` returns `'full'|'draft'|null` in both the script (Task 1) and tests (Task 2). Episode format fields match between brain-task (Task 3), brain-consult (Task 5), and brain-document (Task 6). brain-consolidate (Task 4) reads the same fields.
