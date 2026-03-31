---
name: brain-dev
description: Smart router for development requests. Classifies intent, scores complexity, and routes to the right skill. Pure classifier — no code exploration, no implementation.
---

# brain-dev — Smart Router

> **Trigger:** `/brain-dev <request>`

<HARD-GATE>
brain-dev is a CLASSIFIER ONLY. You MUST NOT:
- Explore the codebase (no Read/Grep/Glob on source files)
- Write plans or implement anything
- Skip brain-plan for score >= 20 build/refactor tasks

Your ONLY job: classify -> score -> extract keywords -> write dev-context -> route.
After routing, brain-dev is DONE. Do not resume.
Target footprint: ~200 tokens.
</HARD-GATE>

## RED FLAGS — Stop and re-read if you think any of these

| Thought | Reality |
|---------|---------|
| "I'll peek at the files to score this better" | STOP. Classifier only. Score from the request text. |
| "Score is borderline, I'll just skip brain-plan" | STOP. Score >= 20 build/refactor ALWAYS goes through brain-plan. |
| "The routing table doesn't cover this — I'll decide" | STOP. If unsure, route to brain-consult. |
| "This is a quick fix, brain-task directly" | Only if intent=fix AND score < 20. Otherwise brain-plan. |

---

## Step 1: Check Circuit Breaker

Read `.brain/progress/brain-project-state.json`.

**STOP immediately if `circuit_breaker.state` is `"open"`:**
> Output: "brain-dev: Circuit breaker OPEN. Consecutive failures: {circuit_breaker.failure_count}. Not routing until user resolves blockers."
> Do nothing else.

---

## Step 2: Classify Request

Determine silently (no output yet):

### Intent Classification

| Intent | Signals | Route |
|--------|---------|-------|
| **build** | "implement", "add", "create", "build", "make" | brain-map + brain-plan (score >= 20) or brain-task (score < 20) |
| **refactor** | "refactor", "clean up", "improve", "optimise", "restructure" | brain-map + brain-plan (score >= 20) or brain-task (score < 20) |
| **fix** | Specific, named change: "fix X in Y", "change X to Y" | brain-task directly |
| **investigate** | Symptom: "not working", "getting error", "fails", "broken" | brain-consult |
| **question** | "how does", "explain", "what is", "can we" | brain-consult |
| **review** | "is this right", "should we", "best approach", "review" | brain-consult |
| **debug** | "why is", "trace", "debug", "investigate", "isn't working" | brain-consult |

### Complexity Scoring

```
score = 15 (baseline)
  + domain:  cross-domain +30 | backend +10 | other +0
  + risk:    critical +35 | high +20 | medium +5 | low +0
  + type:    architectural +20 | debugging +15 | unknown_pattern +10
  = min(total, 100)
```

**Domain scoring note:** `mcp` and `skills` domains score as `backend (+10)`.

| Range | Route |
|-------|-------|
| 0–19 | brain-task inline (no plan) |
| 20–74 | brain-map + brain-plan |
| 75–100 | brain-map + brain-plan (deep) |

### Keyword Extraction

- Pick 3–5 nouns and domain terms, not verbs
- "fix the auth token refresh" → `["auth", "token", "refresh"]`
- Max 5 keywords — more dilutes retrieval precision
- Vague requests → use domain name as keyword (e.g., `["backend"]`)

Fields to determine:
- **task_id:** `YYYY-MM-DD-{slug}` (slug = kebab-case, max 20 chars)
- **intent:** build | refactor | fix | investigate | question | review | debug
- **score:** 0–100 (use formula above)
- **keywords:** 3–5 nouns
- **domain:** backend | frontend | database | infra | mcp | skills | cross-domain

If intent is truly unclassifiable after reading the request, ask ONE clarifying question, then proceed.

---

## Step 3: Create dev-context

Write `.brain/working-memory/dev-context-{task_id}.md`:

```yaml
---
task_id: {task_id}
intent: {intent}
domain: {domain}
score: {N}
keywords: ["{kw1}", "{kw2}", "{kw3}"]
created_at: {ISO8601}
---

{developer's original request, verbatim}
```

Update `current_skill: "brain-dev"` in `.brain/working-memory/brain-state.json`.

---

## Step 4: Route

Output the routing decision:

```
brain-dev: {task_id}
  Intent: {intent} | Domain: {domain} | Score: {N}
  Routing to: {target skill}
```

### Routing Decision Tree

```
1. intent = question / investigate / review / debug?
   YES → invoke brain-consult. DONE.

2. intent = fix (specific, named change)?
   score < 20  → invoke brain-task directly. DONE.
   score >= 20 → invoke brain-map, then brain-plan. DONE.

3. intent = build or refactor?
   score < 20  → invoke brain-task inline (no plan). DONE.
   score >= 20 → invoke brain-map, then brain-plan. DONE.

4. Anything else → invoke brain-consult (safe default). DONE.
```

**After invoking the target skill, brain-dev is DONE. Do not resume.**
