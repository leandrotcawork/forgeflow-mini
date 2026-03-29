# Self-Awareness & Proactive Confidence — brain-dev v1.1.0

> **Goal:** Give the brain awareness of its own recent actions. When a user says "that isn't working," brain-dev immediately knows what "that" refers to — which files were changed, what was requested, what tests passed/failed. Also, proactively flag quality concerns at task completion via a mechanical self-check script + LLM confidence assessment.

---

## Design Decisions (from brainstorming)

| Decision | Choice | Why |
|----------|--------|-----|
| When self-awareness activates | Hybrid: always read `last_task_id` (+50 tokens), full context only on debug/fix-investigate (+100 tokens) | Zero cost for new build work, rich context for debugging |
| What to pass downstream | Summary + files (~150 tokens): description, files changed, test summary | Enough to understand "that" without expensive git diff |
| Proactive conflict detection | Script (mechanical) + LLM (reasoning) combined | Script catches skipped tests, missing commits. LLM catches logic uncertainty. |
| Medium confidence triggers episode? | No — warnings shown to user, episodes only on real failure | YAGNI — user decides whether to act |

---

## Research Foundation

| Source | Key Insight | How It Maps |
|--------|------------|-------------|
| [Anterior cingulate cortex (ACC)](https://www.science.org/doi/10.1126/science.280.5364.747) | ACC detects **conditions where errors are likely**, not errors themselves | brain-self-check.js detects warning signals (skipped tests, missing verification) |
| [Prefrontal cortex metacognition](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2004037) | PFC retrieves relevant memories and directs corrective action | brain-dev reads `last_task_id` → loads task-completion record → routes with context |
| [Reflexion framework (NeurIPS 2023)](https://arxiv.org/abs/2303.11366) | Self-reflection converts failure into verbal feedback stored in episodic memory | brain-task's LLM self-assessment: "Is there anything I'm uncertain about?" |
| [Memory for Autonomous LLM Agents (2026)](https://arxiv.org/html/2603.07670) | Removing reflection dropped task completion from 80% to 45% | Self-awareness is not optional — it's load-bearing for quality |
| Developer practice: `git diff`, `git blame` | Developers immediately check their recent diff when told something is broken | brain-dev reads task-completion record (files changed, test results) |

**Our token-efficient insight:** Reflexion re-runs tasks and generates new reflections (thousands of tokens). We already have the artifacts on disk (task-completion records, brain-state.json). Self-awareness costs ~50-150 tokens by reading existing files — no re-execution needed.

---

## Section 1: brain-dev Step 1a.5 — Check Recent Work Context

New step between intent classification (1b) and score calculation (1c).

### Always (~50 tokens):

```
Read brain-state.json → extract last_task_id
If last_task_id exists AND tasks_completed_this_session > 0:
  → Set recent_task = last_task_id
  → Store in dev-context for downstream reference
Else:
  → recent_task = null (new session, no previous work)
```

### On debug/fix-investigate intent only (+~100 tokens):

```
If recent_task AND intent is fix-investigate OR debug:
  Read .brain/working-memory/task-completion-{recent_task}.md
  Extract:
    - previous_description: the task description (first ~50 tokens)
    - previous_files: list of files changed
    - previous_tests: test summary (pass/fail counts)
  Add to dev-context as ## Previous Task section
```

### Enriched dev-context (debug/fix-investigate):

```yaml
---
task_id: 2026-03-29-auth-broken
intent: fix-investigate
domain: backend
score: 45
model: opus
keywords: ["auth", "token", "broken"]
recent_task: 2026-03-28-auth-token-fix
created_at: 2026-03-29T10:30:00Z
---

The auth token refresh isn't working after the changes you made

## Previous Task
Description: implement auth token refresh with automatic retry
Files changed: src/auth.js, src/session.js, tests/auth.test.js
Tests: 6 passed, 2 failed (token_expiry, session_cleanup)
```

### Enriched dev-context (non-debug — build, question, etc.):

```yaml
---
task_id: 2026-03-29-add-caching
intent: build
domain: backend
score: 35
model: sonnet
keywords: ["cache", "redis", "products"]
recent_task: 2026-03-28-auth-token-fix
created_at: 2026-03-29T10:45:00Z
---

Add Redis caching for product catalog
```

No `## Previous Task` section — `recent_task` is there as a reference but not loaded. Zero overhead for new work.

---

## Section 2: scripts/brain-self-check.js — Mechanical Quality Check

Zero-LLM Node.js script. Runs after brain-post-task.js at task completion. ~5ms execution, 0 tokens.

### Arguments

```bash
node scripts/brain-self-check.js \
  --task-id "{task_id}" \
  --tests-summary "{pass/fail/skip summary}" \
  --brain-path ".brain/"
```

### What it checks

| Check | How | Signal |
|-------|-----|--------|
| Tests skipped | Parse `--tests-summary` for "skipped", "pending", "todo" | warn if > 0 |
| Tests missing | `--tests-summary` is empty or "no tests" | warn |
| Files uncommitted | `git status --porcelain` from cwd | warn if unstaged changes |
| Commit exists | `git log -1 --oneline` contains task_id slug | warn if not found |
| Verification ran | Check for brain-verify output in working-memory | warn if not found |

### Output

```json
{
  "confidence": "high",
  "warnings": []
}
```

or:

```json
{
  "confidence": "medium",
  "warnings": [
    "2 tests skipped (token_expiry, session_cleanup)",
    "brain-verify was not run for this task"
  ]
}
```

### Confidence rules

```
high   = 0 warnings
medium = 1-2 warnings
low    = 3+ warnings OR tests_missing OR files_uncommitted
```

### Tests (brain-self-check.test.js)

Using the existing custom test harness pattern (same as brain-post-task.test.js):

1. `confidence is high when 0 warnings` — all checks pass → `{ confidence: "high", warnings: [] }`
2. `confidence is medium when 1 warning` — 1 skipped test → `{ confidence: "medium", warnings: ["1 test skipped"] }`
3. `confidence is low when tests missing` — no tests → `{ confidence: "low", warnings: ["no tests found"] }`
4. `confidence is low when 3+ warnings` — multiple issues → `{ confidence: "low", warnings: [...] }`

---

## Section 3: brain-task — Combined Confidence Block

brain-task calls brain-self-check.js right after brain-post-task.js (same pattern: call script, read JSON output).

### New step in brain-task post-task sequence

After reading brain-post-task.js output (lesson_trigger, consolidation_needed, circuit_breaker), add:

```
Call: node scripts/brain-self-check.js --task-id {task_id} --tests-summary "{tests}" --brain-path .brain/
Read JSON output: confidence, warnings
```

### LLM self-assessment (~100 tokens)

Before reporting status back, brain-task asks itself:

```
Before reporting status, ask yourself: "Is there anything about this
implementation I'm uncertain about — edge cases not covered, assumptions
made, or dependencies that might break?"

If yes: add the concern to the confidence block and lower confidence
by one level (high→medium, medium→low).
If no: keep confidence as set by the self-check script.
```

LLM concerns can only LOWER confidence, never raise it.

### Combined status report

```
Status: DONE
Confidence: medium
Mechanical warnings:
  - 2 tests skipped (token_expiry, session_cleanup)
LLM concerns:
  - Retry logic may not handle token expiry during the refresh window
Files changed: src/auth.js, src/session.js, tests/auth.test.js
```

---

## Section 4: brain-dev Phase 3 — Confidence Display + Fix Loop

### What the user sees

**High confidence:**
```
🧠 Task 1/3: auth token refresh — DONE ✓
```

**Medium confidence:**
```
🧠 Task 1/3: auth token refresh — DONE (confidence: medium)
   ⚠ 2 tests skipped (token_expiry, session_cleanup)
   ⚠ Retry logic may not handle token expiry during refresh window
```

**Low confidence:**
```
🧠 Task 1/3: auth token refresh — DONE (confidence: low)
   ⚠ No tests found for new code
   ⚠ Files not committed
   ⚠ Middleware dependency not updated
   Should I address these before moving to the next task?
```

### The "fix it" loop

```
User says "fix it" (or brain-dev auto-asks on low confidence)
  → brain-dev already has the task context (it just received the status)
  → Creates a new dev-context with:
    - intent: fix-known (specific issues identified)
    - previous_task: the task that just completed
    - specific_issues: the warnings list
  → Dispatches brain-task to fix the specific issues
  → Reviews again after fix
```

This reuses existing routing — no new infrastructure. The confidence warnings become the fix specification.

---

## Section 5: brain-consult — Use Previous Task Context

When brain-dev routes to brain-consult with a `## Previous Task` section in dev-context:

### Current behavior (unchanged)
brain-consult loads sinapses and answers from domain knowledge.

### New behavior (additive)
If `## Previous Task` is present in dev-context, brain-consult:

1. **Acknowledges the previous work** in its response: "I see you just implemented {description}, changing {files}."
2. **Focuses its answer** on those specific files and patterns — not generic domain advice.
3. **Can suggest next steps** informed by the test results: "The 2 failed tests (token_expiry, session_cleanup) suggest the issue is in session lifecycle management."

No new queries, no new file reads — brain-consult just uses the context that brain-dev already loaded into dev-context. Zero extra tokens.

---

## Files Affected

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | Modify | `skills/brain-dev/SKILL.md` | Add Step 1a.5, `recent_task` in dev-context, confidence display in Phase 3 |
| 2 | Create | `scripts/brain-self-check.js` | Zero-LLM post-task quality check (~5ms) |
| 3 | Create | `tests/brain-self-check.test.js` | 4 tests for confidence rules |
| 4 | Modify | `skills/brain-task/SKILL.md` | Call self-check, LLM self-assessment, combined confidence block |
| 5 | Modify | `skills/brain-consult/SKILL.md` | Use `## Previous Task` from dev-context |
| 6 | Modify | `README.md` | Document self-awareness + confidence |
| 7 | Modify | `CHANGELOG.md` | v1.1.0 entry |

---

## Token Impact

| Scenario | Added Cost | When |
|----------|-----------|------|
| Every classification | +50 tokens (read brain-state.json `last_task_id`) | Always |
| Debug/fix-investigate | +100 tokens (read task-completion record) | Only on complaints |
| Every task completion | +130 tokens (self-check script 0 + LLM question ~100 + display ~30) | After each task |
| Clean build request | +50 tokens total | Minimal overhead |
| "Fix it" loop | 0 extra — reuses existing routing | Only when user requests |

**Compared to alternatives:**
- Reflexion framework: ~2-5k tokens per self-reflection cycle (re-runs task + generates verbal feedback)
- Our approach: ~150 tokens using existing artifacts on disk

---

## Success Criteria

- [ ] brain-dev reads `last_task_id` on every classification (~50 tokens)
- [ ] brain-dev loads task-completion summary for debug/fix-investigate only (+100 tokens)
- [ ] dev-context has `recent_task` field and optional `## Previous Task` section
- [ ] brain-self-check.js outputs confidence (high/medium/low) + warnings
- [ ] 4 tests for brain-self-check.js confidence rules
- [ ] brain-task calls self-check after post-task, adds LLM self-assessment
- [ ] brain-task status includes combined confidence block
- [ ] brain-dev shows confidence to user (nothing for high, warnings for medium, ask for low)
- [ ] brain-consult uses `## Previous Task` when present in dev-context
- [ ] "fix it" loop works: user complaint → brain-dev routes with warning context → brain-task fixes
- [ ] No new skills, no new DB tables, no new directories
