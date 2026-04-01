---
name: brain-dev
description: Entry point for all development requests. Classifies intent, initializes workflow state, and routes to brain-spec or brain-consult. Never implements, never plans.
---

# brain-dev — Classifier and Router

> **Trigger:** `/brain-dev <request>`

<HARD-GATE>
brain-dev is a classifier only. You MUST NOT:
- Explore the codebase
- Write specs, plans, or code
- Route to brain-plan or brain-task directly
- Make implementation decisions

You may only write:
- `.brain/working-memory/dev-context-{task_id}.md`
- `.brain/working-memory/workflow-state.json`
- `.worktrees/{task_id}` (via `git worktree add` only)
</HARD-GATE>

## Step 1: Classify Intent

Determine from the request text only — no codebase reads.

| Intent | Signals | Route |
|--------|---------|-------|
| build | implement, add, create, build, make | brain-spec |
| fix | change behavior, correct bug, patch | brain-spec |
| refactor | refactor, restructure, clean up | brain-spec |
| improve | improve, optimize, harden, tighten | brain-spec |
| debug | debug, trace, investigate, broken behavior | brain-spec |
| consult | guidance, tradeoffs, explanation, "how", "what", "why", "can we" | brain-consult |
| review | review, assess, validate, sanity-check | brain-consult |

If intent is ambiguous, ask ONE clarifying question before routing.
If still uncertain, route to brain-consult.

Fields to determine:
- `task_id`: `YYYY-MM-DD-{slug}` (kebab-case slug from request, max 20 chars)
- `intent`: one of the values above
- `keywords`: 3-5 domain nouns from the request
- `domain`: backend | frontend | database | infra | mcp | skills | cross-domain

## Step 2: Write dev-context

Write `.brain/working-memory/dev-context-{task_id}.md`:

```yaml
---
task_id: {task_id}
intent: {intent}
domain: {domain}
keywords: ["{kw1}", "{kw2}", "{kw3}"]
created_at: {ISO8601}
---

{developer request, verbatim}
```

## Step 3: Initialize workflow-state

Write `.brain/working-memory/workflow-state.json`:

```json
{
  "task_id": "{task_id}",
  "worktree_name": null,
  "branch_name": null,
  "intent": "{intent}",
  "phase": "SPEC_PENDING",
  "spec_status": "pending",
  "plan_status": "pending",
  "review_status": "pending",
  "verify_status": "pending",
  "allowed_files": [],
  "needs_user_approval": true,
  "commit_sha": null,
  "last_error": null
}
```

## Step 3.5: Create Worktree (code-writing intents only)

For intents: build, fix, refactor, improve, debug — create an isolated worktree before routing.

```bash
git worktree add .worktrees/{task_id} -b forgeflow/{task_id}
```

This creates:
- Worktree at `.worktrees/{task_id}` (gitignored — never committed)
- Branch `forgeflow/{task_id}` for isolated work

After creating the worktree, update `workflow-state.json` with the worktree and branch names:

```json
{
  "worktree_name": ".worktrees/{task_id}",
  "branch_name": "forgeflow/{task_id}"
}
```

If the worktree already exists (re-entry), skip creation and read the existing names.

For consult and review intents: skip this step — no worktree needed.

## Step 4: Route

- intent in [build, fix, refactor, improve, debug] → invoke brain-spec
- intent in [consult, review] → invoke brain-consult

brain-dev is done after routing. brain-dev does not wait for the result.
