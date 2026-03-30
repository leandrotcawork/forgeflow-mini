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

## Step 1: Check Circuit Breaker

Read `.brain/working-memory/brain-project-state.json`.
If circuit breaker state is `OPEN` -> **stop** and inform the user. Do not route.

## Step 2: Classify Request

Determine silently (no output yet):

- **task_id:** `YYYY-MM-DD-{slug}` (slug = kebab-case, max 20 chars)
- **intent:** build | refactor | fix | investigate | question | review | debug
- **complexity score:** 0-100 (see `references/routing-rules.md`)
- **keywords:** 3-5 nouns/domain terms extracted from request
- **domain:** backend | frontend | database | infra | cross-domain

If intent is truly unclassifiable after reading the request, ask ONE clarifying question, then proceed.

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

## Step 4: Route

Output the routing decision to the developer:

```
brain-dev: {task_id}
  Intent: {intent} | Domain: {domain} | Score: {N}
  Routing to: {target skill}
```

Then invoke the target skill:

| Condition | Route |
|---|---|
| question / investigate / review / debug | `/brain-consult` |
| build or refactor, score >= 20 | `/brain-map` then `/brain-plan` |
| build or fix, score < 20 | `/brain-task` (inline, no plan) |
| unsure / ambiguous | `/brain-consult` (safe default) |

See `references/routing-rules.md` for the full decision tree, intent classification table, and complexity scoring guide.

## Rules

- **Classifier only** — no codebase exploration, no implementation
- **~200 tokens footprint** — classify fast, route fast
- **Default to brain-consult** if intent is uncertain
- **Every build/refactor score >= 20 goes through brain-plan** — no shortcuts
- **After routing, brain-dev is done** — the invoked skill owns the pipeline

---

**References:** [routing-rules.md](references/routing-rules.md)
