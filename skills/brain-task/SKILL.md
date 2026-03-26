---
name: brain-task
description: Full task orchestration — context assembly → implementation → documentation → archival + cleanup
---

# brain-task — EXECUTE THESE STEPS IN ORDER

**This is not a reference document. These are instructions. Execute them sequentially. Do not skip steps. Do not "go straight to implementation." Every step produces a concrete artifact that the next step depends on.**

## HARD RULE: No step can be skipped

```
GATE 0: brain-decision MUST run first (classifies complexity, selects model)
GATE 1: context-packet-{task_id}.md MUST exist before Step 2
GATE 2: [model]-context-{task_id}.md MUST exist before Step 3 (except Haiku — context-packet is sufficient)
GATE 3: Implementation MUST use the context file as its brief — not your own judgment
```

**If you catch yourself about to write code without having created the context files above, STOP. You are skipping the pipeline. Go back to Step 1.**

---

## Step 0: Route through brain-decision (MANDATORY)

If brain-decision has NOT already run for this task, invoke `/brain-decision` NOW. Do not proceed.

brain-decision will return:
- `task_id` (YYYY-MM-DD-slug)
- `complexity_score` (0-100)
- `model` (haiku | sonnet | codex | opus)
- `domain` (backend | frontend | database | infra | analytics | cross-domain)
- `plan_mode` (true | false)

**You need these values for every subsequent step. Do not guess them.**

---

## All artifacts go to `.brain/working-memory/`

| Step | You MUST create this file | Location |
|------|--------------------------|----------|
| 1 | `context-packet-{task_id}.md` | `.brain/working-memory/` |
| 2 | `[model]-context-{task_id}.md` | `.brain/working-memory/` |

Never save task artifacts to `tasks/`, `docs/`, or `.brain/cortex/`. Those are permanent locations. Task artifacts are ephemeral.

---

## Execution Modes (determined by brain-decision)

| Model | Context File | Sinapses | Token Budget |
|-------|-------------|----------|-------------|
| **Haiku** (score < 20) | None (context packet sufficient) | Tier 1 only | 8-15k |
| **Sonnet** (score 20-40) | `sonnet-context-{task_id}.md` | Tier 1 + 2 (max 5) | 30-60k |
| **Codex** (score 40-75) | `codex-context-{task_id}.md` | Tier 1 + 2 (+ Tier 3 if critical) | 100-150k |
| **Opus** (debugging) | `opus-debug-context-{task_id}.md` | Tier 1 + 2 | 120-150k |

If Sonnet fails after 2 attempts, escalate to Codex. Log the escalation.

---

# EXECUTE THESE STEPS NOW

## Step 1: Load Context — DO THIS FIRST

Do these actions NOW. Do not skip to implementation.

1. Read `.brain/hippocampus/architecture.md` and `.brain/hippocampus/conventions.md` (condensed — key patterns only)
2. Query brain.db for domain sinapses: `SELECT * FROM sinapses WHERE region LIKE '%{domain}%' ORDER BY weight DESC LIMIT 5`
3. Query brain.db for top 3 lessons matching the task domain
4. Write all of the above into `.brain/working-memory/context-packet-{task_id}.md`

**For Haiku (lightweight) tasks:** Load Tier 1 only (hippocampus + lessons, ~4k tokens). Skip Tier 2.

**For Tier 3 (score >= 75 or critical):** Also load linked sinapses: `SELECT target_id FROM sinapse_links WHERE source_id IN (...) LIMIT 3`

**GATE CHECK:** Does `.brain/working-memory/context-packet-{task_id}.md` exist now? If NO, you skipped this step. Go back.

---

## Step 2: Generate Execution Context — DO THIS BEFORE ANY CODE

Using the context-packet from Step 1, create the model-specific context file. If plan mode is active, also read `working-memory/implementation-plan-{task_id}.md` and incorporate it.

**For Sonnet** (standard single-domain tasks, score 20-40):

Create: `working-memory/sonnet-context-{task_id}.md`

```markdown
---
task_id: YYYY-MM-DD-<slug>
complexity_score: [20-40 from brain-decision]
model: sonnet
domain: [backend | frontend | database | infra | analytics]
created_at: [ISO8601]
---

## Task

[Task description from user]

## Acceptance Criteria

- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]
- [ ] Tests passing
- [ ] No linting errors
- [ ] Follows conventions from hippocampus/conventions.md

## Context: Relevant Sinapses

### Architecture Patterns

(From Tier 1+2 sinapses loaded in Step 1, max 5)
- [[sinapse-id]] **[Title]**: [how to apply this pattern]

### Code Example from Codebase

(Extract 1-2 real code snippets matching the pattern)

#### Example: [Pattern Name]
\`\`\`go
// From: apps/server_core/internal/modules/[module]/[file].go
[actual code snippet - 5-10 lines]
\`\`\`

## Common Mistakes (DO NOT DO)

- ❌ [Mistake from hippocampus/conventions.md]
  → Instead, use [correct pattern]

---
```

**Sonnet escalation:** If implementation fails tests after 2 attempts, escalate to Codex. Log: `escalated: sonnet → codex (reason: [test failures | incomplete implementation])` in the task-completion record.

---

**For Codex** (complex tasks, score 40+):

Create: `working-memory/codex-context-{task_id}.md`

```markdown
---
task_id: YYYY-MM-DD-<slug>
complexity_score: [0-100 from brain-decision]
model: codex
domain: [backend | frontend | database | infra | analytics | cross-domain]
created_at: [ISO8601]
---

## Task

[Task description from user]

## Acceptance Criteria

- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]
- [ ] Tests passing
- [ ] No linting errors
- [ ] Follows conventions from hippocampus/conventions.md

## Context: Relevant Sinapses

### Architecture Patterns

(From Tier 1+2 sinapses loaded in Step 1)
- [[sinapse-id]] **[Title]**: [how to apply this pattern]
- [[sinapse-id]] **[Title]**: [another pattern]

### Code Examples from Codebase

(Extract 2-3 real code snippets from actual files matching the pattern)

#### Example 1: [Pattern Name]
\`\`\`go
// From: apps/server_core/internal/modules/[module]/[file].go
// This is the CORRECT pattern for X:

[actual code snippet - 5-10 lines]
\`\`\`

#### Example 2: [Pattern Name]
\`\`\`typescript
// From: apps/web/src/[component].tsx
// This is how we do Y:

[actual code snippet - 5-10 lines]
\`\`\`

## Common Mistakes (DO NOT DO)

- ❌ [Mistake pattern 1 from hippocampus/conventions.md]
  → Instead, use [correct pattern from sinapse]
- ❌ [Mistake pattern 2 from a lesson-XXXX.md]
  → See [[sinapse-id]] for correct approach

## Previous Similar Work

(If domain has related lessons)
- See: cortex/[domain]/lessons/lesson-0042.md — "Same pattern, different context"
- See: cortex/[domain]/lessons/lesson-00NN.md — "Similar failure case"

## Brain Health Status

- Region: cortex/[domain]
- Sinapses in region: [N]
- Average weight: [0.XX]
- Last updated: [date]
- Staleness: [healthy | stale | very stale]
- Related escalations: [escalation-XXXXX.md if any]

---
```

**For Opus** (debugging only):

Create: `working-memory/opus-debug-context-{task_id}.md`

```markdown
---
task_id: YYYY-MM-DD-<slug>
model: opus
debug: true
created_at: [ISO8601]
---

## Problem

[Error message + full stack trace]

## What Was Attempted

- [Attempt 1: result]
- [Attempt 2: result]
- [Attempt 3: result]

## Context: Related Patterns & Lessons

### Debugging Patterns
- [[sinapse-id]] [Pattern]: [how this relates to error]

### Similar Issues
(From cortex/<domain>/lessons/ or lessons/cross-domain/ matching error keywords)
- cortex/[domain]/lessons/lesson-0035.md — "Same error, different module"
- cortex/backend/lessons/lesson-0042.md — "Root cause was X"

---
```

**GATE CHECK:** Does `.brain/working-memory/[model]-context-{task_id}.md` exist now? (For Haiku, does `context-packet-{task_id}.md` exist?) If NO, you skipped this step. Go back.

---

## Step 2.5: McKinsey Gate (architectural tasks only)

If task type is `architectural` AND plan mode is active, invoke `/brain-mckinsey` before implementation. The mckinsey output card (`working-memory/mckinsey-output.md`) provides strategic scoring, external benchmarks, and 3 alternatives. Use the recommended option to inform implementation priorities. Skip this for non-architectural tasks.

---

## Step 3: Implement — NOW you can write code

**You MUST have the context file from Step 2 open. Read it. Follow its acceptance criteria, sinapses, and "DO NOT" list as you implement.**

#### Sonnet / Claude fallback:
1. Read the context file fully
2. Implement following the patterns and guard rails in the context file
3. Run tests after implementation
4. If tests fail after 2 attempts → escalate to Codex (regenerate context with more examples)

#### Codex (via MCP):
1. Call `codex` or `codex-cli` MCP tool with `context_file: working-memory/codex-context-{task_id}.md`
2. Review Codex output — accept, reject, or partial accept
3. If MCP unavailable: fall back to Claude implementing directly using the context file as brief

#### Opus (debugging):
1. Read the opus-debug-context file
2. Root cause analysis using the patterns and similar issues listed
3. Propose and execute fix

---

## After Implementation: TaskCompleted hook handles the rest

**You do NOT run Steps 4-6 manually.** The TaskCompleted hook in `.claude/settings.json` fires automatically and runs:

1. Creates `working-memory/task-completion-[task-id].md`
2. Invokes `/brain-document` → proposes `sinapse-updates-[task-id].md`
3. Archives context files to `progress/completed-contexts/`
4. Appends entry to `progress/activity.md`
5. Updates MEMORY.md if a durable project fact was established
6. Commits all changes via `/commit`
7. If 5+ tasks accumulated → suggests `/brain-consolidate`

**If the hook does NOT fire** (no task-completion file created, no activity.md entry), the hooks are not configured. Run `/brain-init` to install them.

---

---

## Quick Reference

### Flags
| Flag | Effect |
|------|--------|
| `/brain-task [description]` | brain-decision first → route → Steps 1→3 → hook |
| `--sonnet` | Force Sonnet model |
| `--debug` | Force Opus debugging mode |
| `--plan` | Force plan mode before Step 1 |
| `--lightweight` | Haiku mode: Tier 1 only |

### Files Created

| Step | File | Archived by hook to |
|------|------|---------------------|
| 1 | `working-memory/context-packet-{task_id}.md` | cleaned up |
| 2 | `working-memory/[model]-context-{task_id}.md` | `progress/completed-contexts/` |
| hook | `working-memory/task-completion-{task_id}.md` | `progress/completed-contexts/` |
| hook | `working-memory/sinapse-updates-{task_id}.md` | cleaned up |

---

## The #1 failure mode

**Skipping Steps 1-2 and going straight to implementation.** This has happened. The agent reads this skill, understands the concept, then defaults to its own workflow (launch Explore agents, write code directly). The context files never get created. The hook has nothing to archive. No sinapses are proposed. The entire learning loop breaks.

**The fix is the gates above.** If `context-packet-{task_id}.md` doesn't exist, Step 2 cannot run. If `[model]-context-{task_id}.md` doesn't exist, Step 3 cannot run. Treat these as hard dependencies, not suggestions.

---

**Created:** 2026-03-25 | **Agent Type:** Orchestrator | **Last Updated:** 2026-03-25
