---
name: brain-dev
description: Primary entry point for ALL developer requests — build, fix, debug, review, question, refactor. Pure classifier (~500-800 tokens, zero DB queries). Extracts retrieval keywords, routes to brain-plan (build/refactor), brain-consult (fix-investigate/debug/review/question), or brain-task directly (trivial builds score < 20, fix-known).
---

# brain-dev — Intelligent Entry Point

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

**Use this for everything.** Build, fix, investigate, question, refactor — start here. brain-dev classifies your request in ~500-800 tokens (zero DB queries), extracts retrieval keywords, and routes to the right skill. You don't need to think about which skill to call.

---

## Phase 1: Classify + Evaluate (silent — output nothing until Phase 2)

### Step 1a: Generate task_id

```
task_id = YYYY-MM-DD-{slug}
slug = max 20 chars, kebab-case, derived from task description
Example: "implement product recommendations" → 2026-03-27-product-recommendations
```

**State update:** Write `current_skill: "brain-dev"` to `.brain/working-memory/brain-state.json`.

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

**When the disambiguation has bounded answers, use `AskUserQuestion`:**

```
AskUserQuestion(
  questions: [{
    question: "{disambiguation question, e.g., 'Is this a bug fix or a new feature?'}",
    header: "Intent",
    options: [
      { label: "{option 1, e.g., 'Bug fix'}", description: "{what this routes to}" },
      { label: "{option 2, e.g., 'New feature'}", description: "{what this routes to}" }
    ],
    multiSelect: false
  }]
)
```

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
recent_task: {last_task_id or null}
created_at: {ISO8601}
---

{developer's original request, verbatim — do not paraphrase}
```

No sinapses. No concerns. No brain evaluation. Just classification metadata + keywords. Context loading is owned by brain-map (called from brain-task Step 1).

**If intent is fix-investigate or debug AND recent_task is set**, append after the request:

## Previous Task
Description: {previous_description}
Files changed: {previous_files}
Tests: {previous_tests}

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

| Condition | Route | State Update |
|-----------|-------|-------------|
| build or refactor AND score < 20 | Invoke `/brain-task` directly (Haiku, no plan) with task_id from dev-context | Set `current_skill: "brain-task"` before invoking |
| build or refactor AND score ≥ 20 | Invoke `/brain-plan` — passes task_id so brain-plan reads dev-context | Set `current_skill: "brain-plan"` before invoking |
| fix-investigate / debug / review / question | Invoke `/brain-consult` — pass task_id so brain-consult reads dev-context-{task_id}.md (includes ## Previous Task on debug/fix-investigate) | Set `current_skill: "brain-consult"` before invoking |
| fix-known | Invoke `/brain-task` directly (same as build < 20) | Set `current_skill: "brain-task"` before invoking |

**After invoking the next skill, brain-dev's job is DONE. Do not resume. Do not wait for the result. The invoked skill takes ownership of the pipeline.**

---

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

---

**Created:** 2026-03-27 | **Updated:** 2026-03-29 | **Replaces:** brain-decision (deleted), brain-aside (deleted) | **Version:** v1.2.0
