---
name: brain-dev
description: Primary entry point for ALL developer requests — build, fix, debug, review, question, refactor. Pure classifier (~500-800 tokens, zero DB queries). Extracts retrieval keywords, routes to brain-plan (build/refactor), brain-consult (fix-investigate/debug/review/question), or brain-task directly (trivial builds score < 20, fix-known).
---

# brain-dev — Intelligent Entry Point

**Use this for everything.** Build, fix, investigate, question, refactor — start here. brain-dev classifies your request in ~500-800 tokens (zero DB queries), extracts retrieval keywords, and routes to the right skill. You don't need to think about which skill to call.

---

## Phase 1: Classify + Evaluate (silent — output nothing until Phase 2)

### Step 1a: Generate task_id

```
task_id = YYYY-MM-DD-{slug}
slug = max 20 chars, kebab-case, derived from task description
Example: "implement product recommendations" → 2026-03-27-product-recommendations
```

### Step 1b: Classify intent

| Intent | Signals | Routes to |
|--------|---------|-----------|
| **build** | "implement", "add", "create", "build", "make" | brain-plan → subagents |
| **fix-investigate** | symptom described: "not working", "getting error", "fails silently", "broken" | brain-consult (investigation) → brain-task if fix identified |
| **fix-known** | specific change described: "fix the null check in auth.js", "change X to Y" | brain-task directly (same path as build) |
| **debug** | "why is", "investigate", "figure out", "trace", "debug", "isn't working" | brain-consult (research mode, Opus) |
| **review** | "is this right", "should we", "best approach", "review this" | brain-consult (consensus mode) |
| **question** | "how does", "explain", "what is", "can we", "what's the best" | brain-consult (quick/research) |
| **refactor** | "refactor", "clean up", "improve", "optimise", "restructure" | brain-plan → subagents |

**If intent cannot be classified after reading the request twice:** ask ONE clarifying question maximum. Example: *"I can see you want to change the checkout flow — is this a bug fix or a new feature?"* Then proceed.

### Step 1c: Calculate complexity score

```
score = 15  (baseline)
+ domain:  cross-domain → +30 | backend → +10 | other → +0
+ risk:    critical → +35 | high → +20 | medium → +5 | low → +0
+ type:    architectural → +20 | debugging → +15 | unknown_pattern → +10
= min(total, 100)
```

**Domain signals:** cross-domain = touches multiple services or layers. backend = API/DB/services. frontend = UI/components.

**Risk signals:** critical = security or data integrity. high = breaking changes or migrations. medium = isolated changes with downstream effects.

### Step 1d: Select model (enforced — not advisory)

```
PRIORITY OVERRIDE: debug intent → Opus (always, regardless of score)

Score-based (non-debug intents only):
  < 20   → Haiku   (trivial, single-file)
  20–39  → Sonnet  (standard, 2–5 files)
  40–74  → Codex   (complex, multi-file)
  75+    → Codex + plan mode (architectural)
```

**Plan mode activates when:** score ≥ 50, OR type = architectural, OR risk = critical, OR `--plan` flag passed.

### Step 1e: Extract retrieval keywords

Extract 2-3 keywords from the developer's request. Pure text extraction — no DB query needed.

Rules:
- Pick nouns and domain terms, not verbs ("fix the auth token refresh" → `["auth", "token", "refresh"]`)
- Max 3 keywords — more dilutes FTS5 precision
- If the request is vague ("it's broken"), use the domain as the single keyword (e.g., `["backend"]`)

These keywords are passed downstream via dev-context. brain-map uses them for associative retrieval (FTS5 + spreading activation).

### Step 1f: Write dev-context handoff file

Write `.brain/working-memory/dev-context-{task_id}.md`:

```yaml
---
task_id: {task_id}
intent: {build|fix-investigate|fix-known|debug|review|question|refactor}
domain: {domain}
score: {N}
model: {haiku|sonnet|codex|opus}
plan_mode: {true|false}
keywords: ["{kw1}", "{kw2}", "{kw3}"]
created_at: {ISO8601}
---

{developer's original request, verbatim — do not paraphrase}
```

No sinapses. No concerns. No brain evaluation. Just classification metadata + keywords. Context loading is owned by brain-map (called from brain-task Step 1).

---

## Phase 2: Route

Output routing decision (this IS shown to developer):

```
🧠 brain-dev: {task_id}
   Intent: {intent} | Domain: {domain} | Score: {N} → {Model}
   {If concern found: ⚠️  {one-line concern summary}}
   Routing to: {brain-plan | brain-consult | brain-task}
```

Then route:

| Condition | Route |
|-----------|-------|
| build or refactor AND score < 20 | Invoke `/brain-task` directly (Haiku, no plan) with task_id from dev-context |
| build or refactor AND score ≥ 20 | Invoke `/brain-plan` — passes task_id so brain-plan reads dev-context |
| fix-investigate / debug / review / question | Invoke `/brain-consult` with task description |
| fix-known | Invoke `/brain-task` directly (same as build < 20) |

---

## Phase 3: Subagent Dispatch

**This phase runs only after brain-plan returns an approved plan.**

brain-plan writes the plan to `.brain/working-memory/implementation-plan-{task_id}.md` and presents it to the developer. After developer approves, brain-dev orchestrates execution.

### Step 3a: Parse plan into task list (automated)

```bash
node scripts/brain-parse-plan.js .brain/working-memory/implementation-plan-{task_id}.md
```

This outputs a JSON array. Create a TodoWrite entry for each task.

### Step 3b: Dispatch brain-task subagents (sequential — one at a time)

For each task in order:

**1. Dispatch implementer subagent:**

```
Agent(
  model: {model from plan's per-step recommendation, default sonnet},
  description: "Implement Task {N}: {title}",
  prompt: """
You are implementing Task {N}: {title}

## Task Description

{paste FULL task text from plan here — every step, every code block}

## Context

This task is part of: {overall plan goal, 1 sentence}
Previous task completed: {title of previous task, or "none — this is the first task"}

## Brain Context

Read `.brain/working-memory/context-packet-{task_id}.md` for the loaded sinapses and brain context (created by brain-map at Step 1).

## Your Job

1. Implement exactly what the task specifies
2. Write tests first (TDD: write failing test → run it → implement → run again)
3. Commit your work
4. Self-review (completeness, quality, no over-building)
5. Report back:
   - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
   - What you implemented
   - Files changed
   - Test results
   - Any concerns

Never silently produce work you are unsure about. DONE_WITH_CONCERNS is always better than pretending everything is fine.
"""
)
```

**2. Handle implementer status:**
- `DONE`: proceed to spec review
- `DONE_WITH_CONCERNS`: read concerns, decide if they need addressing before review
- `NEEDS_CONTEXT`: provide missing context, re-dispatch same task
- `BLOCKED`: provide more context or re-dispatch with a more capable model; if task is too large, break it down

**3. Dispatch spec-compliance reviewer:**

```
Agent(
  model: "haiku",
  description: "Spec review: Task {N}: {title}",
  prompt: """
Review the implementation of Task {N}: {title} for spec compliance.

## What to check

Run `git diff HEAD~1` to see exactly what changed. Then verify against the task requirements:

1. Was EVERYTHING in the spec implemented? List any gaps.
2. Was ANYTHING added that was NOT in the spec? List extras.
3. Do the tests actually verify the specified behaviour (not just mock it)?

## Output format

✅ COMPLIANT — all requirements met, nothing extra added

OR

❌ ISSUES:
- Missing: {description}
- Missing: {description}
- Extra: {description}
"""
)
```

If ❌: re-dispatch brain-task implementer with specific fix instructions. Then re-review (dispatch spec reviewer again). Repeat until ✅.

**4. Dispatch code-quality reviewer:**

```
Agent(
  model: "haiku",
  description: "Quality review: Task {N}: {title}",
  prompt: """
Review Task {N}: {title} for code quality.

Run `git diff HEAD~1` to see exactly what changed.
Read only the changed files.

## Check for

1. Bugs or logic errors (be specific — reference line numbers)
2. Names that are unclear or misleading
3. YAGNI violations (features that were NOT asked for)
4. Tests that only mock behaviour without verifying real outcomes

## Output format

✅ APPROVED — implementation is solid

OR

⚠️ ISSUES:
  Important (must fix): {specific issue with file/line}
  Minor (optional): {observation}

Only report Important issues that genuinely require fixing.
"""
)
```

If Important issues: re-dispatch brain-task implementer to fix. Re-review (dispatch quality reviewer again). Repeat until ✅.

**5. Mark task complete in TodoWrite. Move to next task.**

### Step 3c: Post-execution

After all tasks complete:
- Check session context: did any implementation surface a new pattern, unexpected behaviour, or recurring failure?
- If yes: suggest `/brain-lesson` to capture the learning
- Run `/brain-status` to verify brain health

---

## What brain-dev Does NOT Do

| Anti-Pattern | Why | Correct behaviour |
|---|---|---|
| Asking questions before classifying | Classification is always first | Classify silently, only ask if intent is truly unclassifiable |
| Routing trivial tasks (score < 20) to brain-plan | Overkill for Haiku-level work | Route directly to brain-task |
| Dispatching parallel subagents | Git conflicts, hard to review | Always sequential — fresh context is the speed gain |
| Re-loading sinapses in brain-dev | brain-dev is a pure classifier, not a context loader | Context loading is owned by brain-map via brain-task Step 1 |
| Starting execution before plan is approved | Developer loses control | brain-plan presents plan → approval required → then dispatch |
| Implementing anything itself | brain-dev is a router, not a worker | All implementation goes through brain-task |

---

**Created:** 2026-03-27 | **Updated:** 2026-03-28 | **Replaces:** brain-decision (deleted), brain-aside (deleted) | **Version:** v0.9.1
