# Self-Awareness & Proactive Confidence v1.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the brain awareness of its own recent actions. brain-dev reads `last_task_id` on every request (~50 tokens), loads previous task context for debug/fix-investigate (+100 tokens), and brain-task proactively flags quality concerns via a self-check script + LLM confidence assessment.

**Architecture:** brain-dev gets Step 1a.5 (check recent work context). New `brain-self-check.js` script checks mechanical quality signals (skipped tests, uncommitted files). brain-task combines script output with LLM self-assessment into a confidence block. brain-dev shows confidence to user and handles "fix it" loop.

**Tech Stack:** Node.js (zero deps) for brain-self-check.js, Markdown SKILL.md for skill specs, node:test-compatible custom harness for tests.

---

## File Structure

| # | Action | Path | Purpose |
|---|--------|------|---------|
| F1 | Create | `scripts/brain-self-check.js` | Zero-LLM mechanical quality check (~5ms) |
| F2 | Create | `tests/brain-self-check.test.js` | 4 tests for confidence rules |
| F3 | Modify | `skills/brain-dev/SKILL.md` | Step 1a.5, enriched dev-context, confidence display, version bump |
| F4 | Modify | `skills/brain-task/SKILL.md` | Call self-check, LLM self-assessment, combined status |
| F5 | Modify | `skills/brain-consult/SKILL.md` | Use ## Previous Task from dev-context |
| F6 | Modify | `skills/brain-init/SKILL.md` | Fix /brain-task → /brain-dev in Next Steps |
| F7 | Modify | `README.md` | Version badge, Mermaid diagram, docs table |
| F8 | Modify | `CHANGELOG.md` | v1.1.0 entry |

---

## Task 1: Create brain-self-check.js + tests (TDD)

**Files:**
- Create: `scripts/brain-self-check.js`
- Create: `tests/brain-self-check.test.js`

- [ ] **Step 1: Write the tests first**

Create `tests/brain-self-check.test.js` using the same custom harness as brain-post-task.test.js:

```javascript
#!/usr/bin/env node

/**
 * Tests for scripts/brain-self-check.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-self-check.test.js
 */

'use strict';

var mod = require('../scripts/brain-self-check.js');

// ---------------------------------------------------------------------------
// Test harness
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

function runTests() {
  for (var i = 0; i < tests.length; i++) {
      tests[i].fn();
      passed++;
      console.log('  PASS  ' + tests[i].name);
    } catch (err) {
      failed++;
      console.log('  FAIL  ' + tests[i].name);
      console.log('        ' + err.message);
    }
  }
  console.log('\n' + (passed + failed) + ' tests, ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// computeConfidence tests
// ---------------------------------------------------------------------------

test('confidence is high when 0 warnings', function () {
  var result = mod.computeConfidence({
    testsSummary: '8 passed, 0 failed, 0 skipped',
    hasUncommittedFiles: false,
    commitFound: true
  });
  assertEqual(result.confidence, 'high');
  assertEqual(result.warnings.length, 0);
});

test('confidence is medium when 1 warning (skipped tests)', function () {
  var result = mod.computeConfidence({
    testsSummary: '6 passed, 0 failed, 2 skipped',
    hasUncommittedFiles: false,
    commitFound: true
  });
  assertEqual(result.confidence, 'medium');
  assert(result.warnings.length === 1, 'should have 1 warning');
  assert(result.warnings[0].includes('skipped'), 'warning should mention skipped');
});

test('confidence is low when tests missing', function () {
  var result = mod.computeConfidence({
    testsSummary: '',
    hasUncommittedFiles: false,
    commitFound: true
  });
  assertEqual(result.confidence, 'low');
  assert(result.warnings.length >= 1, 'should have warnings');
  assert(result.warnings[0].includes('no tests'), 'warning should mention no tests');
});

test('confidence is low when 3 warnings', function () {
  var result = mod.computeConfidence({
    testsSummary: '3 passed, 0 failed, 2 skipped',
    hasUncommittedFiles: true,
    commitFound: false
  });
  assertEqual(result.confidence, 'low');
  assertEqual(result.warnings.length, 3, 'should have 3 warnings');
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

runTests();
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
node tests/brain-self-check.test.js
```

Expected: Error — `Cannot find module '../scripts/brain-self-check.js'`

- [ ] **Step 3: Create brain-self-check.js**

Create `scripts/brain-self-check.js`:

```javascript
#!/usr/bin/env node
/**
 * brain-self-check.js — Post-task mechanical quality check
 *
 * Checks for skipped tests, missing tests, uncommitted files,
 * and missing commit. Zero LLM cost.
 *
 * Usage: node scripts/brain-self-check.js --task-id <id> --tests-summary <summary>
 * Output: JSON { confidence, warnings } to stdout
 * Exit:  0=success, 1=error
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

var childProcess = require('child_process');

// ---------------------------------------------------------------------------
// Core logic (exported for testing)
// ---------------------------------------------------------------------------

function computeConfidence(checks) {
  var warnings = [];
  var gitAvailable = checks.gitAvailable !== false;

  // Check 1: Tests skipped
  var summary = (checks.testsSummary || '').toLowerCase();
  var skippedMatch = summary.match(/(\d+)\s*skipped/);
  var pendingMatch = summary.match(/(\d+)\s*pending/);
  var todoMatch = summary.match(/(\d+)\s*todo/);
  var skipped = 0;
  if (skippedMatch) skipped += parseInt(skippedMatch[1], 10);
  if (pendingMatch) skipped += parseInt(pendingMatch[1], 10);
  if (todoMatch) skipped += parseInt(todoMatch[1], 10);
  if (skipped > 0) {
    warnings.push(skipped + ' tests skipped');
  }

  // Check 2: Tests missing
  var testsMissing = !summary || summary === 'no tests' || summary === 'none' || 
    summary.includes('no test runner') || summary.includes('no test summary') ||
    summary.includes('skip');
  if (testsMissing) {
    warnings.push('no tests found for this task');
  }

  // Check 3: Uncommitted files
  if (gitAvailable && checks.hasUncommittedFiles) {
    warnings.push('uncommitted files in working directory');
  }

  // Check 4: Commit not found
  if (gitAvailable && !checks.commitFound) {
    warnings.push('no commit found matching task');
  }

  // If git is unavailable, skip git-based checks entirely.
  var confidence;
  if (testsMissing || (gitAvailable && checks.hasUncommittedFiles) || warnings.length >= 3) {
    confidence = 'low';
  } else if (warnings.length === 0) {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }

  return { confidence: confidence, warnings: warnings };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function gatherChecks(taskId, testsSummary) {
  // Check uncommitted files
  var gitAvailable = true;
  var hasUncommitted = false;
  try {
    var statusOutput = childProcess.execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    hasUncommitted = statusOutput.length > 0;
  } catch {
    gitAvailable = false;
    // git not available or not a repo — skip check
  }

  // Check commit exists for task
  var commitFound = false;
  if (gitAvailable) {
    try {
      // Note: for inline brain-task execution, commit may not have happened yet
      // (commit is Step 5.3, self-check runs after post-task). For subagent dispatch,
      // the subagent commits before reporting back, so this check is valid.
      var slug = taskId.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      var logOutput = childProcess.execFileSync('git', ['log', '-5', '--oneline'], {
        encoding: 'utf-8',
        timeout: 5000
      });
      commitFound = logOutput.includes(slug) || logOutput.includes(taskId);
    } catch {
      commitFound = false;
    }
  }

  return {
    testsSummary: testsSummary,
    gitAvailable: gitAvailable,
    hasUncommittedFiles: hasUncommitted,
    commitFound: commitFound
  };
}

function main() {
  var taskId = '';
  var testsSummary = '';

  for (var i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
      case '--task-id':
        taskId = process.argv[++i] || '';
        break;
      case '--tests-summary':
        testsSummary = process.argv[++i] || '';
        break;
    }
  }

  var checks = gatherChecks(taskId, testsSummary);
  var result = computeConfidence(checks);

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = { computeConfidence: computeConfidence };

if (require.main === module) {
  main();
}
```

- [ ] **Step 4: Run tests — expect all 4 passing**

```bash
node tests/brain-self-check.test.js
```

Expected: 4 tests, 4 passed, 0 failed.

- [ ] **Step 5: Verify syntax**

```bash
node -c scripts/brain-self-check.js
```

Expected: syntax OK.

- [ ] **Step 6: Commit**

```bash
git add scripts/brain-self-check.js && git add -f tests/brain-self-check.test.js
git commit -m "feat(scripts): add brain-self-check.js — zero-LLM post-task quality check (4 tests)"
```

---

## Task 2: brain-dev — Add Step 1a.5 + enriched dev-context + confidence display

**Files:**
- Modify: `skills/brain-dev/SKILL.md`

- [ ] **Step 1: Insert Step 1a.5 between Step 1b and Step 1c**

Find:
```
### Step 1c: Calculate complexity score
```

Insert BEFORE that line:

```markdown
### Step 1a.5: Check recent work context

**Always (~50 tokens):**

Read `.brain/working-memory/brain-state.json` → extract `last_task_id`.
If `last_task_id` exists AND `tasks_completed_this_session > 0`:
→ Set `recent_task = last_task_id`
Otherwise: `recent_task = null` (new session, no previous work).

**Fallbacks:**
- If brain-state.json doesn't exist (new project, first task): `recent_task = null`. Skip.
- If task-completion-{recent_task}.md doesn't exist (was archived by brain-consolidate): skip `## Previous Task` section. `recent_task` is still set in dev-context but no previous task details are loaded.

**On debug/fix-investigate intent only (+~100 tokens):**

If `recent_task` is set AND intent is `fix-investigate` or `debug`:
1. Read `.brain/working-memory/task-completion-{recent_task}.md`
2. Extract:
   - `previous_description`: what was requested (~50 tokens)
   - `previous_files`: list of files changed
   - `previous_tests`: test summary (pass/fail/skip counts)
3. Add to dev-context as `## Previous Task` section (see Step 1f)

For all other intents (build, refactor, question, review, fix-known):
→ `recent_task` is stored in dev-context but no extra reads are done.

---

```

- [ ] **Step 2: Add `recent_task` field to dev-context YAML template**

In Step 1f, find the dev-context YAML template. Find:
```
keywords: ["{kw1}", "{kw2}", "{kw3}"]
created_at: {ISO8601}
```

Replace with:
```
keywords: ["{kw1}", "{kw2}", "{kw3}"]
recent_task: {last_task_id or null}
created_at: {ISO8601}
```

- [ ] **Step 3: Add `## Previous Task` section to dev-context for debug/fix-investigate**

After the dev-context template closing (after the verbatim request line), add:

```markdown
**If intent is fix-investigate or debug AND recent_task is set**, append after the request:

## Previous Task
Description: {previous_description}
Files changed: {previous_files}
Tests: {previous_tests}
```

- [ ] **Step 4: Pass `task_id` when routing brain-dev to brain-consult**

Find the routing table in brain-dev Phase 2. The line that says:
```
| fix-investigate / debug / review / question | Invoke /brain-consult with task description |
```

Change to:
```
| fix-investigate / debug / review / question | Invoke /brain-consult - pass task_id so brain-consult reads dev-context-{task_id}.md (includes ## Previous Task on debug/fix-investigate) |
```

- [ ] **Step 5: Add confidence display logic to Phase 3 implementer status handling**

Find:
```
**2. Handle implementer status:**
- `DONE`: proceed to spec review
- `DONE_WITH_CONCERNS`: read concerns, decide if they need addressing before review
- `NEEDS_CONTEXT`: provide missing context, re-dispatch same task
- `BLOCKED`: provide more context or re-dispatch with a more capable model; if task is too large, break it down
```

Replace with:
```
**2. Handle implementer status and confidence:**

**Confidence display (shown to user):**
- `confidence: high` → show clean: `🧠 Task {N}: {title} — DONE ✓`
- `confidence: medium` → show warnings: `🧠 Task {N}: {title} — DONE (confidence: medium)` followed by each ⚠ warning
- `confidence: low` → show warnings + ask: `Should I address these before moving to the next task?`

**Status handling:**
- `DONE` with `confidence: high` → proceed to spec review
- `DONE` with `confidence: medium` → show warnings, proceed to spec review (user can interrupt with "fix it")
- `DONE` with `confidence: low` → show warnings, ask user before proceeding
- Note: On low confidence, the user's decision to fix takes priority over automated spec/quality review. If the user says 'fix it', the fix is dispatched. If the user says 'continue', spec review proceeds normally.
- `DONE_WITH_CONCERNS`: read concerns, decide if they need addressing before review
- `NEEDS_CONTEXT`: provide missing context, re-dispatch same task
- `BLOCKED`: provide more context or re-dispatch with a more capable model; if task is too large, break it down

**The "fix it" loop:** If user says "fix it" after seeing warnings:
1. Create a new dev-context with `intent: fix-known` and the specific warnings as the fix specification
2. Dispatch brain-task to fix the specific issues
3. Review again after fix
```

- [ ] **Step 6: Update footer version**

Find: `**Version:** v0.9.1`
Replace with: `**Version:** v1.1.0`

- [ ] **Step 7: Verify**

```bash
node -e "
var fs = require('fs');
var c = fs.readFileSync('skills/brain-dev/SKILL.md', 'utf-8');
var checks = [
  ['Step 1a.5 present', c.includes('Step 1a.5: Check recent work context')],
  ['recent_task in dev-context', c.includes('recent_task:')],
  ['Previous Task section', c.includes('## Previous Task')],
  ['brain-consult routing passes task_id', c.includes('pass task_id so brain-consult reads dev-context-{task_id}.md')],
  ['Confidence display', c.includes('confidence: high') && c.includes('confidence: medium') && c.includes('confidence: low')],
  ['Fix it loop', c.includes('fix it')],
  ['v1.1.0', c.includes('v1.1.0')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 8: Commit**

```bash
git add skills/brain-dev/SKILL.md
git commit -m "feat(brain-dev): add Step 1a.5 self-awareness, enriched dev-context, confidence display"
```

---

## Task 3: brain-task — Call self-check + LLM self-assessment

**Files:**
- Modify: `skills/brain-task/SKILL.md`
- Modify: `skills/brain-dev/SKILL.md`

- [ ] **Step 1: Add brain-self-check.js call after post-task output reading**

Find:
```
### Episode Capture (Auto-Lesson) — FINAL step before returning status
```

Insert BEFORE that line:

```markdown
### Self-Check + LLM Confidence Assessment

After reading brain-post-task.js output, run the mechanical self-check:

```bash
node scripts/brain-self-check.js \
  --task-id "{task_id}" \
  --tests-summary "{tests_pass_fail_summary}"
```

Read the JSON output: `{ confidence: "high|medium|low", warnings: [...] }`

**LLM self-assessment (~100 tokens):**

Before reporting status back, ask yourself: *"Is there anything about this implementation I'm uncertain about — edge cases not covered, assumptions made, or dependencies that might break?"*

If yes: add the concern to the warnings list and lower confidence by one level (high→medium, medium→low). LLM concerns can only LOWER confidence, never raise it.

**Combined status report format:**

```
Status: DONE
Confidence: {high|medium|low}
Mechanical warnings:
  - {warnings from brain-self-check.js, if any}
LLM concerns:
  - {your uncertainty, if any}
Files changed: {list}
```

```

- [ ] **Step 2: Update the subagent prompt's report-back instructions in brain-dev**

In `skills/brain-dev/SKILL.md`, find the implementer subagent prompt in Phase 3 Step 3b. Find:
```
5. Report back:
   - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
   - What you implemented
   - Files changed
   - Test results
   - Any concerns

Never silently produce work you are unsure about. DONE_WITH_CONCERNS is always better than pretending everything is fine.
```

Replace with:
```
5. Run self-check: `node scripts/brain-self-check.js --task-id {task_id} --tests-summary "{tests}"`
6. Self-assess: ask yourself "Is there anything I'm uncertain about?" If yes, lower confidence one level.
7. Report back:
   - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
   - Confidence: high | medium | low (from self-check + self-assessment)
   - Mechanical warnings: {from self-check script}
   - LLM concerns: {from self-assessment, if any}
   - What you implemented
   - Files changed
   - Test results

Never silently produce work you are unsure about. DONE_WITH_CONCERNS is always better than pretending everything is fine. Medium confidence with honest warnings is better than high confidence that hides doubts.
```

- [ ] **Step 3: Update LLM ownership note**

Find:
```
**LLM still owns:** Step 5.1 (brain-document sinapse proposals), Step 5.3 (/commit), and episode capture (auto-lesson).
**LLM still writes:** The episode file "What Worked" section for struggled tasks (requires AI reasoning about what fixed the problem).
```

Replace with:
```
**LLM still owns:** Step 5.1 (brain-document sinapse proposals), Step 5.3 (/commit), episode capture (auto-lesson), and self-assessment confidence.
**LLM still writes:** The episode file "What Worked" section for struggled tasks, and the confidence self-assessment ("Is there anything I'm uncertain about?").
```

- [ ] **Step 4: Verify**

```bash
node -e "
var fs = require('fs');
var task = fs.readFileSync('skills/brain-task/SKILL.md', 'utf-8');
var dev = fs.readFileSync('skills/brain-dev/SKILL.md', 'utf-8');
var checks = [
  ['Self-check call present', task.includes('brain-self-check.js')],
  ['LLM self-assessment', task.includes('uncertain about')],
  ['Confidence in report', dev.includes('Confidence: high | medium | low')],
  ['LLM can only lower', task.includes('only LOWER confidence')],
  ['Implementer prompt updated in brain-dev', dev.includes('Run self-check: `node scripts/brain-self-check.js --task-id {task_id} --tests-summary "{tests}"`')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 5: Commit**

```bash
git add skills/brain-task/SKILL.md skills/brain-dev/SKILL.md
git commit -m "feat(brain-task): add self-check + LLM confidence assessment to post-task flow"
```

---

## Task 4: brain-consult — Use ## Previous Task from dev-context

**Files:**
- Modify: `skills/brain-consult/SKILL.md`

- [ ] **Step 1: Add previous-task awareness to Step 1 and Step 5 response behavior**

In brain-consult Step 1, after Pre-Step, add:

```markdown
Read `dev-context-{task_id}.md` if a `task_id` was passed from brain-dev. Extract `## Previous Task` section if present.
```

Find the Step 5 section header:
```
### Step 5: Synthesize and Respond
```

Insert AFTER that header and BEFORE the Quick mode output template:

```markdown
**Previous Task awareness:**

If the dev-context (routed from brain-dev) contains a `## Previous Task` section:
1. **Acknowledge the previous work** at the start of your response: "I see you just implemented {description}, changing {files}."
2. **Focus your answer** on those specific files and patterns — not generic domain advice.
3. **Use test results** to guide debugging: "The 2 failed tests ({test names}) suggest the issue is in {area}."

If no `## Previous Task` section: respond normally using domain sinapses.

This costs zero extra tokens — brain-dev already loaded the context.

```

- [ ] **Step 2: Verify**

```bash
node -e "
var fs = require('fs');
var c = fs.readFileSync('skills/brain-consult/SKILL.md', 'utf-8');
var checks = [
  ['Step 1 reads dev-context by task_id', c.includes('Read `dev-context-{task_id}.md` if a `task_id` was passed from brain-dev')],
  ['Previous Task awareness', c.includes('Previous Task awareness')],
  ['Acknowledge previous work', c.includes('Acknowledge the previous work')],
  ['Focus on files', c.includes('Focus your answer')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 3: Commit**

```bash
git add skills/brain-consult/SKILL.md
git commit -m "feat(brain-consult): use Previous Task context from dev-context for debugging"
```

---

## Task 5: brain-init — Fix /brain-task → /brain-dev

**Files:**
- Modify: `skills/brain-init/SKILL.md`

- [ ] **Step 1: Update Next Steps**

Find:
```
4. Run `/brain-task` to start using the Brain
```

Replace with:
```
4. Run `/brain-dev` to start using the Brain
```

- [ ] **Step 2: Search for any other stale brain-task entry point references**

```bash
grep -n "Run.*brain-task" skills/brain-init/SKILL.md
```

If any other "Run /brain-task" references exist that should be /brain-dev, fix them too.

- [ ] **Step 3: Commit**

```bash
git add skills/brain-init/SKILL.md
git commit -m "fix(brain-init): update Next Steps — /brain-task → /brain-dev"
```

---

## Task 6: README + CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README version badge**

Find: `Version-1.0.0-blue`
Replace with: `Version-1.1.0-blue`

Also find `alt="Version 1.0.0"` and replace with `alt="Version 1.1.0"`. (Note: release.sh handles this automatically, but fix it if running manually.)

- [ ] **Step 2: Update Mermaid diagram — add self-awareness step**

In the Mermaid diagram, find the brain-dev subgraph:
```
    subgraph BRAINDEV["brain-dev (classifier, ~500 tokens, 0 DB queries)"]
        CL["Classify intent<br/>build | fix-investigate | fix-known<br/>debug | review | question | refactor"]
        SC["Score complexity + select model"]
        KW["Extract 2-3 retrieval keywords"]
        DC["Write dev-context<br/>(intent, domain, score, model, keywords)"]
    end
```

Replace with:
```
    subgraph BRAINDEV["brain-dev (classifier, ~550 tokens, reads last_task_id)"]
        CL["Classify intent<br/>build | fix-investigate | fix-known<br/>debug | review | question | refactor"]
        SA["Check recent work<br/>(+100 tokens on debug/fix-investigate)"]
        SC["Score complexity + select model"]
        KW["Extract 2-3 retrieval keywords"]
        DC["Write dev-context<br/>(intent, domain, score, model, keywords, recent_task)"]
    end
```

Update the arrow chain:
Find: `USER --> CL --> SC --> KW --> DC`
Replace with: `USER --> CL --> SA --> SC --> KW --> DC`

- [ ] **Step 3: Add v1.1.0 CHANGELOG entry**

In `CHANGELOG.md`, insert before the `## [1.0.0]` line:

```markdown
## [1.1.0] — 2026-03-29

### Added
- **Self-awareness in brain-dev (Step 1a.5)** — brain-dev reads `last_task_id` from brain-state.json on every classification (~50 tokens). On debug/fix-investigate, loads task-completion record with files changed + test results (+100 tokens). Adds `recent_task` field and optional `## Previous Task` section to dev-context.
- **`scripts/brain-self-check.js`** — Zero-LLM mechanical quality check (~5ms, 0 tokens). Checks for skipped tests, missing tests, uncommitted files, and missing commit. Outputs `{ confidence, warnings }`. 4 unit tests.
- **Confidence block in brain-task** — After brain-post-task.js, calls brain-self-check.js and LLM self-assessment (~100 tokens). Status report includes confidence (high/medium/low) + mechanical warnings + LLM concerns.
- **Confidence display in brain-dev Phase 3** — High: clean DONE. Medium: shows warnings. Low: asks developer before proceeding.
- **"Fix it" loop** — User says "fix it" after seeing warnings → brain-dev routes fix-known with warning context → brain-task fixes specific issues.
- **brain-consult Previous Task awareness** — When dev-context has `## Previous Task`, brain-consult acknowledges prior work and focuses answer on those files/tests.

### Fixed
- **brain-init Next Steps** — `/brain-task` → `/brain-dev` (brain-dev is the primary entry point since v0.9.0)

### Performance
- Every classification: +50 tokens (read `last_task_id`)
- Debug/fix-investigate only: +100 tokens (task-completion record)
- Every task completion: +130 tokens (self-check + LLM question + display)
- Compared to Reflexion framework (~2-5k tokens): 97% cheaper using existing artifacts

```

- [ ] **Step 4: Verify**

```bash
node -e "
var fs = require('fs');
var readme = fs.readFileSync('README.md', 'utf-8');
var changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');
var checks = [
  ['Version 1.1.0', readme.includes('Version-1.1.0')],
  ['Self-awareness in diagram', readme.includes('Check recent work')],
  ['CHANGELOG v1.1.0', changelog.includes('[1.1.0]')],
  ['CHANGELOG self-awareness', changelog.includes('Self-awareness')],
  ['CHANGELOG brain-self-check', changelog.includes('brain-self-check')],
];
checks.forEach(function(c) { console.log((c[1] ? 'PASS' : 'FAIL') + ' ' + c[0]); });
if (!checks.every(function(c) { return c[1]; })) process.exit(1);
"
```

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: v1.1.0 — self-awareness, proactive confidence, brain-self-check.js"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|-----------------|----------------|
| brain-dev Step 1a.5 always reads last_task_id | Task 2 Step 1 |
| brain-dev loads task-completion on debug/fix-investigate | Task 2 Step 1 |
| recent_task in dev-context YAML | Task 2 Step 2 |
| ## Previous Task section in dev-context | Task 2 Step 3 |
| brain-dev routes brain-consult with task_id | Task 2 Step 4 |
| brain-self-check.js script | Task 1 Step 3 |
| 4 tests for confidence rules | Task 1 Step 1 |
| brain-task calls self-check after post-task | Task 3 Step 1 |
| LLM self-assessment question | Task 3 Step 2 |
| LLM can only lower confidence | Task 3 Step 1 |
| Combined confidence block in status | Task 3 Step 1 |
| brain-dev shows confidence to user | Task 2 Step 5 |
| High/medium/low display rules | Task 2 Step 5 |
| "Fix it" loop | Task 2 Step 5 |
| brain-consult uses ## Previous Task | Task 4 |
| brain-consult reads dev-context-{task_id}.md | Task 4 Step 1 |
| brain-init /brain-task → /brain-dev | Task 5 |
| README version + diagram | Task 6 |
| CHANGELOG v1.1.0 | Task 6 |

**Placeholder scan:** No TBD, TODO, or incomplete sections. All code blocks are complete.

**Type consistency:** `computeConfidence` returns `{ confidence: string, warnings: string[] }` in both script (Task 1 Step 3) and tests (Task 1 Step 1). Confidence values (high/medium/low) are consistent across brain-self-check.js, brain-task, and brain-dev display.


