# Workflow Enforcement v1.2.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce brain-dev as a pure router via FSM + hook, make the pipeline strictly linear (no loops), and activate Hebbian learning so sinapses gain weight from successful usage.

**Architecture:** Three coordinated changes: (1) Add `routingGuard` hook + HARD-GATE to brain-dev, (2) Delete brain-dev Phase 3, make brain-plan forward-invoke brain-task, move orchestration into brain-task Path F, (3) Add `UPDATE last_accessed/usage_count` in brain-map and usage-based weight bonus in brain-consolidate.

**Tech Stack:** Node.js (pure, zero npm deps), Claude Code hooks (PreToolUse), SKILL.md markdown files, SQLite (brain.db via LLM SQL queries in skills)

**Spec:** `docs/specs/2026-03-29-workflow-enforcement-design.md`

---

## File Structure

| # | Action | Path | Responsibility |
|---|--------|------|----------------|
| F1 | Modify | `hooks/brain-hooks.js` | Add `routingGuard()` function + register in HOOKS |
| F2 | Create | `tests/brain-routing-guard.test.js` | Tests for routingGuard |
| F3 | Modify | `hooks/hooks.json` | Add `brain-routing-guard` hook entry |
| F4 | Modify | `.brain/working-memory/brain-state.json` | Add `current_skill` field |
| F5 | Modify | `skills/brain-dev/SKILL.md` | Add HARD-GATE, anti-pattern, `current_skill` writes, delete Phase 3 |
| F6 | Modify | `skills/brain-plan/SKILL.md` | Add brain-map call, forward invocation of brain-task |
| F7 | Modify | `skills/brain-task/SKILL.md` | Move Phase 3 logic into Path F, reuse context-packet, remove Path E |
| F8 | Modify | `skills/brain-consult/SKILL.md` | Add `current_skill` self-set for direct invocation |
| F9 | Modify | `skills/brain-map/SKILL.md` | Add `UPDATE last_accessed, usage_count` for Tier 2/3 |
| F10 | Modify | `skills/brain-consolidate/SKILL.md` | Add Step 4a.2: usage-based weight bonus |
| F11 | Modify | `docs/brain-db-schema.sql` | Document `last_accessed` and `usage_count` as actively maintained |
| F12 | Modify | `CHANGELOG.md` | v1.2.0 entry |
| F13 | Modify | `README.md` | Update architecture diagram + feature docs |

---

### Task 1: Add `routingGuard` to brain-hooks.js (TDD)

**Files:**
- Create: `tests/brain-routing-guard.test.js`
- Modify: `hooks/brain-hooks.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/brain-routing-guard.test.js`:

```javascript
#!/usr/bin/env node

/**
 * Tests for routingGuard hook in hooks/brain-hooks.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-routing-guard.test.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');

var mod = require('../hooks/brain-hooks.js');

// ---------------------------------------------------------------------------
// Test harness (same pattern as brain-hooks.test.js)
// ---------------------------------------------------------------------------

var passed = 0;
var failed = 0;
var tests = [];

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + (message || ''));
  }
}

function assertEqual(actual, expected, message) {
  var a = JSON.stringify(actual);
  var e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      (message || 'assertEqual') + ': expected ' + e + ', got ' + a
    );
  }
}

function assertContains(haystack, needle, message) {
  if (haystack.indexOf(needle) === -1) {
    throw new Error(
      (message || 'assertContains') + ': expected string to contain "' + needle + '", got: ' + haystack.substring(0, 200)
    );
  }
}

function runTests() {
  console.log('Running brain-routing-guard tests...\n');

  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      t.fn();
      passed++;
      console.log('  PASS: ' + t.name);
    } catch (err) {
      failed++;
      console.log('  FAIL: ' + t.name);
      console.log('        ' + err.message);
    }
  }

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  if (failed > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempBrain() {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-routing-test-'));
  var brainDir = path.join(tmp, '.brain');
  var wmDir = path.join(brainDir, 'working-memory');
  var progressDir = path.join(brainDir, 'progress');
  fs.mkdirSync(wmDir, { recursive: true });
  fs.mkdirSync(progressDir, { recursive: true });
  return { root: tmp, brainDir: brainDir, wmDir: wmDir, progressDir: progressDir };
}

function writeJSONFile(filePath, data) {
  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function withCwd(dir, fn) {
  var original = process.cwd();
  try {
    process.chdir(dir);
    return fn();
  } finally {
    process.chdir(original);
  }
}

function cleanup(tmp) {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

// ===========================================================================
// routingGuard tests
// ===========================================================================

test('routingGuard: allows write when current_skill is brain-task', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-task'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow');
  assert(!result.decision, 'should not block');
  cleanup(tmp.root);
});

test('routingGuard: allows write when current_skill is brain-plan', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-plan'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow');
  cleanup(tmp.root);
});

test('routingGuard: allows write when current_skill is null', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: null
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow on null skill');
  cleanup(tmp.root);
});

test('routingGuard: allows write when brain-state.json missing', function () {
  var tmp = makeTempBrain();
  // Do NOT write brain-state.json
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow on missing state');
  cleanup(tmp.root);
});

test('routingGuard: blocks source write when current_skill is brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.decision, 'block', 'should block');
  assertContains(result.reason, 'brain-routing-guard', 'reason should name the hook');
  assertContains(result.reason, 'brain-dev', 'reason should name the skill');
  assertContains(result.reason, 'router', 'reason should say router');
  cleanup(tmp.root);
});

test('routingGuard: blocks source write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'scripts/new-feature.js' });
  });
  assertEqual(result.decision, 'block', 'should block');
  assertContains(result.reason, 'brain-consult', 'reason should name the skill');
  cleanup(tmp.root);
});

test('routingGuard: allows dev-context write when current_skill is brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/dev-context-2026-03-29-test.md' });
  });
  assertEqual(result.continue, true, 'should allow dev-context write');
  cleanup(tmp.root);
});

test('routingGuard: allows brain-state.json write when current_skill is brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/brain-state.json' });
  });
  assertEqual(result.continue, true, 'should allow brain-state write');
  cleanup(tmp.root);
});

test('routingGuard: allows consult JSON write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/consult-2026-03-29T10-30-00Z.json' });
  });
  assertEqual(result.continue, true, 'should allow consult JSON write');
  cleanup(tmp.root);
});

test('routingGuard: allows consult-log.md write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/progress/consult-log.md' });
  });
  assertEqual(result.continue, true, 'should allow consult-log write');
  cleanup(tmp.root);
});

test('routingGuard: handles backslash paths (Windows)', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain\\working-memory\\dev-context-test.md' });
  });
  assertEqual(result.continue, true, 'should allow with backslash path');
  cleanup(tmp.root);
});

test('routingGuard: blocks non-allowlist .brain write when brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/context-packet-test.md' });
  });
  assertEqual(result.decision, 'block', 'should block context-packet from brain-dev');
  cleanup(tmp.root);
});

// ===========================================================================
// HOOKS registry
// ===========================================================================

test('HOOKS registry: routingGuard is tier 1', function () {
  var entry = mod.HOOKS.routingGuard;
  assert(entry, 'routingGuard should be in HOOKS');
  assertEqual(entry.tier, 1, 'should be tier 1');
  assertEqual(typeof entry.fn, 'function', 'should have a function');
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

runTests();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/brain-routing-guard.test.js`
Expected: FAIL — `mod.routingGuard is not a function` (function doesn't exist yet)

- [ ] **Step 3: Implement `routingGuard` in brain-hooks.js**

Add this function after the `hippocampusGuard` function (around line 132) in `hooks/brain-hooks.js`:

```javascript
/**
 * routingGuard — enforces that router skills (brain-dev, brain-consult)
 * can only write to their allowlisted files. All other writes are blocked.
 *
 * Allowlist when current_skill is "brain-dev" or "brain-consult":
 *   - .brain/working-memory/dev-context-*.md
 *   - .brain/working-memory/brain-state.json
 *   - .brain/working-memory/consult-*.json
 *   - .brain/progress/consult-log.md
 *
 * If current_skill is null, missing, or any other skill → ALLOW all writes.
 */
function routingGuard(input) {
  var state = readJSON(brainStatePath());
  var currentSkill = state && state.current_skill;

  // No state, null skill, or non-router skill → allow
  if (!currentSkill) return ok();
  if (currentSkill !== 'brain-dev' && currentSkill !== 'brain-consult') return ok();

  var filePath = (input && (input.file_path || input.filePath)) || '';
  // Normalise to forward slashes for cross-platform matching
  filePath = filePath.replace(/\\/g, '/');

  // Allowlist patterns
  if (filePath.indexOf('.brain/working-memory/dev-context-') !== -1) return ok();
  if (filePath.indexOf('.brain/working-memory/brain-state.json') !== -1) return ok();
  if (filePath.indexOf('.brain/working-memory/consult-') !== -1 && filePath.endsWith('.json')) return ok();
  if (filePath.indexOf('.brain/progress/consult-log.md') !== -1) return ok();

  return block(
    'brain-routing-guard: ' + currentSkill + ' is a router, not a worker. ' +
    'Blocked write to: ' + filePath + '. ' +
    'Route to brain-plan (planning) or brain-task (implementation).'
  );
}
```

Then register it in the `HOOKS` object (around line 487):

```javascript
var HOOKS = {
  stateRestore:      { fn: stateRestore,      tier: 1 },
  hippocampusGuard:  { fn: hippocampusGuard,   tier: 1 },
  routingGuard:      { fn: routingGuard,       tier: 1 },
  configProtection:      { fn: configProtection,      tier: 1 },
  // ... rest unchanged
};
```

And add it to `module.exports` (around line 592):

```javascript
module.exports = {
  stateRestore: stateRestore,
  hippocampusGuard: hippocampusGuard,
  routingGuard: routingGuard,
  configProtection: configProtection,
  // ... rest unchanged
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/brain-routing-guard.test.js`
Expected: All 12 tests PASS

- [ ] **Step 5: Run existing hook tests to verify no regression**

Run: `node tests/brain-hooks.test.js`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add tests/brain-routing-guard.test.js hooks/brain-hooks.js
git commit -m "feat(hooks): add routingGuard — blocks Write/Edit from router skills (Tier 1)"
```

---

### Task 2: Register routing-guard hook in hooks.json

**Files:**
- Modify: `hooks/hooks.json`

- [ ] **Step 1: Add the hook entry**

Add this entry to the `PreToolUse` array in `hooks/hooks.json`, after the `brain-hippocampus-guard` entry (line 10):

```json
{
  "id": "brain-routing-guard",
  "description": "Tier 1: Enforce router skills (brain-dev, brain-consult) cannot write outside allowlist",
  "matcher": "Write|Edit",
  "command": "node \"$CLAUDE_PLUGIN_DIR/hooks/brain-hooks.js\" routingGuard"
}
```

- [ ] **Step 2: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf-8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat(hooks): register brain-routing-guard in hooks.json (Tier 1, PreToolUse)"
```

---

### Task 3: Add `current_skill` to brain-state.json + sessionEnd cleanup

**Files:**
- Modify: `.brain/working-memory/brain-state.json`
- Modify: `hooks/brain-hooks.js` (sessionEnd function)

- [ ] **Step 1: Add `current_skill` field to brain-state.json**

Edit `.brain/working-memory/brain-state.json`. Add `"current_skill": null` after the `"session_id"` field:

```json
{
  "session_id": null,
  "current_skill": null,
  "started_at": null,
  "last_task_id": null,
  "current_pipeline_step": 0,
  "tasks_completed_this_session": 0,
  "tasks_since_consolidate": 0,
  "consecutive_failures": 0,
  "strategy_rotation": {
    "task_id": null,
    "current_strategy": 0,
    "attempts": []
  },
  "context_pressure": "low",
  "active_context_files": [],
  "subagents_dispatched": [],
  "snapshot_reason": "session_end",
  "ended_at": "2026-03-29T20:49:39.437Z"
}
```

- [ ] **Step 2: Update sessionEnd to clear `current_skill`**

In `hooks/brain-hooks.js`, modify the `sessionEnd` function. In the default state object (around line 306), add `current_skill: null`:

```javascript
function sessionEnd(/* input */) {
  var state = readJSON(brainStatePath()) || {
    session_id: null,
    current_skill: null,
    started_at: null,
    last_task_id: null,
    current_pipeline_step: 0,
    tasks_completed_this_session: 0,
    tasks_since_consolidate: 0,
    consecutive_failures: 0,
    strategy_rotation: { task_id: null, current_strategy: 0, attempts: [] },
    context_pressure: 'low',
    active_context_files: [],
    subagents_dispatched: [],
    snapshot_reason: null,
  };

  state.current_skill = null;
  state.snapshot_reason = 'session_end';
  state.ended_at = new Date().toISOString();
  // ... rest unchanged
```

- [ ] **Step 3: Update stateRestore to include `current_skill` in output**

In the `stateRestore` function (around line 99), add a line for `current_skill`:

```javascript
var lines = [
  'BRAIN_STATE summary:',
  '  session_id:              ' + (state.session_id || 'none'),
  '  current_skill:           ' + (state.current_skill || 'none'),
  '  current_pipeline_step:   ' + (state.current_pipeline_step || 0),
  '  tasks_completed:         ' + (state.tasks_completed_this_session || 0),
  '  consecutive_failures:    ' + (state.consecutive_failures || 0),
  '  context_pressure:        ' + (state.context_pressure || 'low'),
  '  tasks_since_consolidate: ' + (state.tasks_since_consolidate || 0),
];
```

- [ ] **Step 4: Run all tests to verify no regression**

Run: `node tests/brain-hooks.test.js && node tests/brain-routing-guard.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add .brain/working-memory/brain-state.json hooks/brain-hooks.js
git commit -m "feat(state): add current_skill field to brain-state.json + sessionEnd clears it"
```

---

### Task 4: Rewrite brain-dev SKILL.md — HARD-GATE + delete Phase 3

**Files:**
- Modify: `skills/brain-dev/SKILL.md`

This is the largest SKILL.md change. brain-dev becomes a pure router.

- [ ] **Step 1: Add HARD-GATE after the frontmatter**

Insert this block after line 7 (after the `# brain-dev — Intelligent Entry Point` heading), before the `**Use this for everything.**` paragraph:

```markdown
<HARD-GATE>
brain-dev is a ROUTER, not a worker. You MUST NOT:
- Explore the codebase yourself (Read/Grep/Glob for source files)
- Write a plan yourself (route to brain-plan)
- Implement anything (route to brain-task)
- Dispatch subagents for implementation
- Skip brain-plan for score >= 20 build/refactor tasks

Your ONLY job: classify → score → extract keywords → write dev-context → route.
After invoking the next skill, your job is DONE. Do not resume.
</HARD-GATE>
```

- [ ] **Step 2: Add `current_skill` write to Phase 1 Step 1a**

After the task_id generation block (line 17-20), add:

```markdown
**State update:** Write `current_skill: "brain-dev"` to `.brain/working-memory/brain-state.json`.
```

- [ ] **Step 3: Add `current_skill` update to Phase 2 routing table**

Replace the routing table text (lines 147-153) with:

```markdown
| Condition | Route | State Update |
|-----------|-------|-------------|
| build or refactor AND score < 20 | Invoke `/brain-task` directly (Haiku, no plan) with task_id | Set `current_skill: "brain-task"` before invoking |
| build or refactor AND score >= 20 | Invoke `/brain-plan` — passes task_id | Set `current_skill: "brain-plan"` before invoking |
| fix-investigate / debug / review / question | Invoke `/brain-consult` — pass task_id | Set `current_skill: "brain-consult"` before invoking |
| fix-known | Invoke `/brain-task` directly (same as build < 20) | Set `current_skill: "brain-task"` before invoking |

**After invoking the next skill, brain-dev's job is DONE. Do not resume. Do not wait for the result. The invoked skill takes ownership of the pipeline.**
```

- [ ] **Step 4: Delete Phase 3 entirely**

Delete everything from `## Phase 3: Subagent Dispatch` (line 156) through `**6. Mark task complete in TodoWrite. Move to next task.**` (line 368), inclusive of Step 3c (lines 370-375).

- [ ] **Step 5: Add anti-pattern section**

Replace the existing "What brain-dev Does NOT Do" table (lines 378-388) with:

```markdown
## What brain-dev Does NOT Do

| Anti-Pattern | Why | Correct behaviour |
|---|---|---|
| Asking questions before classifying | Classification is always first | Classify silently, only ask if intent is truly unclassifiable |
| Routing trivial tasks (score < 20) to brain-plan | Overkill for Haiku-level work | Route directly to brain-task |
| Dispatching parallel subagents | Git conflicts, hard to review | Always sequential — fresh context is the speed gain |
| Re-loading sinapses in brain-dev | brain-dev is a pure classifier, not a context loader | Context loading is owned by brain-map |
| Starting execution before plan is approved | Developer loses control | brain-plan presents plan → approval required → then dispatch |
| Implementing anything itself | brain-dev is a router, not a worker | All implementation goes through brain-task |
| Resuming after routing | brain-dev's job ends at Phase 2 | The invoked skill owns the rest of the pipeline |

## Anti-Pattern: "This Is Too Simple To Need brain-plan"

Every build/refactor with score >= 20 goes through brain-plan. "It's just a small refactor" is exactly when shortcuts cause the most damage — no context loaded, no sinapse consultation, no TDD plan, no reviewer gates. If you're thinking "I can just do this quickly," you are about to skip the pipeline. ROUTE.
```

- [ ] **Step 6: Update the footer**

Change the `Updated` date and `Version` in the footer line:

```markdown
**Created:** 2026-03-27 | **Updated:** 2026-03-29 | **Replaces:** brain-decision (deleted), brain-aside (deleted) | **Version:** v1.2.0
```

- [ ] **Step 7: Verify the file is well-formed**

Read the full file and verify: no orphaned references to Phase 3, no broken markdown, HARD-GATE is at the top.

- [ ] **Step 8: Commit**

```bash
git add skills/brain-dev/SKILL.md
git commit -m "feat(brain-dev): pure router — add HARD-GATE, delete Phase 3, add current_skill writes"
```

---

### Task 5: Update brain-plan — context loading + forward invocation

**Files:**
- Modify: `skills/brain-plan/SKILL.md`

- [ ] **Step 1: Add brain-map call before Stage 1**

After Step 0d (line 103 — "Proceed to Stage 1") and before the `### Input` section, add a new section:

```markdown
### Step 0e: Load context via brain-map (NEW in v1.2.0)

Before Stage 1 can analyze the context packet, it must exist. Call brain-map now:

1. Read `keywords` and `domain` from `dev-context-{task_id}.md`
2. Call brain-map with these keywords and domain (brain-map creates `context-packet-{task_id}.md`)
3. Verify `.brain/working-memory/context-packet-{task_id}.md` exists

If brain-map fails or brain.db doesn't exist (new project): proceed to Stage 1 without a context packet. Stage 1 will read the codebase directly instead of relying on sinapse content.

**This fixes the chicken-and-egg bug:** Previously, Stage 1 referenced context-packet but it wasn't created until brain-task Step 1. Now brain-plan creates it first, so the planner has real sinapse context to build the plan with.
```

- [ ] **Step 2: Add forward invocation after plan approval**

At the end of the `### Output` section (after the plan file format block, around line 460), add:

```markdown
### Post-Approval: Forward to brain-task (NEW in v1.2.0)

After the developer approves the plan (or the self-review checklist passes):

1. Update `.brain/working-memory/brain-state.json`: set `current_skill: "brain-task"`
2. Invoke `/brain-task` with the task_id

**brain-plan's job ends here.** Do not orchestrate execution. Do not dispatch subagents. Do not wait for brain-task to finish. brain-task owns all execution from this point forward.

**This replaces the old flow** where brain-plan returned control to brain-dev Phase 3. The pipeline is now linear: brain-dev → brain-plan → brain-task.
```

- [ ] **Step 3: Update the Pipeline Position diagram**

Replace the pipeline position diagram at the top of the file (around line 17):

```markdown
## Pipeline Position

brain-plan is invoked by brain-dev when plan_mode is true (complexity >= 50 or `--plan` flag). After plan approval, brain-plan invokes brain-task directly. Linear flow — no return to brain-dev.

```
brain-dev → brain-plan → brain-task
               ↑ you are here
```
```

- [ ] **Step 4: Update the footer**

```markdown
**Created:** 2026-03-24 | **Updated:** 2026-03-29 | **Agent Type:** Planner | **Plan Format:** Cortex-Linked TDD (expanded) | **Version:** v1.2.0
```

- [ ] **Step 5: Commit**

```bash
git add skills/brain-plan/SKILL.md
git commit -m "feat(brain-plan): add context loading via brain-map + forward invocation to brain-task"
```

---

### Task 6: Update brain-task — absorb Phase 3 into Path F + remove Path E

**Files:**
- Modify: `skills/brain-task/SKILL.md`

This is the most complex SKILL.md change. brain-task Path F absorbs the 3 reviewer gates, confidence display, "fix it" loop, and per-step post-task pipeline from the deleted brain-dev Phase 3.

- [ ] **Step 1: Update Step 1 to reuse existing context-packet**

Replace the Step 1 opening text (around line 124-127) with:

```markdown
## Step 1: Load Context — DO THIS FIRST

**Context ownership:** brain-task Step 1 ensures a context-packet exists. If brain-plan already created one (planned path), reuse it. If not (trivial/fix-known path), call brain-map to create it.

1. Check if `.brain/working-memory/context-packet-{task_id}.md` already exists
2. **If YES** (brain-plan path): Read it. Skip to Step 1 gate check.
3. **If NO** (trivial/fix-known path): Call brain-map to create it:
   a. Read `.brain/hippocampus/architecture.md` and `.brain/hippocampus/conventions.md`
   b. Query brain.db for domain sinapses
   c. Write context-packet-{task_id}.md
```

- [ ] **Step 2: Remove Path E**

Delete the entire `### Path E: Plan Mode` section (approximately lines 300-318). Replace with a redirect comment:

```markdown
### Path E: REMOVED in v1.2.0

Legacy standard plans (plan_type: standard) are no longer supported. All plans are now expanded format via brain-plan. If a legacy plan file is encountered, treat it as an expanded plan (route to Path F).
```

- [ ] **Step 3: Add 3 reviewer gates + confidence display + "fix it" loop to Path F**

After Step F.2.3 result handling (around line 450), add a new section **F.2.5: Review Gates**:

```markdown
**F.2.5: Review gates (per micro-step, after acceptance gates pass)**

After a micro-step passes its acceptance gates, run two review subagents:

**Spec-compliance reviewer (blocking):**

```
Agent(
  model: "haiku",
  description: "Spec review: M{N}: {title}",
  prompt: """
Review the implementation of micro-step M{N}: {title} for spec compliance.

Run `git diff HEAD~1` to see what changed. Verify against the micro-step requirements:

1. Was EVERYTHING in the spec implemented? List any gaps.
2. Was ANYTHING added that was NOT in the spec? List extras.
3. Do the tests actually verify the specified behaviour (not just mock it)?

Output: ✅ COMPLIANT or ❌ ISSUES: [list]
"""
)
```

If ❌: fix inline (read issues, apply fixes, re-run acceptance gates). Then re-run spec reviewer. Repeat until ✅.

**Code-quality reviewer (blocking):**

```
Agent(
  model: "haiku",
  description: "Quality review: M{N}: {title}",
  prompt: """
Review micro-step M{N}: {title} for code quality.

Run `git diff HEAD~1` to see what changed. Read only the changed files.

Check for:
1. Bugs or logic errors (reference line numbers)
2. Names that are unclear or misleading
3. YAGNI violations (features NOT in the spec)
4. Tests that only mock behaviour without verifying real outcomes

Output: ✅ APPROVED or ⚠️ ISSUES: Important: [list] / Minor: [list]
"""
)
```

If Important issues: fix inline, re-run quality reviewer until ✅.

**F.2.6: Confidence display (per micro-step)**

After reviews pass, display confidence to user:
- `confidence: high` → `🧠 Task {N}: {title} — DONE ✓`
- `confidence: medium` → `🧠 Task {N}: {title} — DONE (confidence: medium)` + each ⚠ warning
- `confidence: low` → `🧠 Task {N}: {title} — DONE (confidence: low)` + warnings + `Should I address these before moving to the next task?`

**The "fix it" loop:** If user says "fix it" after seeing low-confidence warnings:
1. Create a fix specification from the specific warnings
2. Re-dispatch brain-task implementer for this micro-step with the fix specification
3. Re-run review gates after fix

**F.2.7: Post-task per micro-step (REQUIRED — do NOT skip)**

After reviews pass and confidence is displayed, run the post-task pipeline for this micro-step:

```bash
node scripts/brain-post-task.js \
  --task-id "{task_id}-step-{N}" \
  --status "{success|failure}" \
  --model "{model}" \
  --domain "{domain}" \
  --score {score} \
  --files-changed '{files_json_array}' \
  --sinapses-loaded '{sinapses_json_array}' \
  --short-description "{micro_step_title}" \
  --task-description "{micro_step_description}" \
  --tests-summary "{tests_pass_fail_summary}"
```

Read JSON output and handle `lesson_trigger` / `consolidation_needed` as defined in Steps 3-5.
```

- [ ] **Step 4: Update the footer**

```markdown
**Created:** 2026-03-27 | **Updated:** 2026-03-29 | **Version:** v1.2.0
```

- [ ] **Step 5: Verify no orphaned references**

Search the file for "Phase 3", "brain-dev Phase 3", "returns to brain-dev". Remove any remaining references.

- [ ] **Step 6: Commit**

```bash
git add skills/brain-task/SKILL.md
git commit -m "feat(brain-task): absorb Phase 3 into Path F — review gates, confidence, fix-it loop, post-task per step"
```

---

### Task 7: Activate Hebbian learning — brain-map, brain-consult, brain-consolidate

**Files:**
- Modify: `skills/brain-map/SKILL.md`
- Modify: `skills/brain-consult/SKILL.md`
- Modify: `skills/brain-consolidate/SKILL.md`
- Modify: `docs/brain-db-schema.sql`

- [ ] **Step 1: Add usage tracking to brain-map**

In `skills/brain-map/SKILL.md`, after the Step 2 Tier 2 FTS5 queries (around line 103, after the spreading activation query), add:

```markdown
**Step 2.5: Track sinapse usage (Hebbian learning, NEW in v1.2.0)**

After Tier 2 sinapses are loaded, update their access tracking in brain.db:

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({tier_2_sinapse_ids});
```

**Also run after Step 4 (Tier 3) if Tier 3 was loaded:**

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({tier_3_sinapse_ids});
```

**Excluded:** Tier 1 hippocampus sinapses (`hippocampus-architecture`, `hippocampus-conventions`) are NOT tracked — they are always loaded, so tracking them would add noise without signal.

**Cost:** One SQL UPDATE per context load, ~1ms, zero tokens.
```

- [ ] **Step 2: Add usage tracking to brain-consult**

In `skills/brain-consult/SKILL.md`, after the Step 2 FTS5 Tier 2 query (around line 189, after the fallback query), add:

```markdown
**Track sinapse usage (Hebbian learning, NEW in v1.2.0):**

After FTS5 Tier 2 sinapses are loaded (Research + Consensus modes only), update access tracking:

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({loaded_sinapse_ids});
```

Tier 1A/1B hippocampus sinapses are excluded from tracking (same rule as brain-map).
```

- [ ] **Step 3: Add `current_skill` self-set to brain-consult**

In `skills/brain-consult/SKILL.md`, at the start of Step 1 (around line 69, in `**1a: Check active pipeline**`), add:

```markdown
**1a.0: Set current_skill (direct invocation guard, NEW in v1.2.0)**

If brain-consult was invoked directly (not via brain-dev routing):
- Read brain-state.json
- If `current_skill` is null or missing: set `current_skill: "brain-consult"`
- This ensures the routing guard hook is active even for direct invocations

If brain-consult was routed via brain-dev: `current_skill` is already set to `"brain-consult"` by brain-dev. No action needed.
```

Also, in Step 6 post-response actions, add after 6e:

```markdown
**6f: Clear current_skill (NEW in v1.2.0)**

Set `current_skill: null` in brain-state.json. brain-consult's job is done.
```

- [ ] **Step 4: Add usage-based weight bonus to brain-consolidate**

In `skills/brain-consolidate/SKILL.md`, after Step 4a weight adjustments (around line 270, after the decay UPDATE), add:

```markdown
**4a.2: Usage-based weight bonus (Hebbian learning, NEW in v1.2.0)**

Sinapses that contributed to successful tasks since last consolidation get an automatic weight bonus.

**Process:**

1. Read all `task-completion-*.md` files in `.brain/working-memory/` (and `.brain/progress/completed-contexts/` for recently archived ones)
2. Filter to `status: success` only
3. For each successful task-completion, extract the `sinapses_loaded` array
4. Count occurrences: how many successful tasks used each sinapse
5. Apply bonus:

```sql
UPDATE sinapses
SET weight = MIN(1.0, weight + (0.01 * {successful_use_count}))
WHERE id = '{sinapse_id}'
  AND last_accessed > '{last_consolidation_date}';
```

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
```

- [ ] **Step 5: Document columns in brain-db-schema.sql**

In `docs/brain-db-schema.sql`, update the comments on `last_accessed` and `usage_count`:

```sql
    last_accessed TEXT,                            -- ISO8601 datetime, updated by brain-map on every context load (v1.2.0+)
    usage_count   INTEGER NOT NULL DEFAULT 0,      -- incremented by brain-map on each context load (v1.2.0+), used by brain-consolidate for Hebbian weight bonus
```

- [ ] **Step 6: Commit**

```bash
git add skills/brain-map/SKILL.md skills/brain-consult/SKILL.md skills/brain-consolidate/SKILL.md docs/brain-db-schema.sql
git commit -m "feat(learning): activate Hebbian learning — usage tracking in brain-map/consult, weight bonus in consolidate"
```

---

### Task 8: Update CHANGELOG + README

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Add v1.2.0 entry to CHANGELOG.md**

Add at the top of `CHANGELOG.md`, before the v1.1.0 entry:

```markdown
## v1.2.0 — Workflow Enforcement + Linear Pipeline + Hebbian Learning

### Breaking Changes
- brain-dev Phase 3 (Subagent Dispatch) deleted — brain-task Path F now owns all micro-step orchestration
- brain-task Path E (legacy standard plans) removed — all plans use expanded format
- brain-plan now invokes brain-task directly after plan approval (no return to brain-dev)

### Added
- `brain-routing-guard` hook (Tier 1) — blocks Write/Edit from router skills (brain-dev, brain-consult) outside their allowlist
- `<HARD-GATE>` in brain-dev SKILL.md — soft enforcement that brain-dev is a router only
- `current_skill` field in brain-state.json — tracks which skill is active for hook enforcement
- Hebbian learning: brain-map updates `last_accessed` and `usage_count` when sinapses are loaded
- brain-consolidate Step 4a.2: usage-based weight bonus (+0.01 per successful task use)
- brain-plan loads context via brain-map before Stage 1 (fixes chicken-and-egg bug)
- brain-task Path F: 3 reviewer gates per micro-step, confidence display, "fix it" loop

### Fixed
- brain-plan Stage 1 could not read context-packet (it didn't exist yet) — now created by brain-plan via brain-map
- brain-dev Phase 3 and brain-task Path F duplicated micro-step orchestration — unified in brain-task
- Pipeline could loop: brain-plan → brain-dev Phase 3 → brain-task — now strictly linear

### Architecture
- FSM states: IDLE → CLASSIFY → PLAN → EXECUTE → LEARN → IDLE
- Single direction flow: brain-dev → brain-plan → brain-task (no returns)
- Hook enforcement: code-level gate that LLM cannot bypass
```

- [ ] **Step 2: Update README.md architecture section**

Update the architecture diagram and feature list in README.md to reflect:
- The linear pipeline (brain-dev → brain-plan → brain-task)
- Workflow enforcement (HARD-GATE + hook)
- Hebbian learning (usage-based weight changes)
- The FSM state model

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: v1.2.0 — workflow enforcement, linear pipeline, Hebbian learning"
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Task |
|---|---|
| brain-dev HARD-GATE + anti-pattern | Task 4, Steps 1 + 5 |
| brain-dev Phase 3 deleted | Task 4, Step 4 |
| brain-dev writes `current_skill` | Task 4, Steps 2 + 3 |
| `brain-routing-guard` hook (Tier 1) | Task 1 (implementation) + Task 2 (registration) |
| `routingGuard()` blocks outside allowlist | Task 1, Step 3 (12 test cases) |
| Hook allows when `current_skill` null | Task 1, tests 3 + 4 |
| brain-plan calls brain-map before Stage 1 | Task 5, Step 1 |
| brain-plan invokes brain-task directly | Task 5, Step 2 |
| brain-task reuses existing context-packet | Task 6, Step 1 |
| brain-task Path F: reviewer gates + confidence + fix loop | Task 6, Step 3 |
| Path E removed | Task 6, Step 2 |
| brain-map updates `last_accessed`/`usage_count` | Task 7, Step 1 |
| brain-consult updates `last_accessed`/`usage_count` | Task 7, Step 2 |
| Tier 1 hippocampus excluded from tracking | Task 7, Steps 1 + 2 (explicit exclusion) |
| brain-consolidate Step 4a.2 usage bonus | Task 7, Step 4 |
| Weight cap 1.0, floor 0.1 | Task 7, Step 4 (MIN/MAX in SQL) |
| `current_skill` lifecycle: set → updated → cleared | Task 3 (state + sessionEnd) + Task 4 (brain-dev) + Task 7 Step 3 (brain-consult direct) |
| brain-consult direct invocation sets `current_skill` | Task 7, Step 3 |
| CHANGELOG + README | Task 8 |
| `brain-db-schema.sql` docs | Task 7, Step 5 |

**No gaps found.** All spec requirements are covered.

**Placeholder scan:** No TBD, TODO, "fill in later", "similar to Task N", or vague instructions found.

**Type consistency:** `routingGuard` name used consistently across brain-hooks.js, tests, hooks.json, and HOOKS registry. `current_skill` field name consistent across brain-state.json, sessionEnd, stateRestore, brain-dev, brain-plan, brain-consult. Weight bonus formula `MIN(1.0, weight + (0.01 * N))` consistent between spec and plan.
