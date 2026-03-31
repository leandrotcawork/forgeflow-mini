---
name: brain-dev
description: Router only for development requests. Classifies intent from request text and routes to brain-consult or brain-spec without source exploration or implementation.
---

# brain-dev -- Router Only

> **Trigger:** `/brain-dev <request>`

<HARD-GATE>
brain-dev is router only. You MUST NOT:
- Explore the codebase or inspect source files
- Write specs, plans, reviews, or source code
- Route directly to brain-plan, brain-task, or brain-review

brain-dev may write routing artifacts only:
- `.brain/working-memory/dev-context-{task_id}.md`
- `.brain/working-memory/brain-state.json`

Your only job: classify -> score -> extract keywords -> write dev-context -> update brain-state -> route.
After routing, brain-dev is DONE.
</HARD-GATE>

## Step 1: Classify Request

Determine silently from the request text only.

### Routing Table

| Intent | Signals | Route |
|---|---|---|
| **consult** | asks for guidance, tradeoffs, explanation | brain-consult |
| **question** | "how", "what", "why", "can we" | brain-consult |
| **review** | review, assess, validate, sanity-check | brain-consult |
| **debug** | debug, trace, investigate failure, broken behavior | brain-spec |
| **fix** | change specific behavior, correct bug, patch | brain-spec |
| **build** | implement, add, create, build, make | brain-spec |
| **refactor** | refactor, restructure, clean up | brain-spec |
| **improve** | improve, optimize, harden, tighten | brain-spec |

If intent is ambiguous after reading the request, ask ONE clarifying question.
If still uncertain, route to **brain-consult**.

### Complexity Scoring

```
score = 15 (baseline)
  + domain: cross-domain +30 | backend +10 | other +0
  + risk:   critical +35 | high +20 | medium +5 | low +0
  + type:   architectural +20 | debugging +15 | unknown_pattern +10
  = min(total, 100)
```

Fields to determine:
- `task_id`: `YYYY-MM-DD-{slug}` (kebab-case, max 20 chars)
- `intent`: consult | question | review | debug | fix | build | refactor | improve
- `score`: 0-100
- `keywords`: 3-5 nouns or domain terms
- `domain`: backend | frontend | database | infra | mcp | skills | cross-domain

## Step 2: Write dev-context

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

{developer request, verbatim}
```

Update `current_skill: "brain-dev"` in `.brain/working-memory/brain-state.json`.

## Step 3: Route

Output:

```
brain-dev: {task_id}
  Intent: {intent} | Domain: {domain} | Score: {N}
  Routing to: {target skill}
```

Decision rule:

1. `consult`, `question`, `review` -> invoke `brain-consult`
2. `debug`, `fix`, `build`, `refactor`, `improve` -> invoke `brain-spec`
3. Anything unclear -> invoke `brain-consult`

brain-dev never resumes after routing.
