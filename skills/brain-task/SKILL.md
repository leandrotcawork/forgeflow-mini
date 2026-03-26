---
name: brain-task
description: Full task orchestration — circuit breaker check, state persistence, context assembly, implementation (inline or subagent), verification, documentation, archival + cleanup
---

# brain-task — EXECUTE THESE STEPS IN ORDER

**This is not a reference document. These are instructions. Execute them sequentially. Do not skip steps. Do not "go straight to implementation." Every step produces a concrete artifact that the next step depends on.**

## HARD RULE: No step can be skipped

```
GATE 0: brain-decision MUST run first (classifies complexity, selects model)
GATE 1: context-packet-{task_id}.md MUST exist before Step 2
GATE 2: [model]-context-{task_id}.md MUST exist before Step 3 (except Haiku — context-packet is sufficient)
GATE 3: Implementation MUST use the context file as its brief — not your own judgment
GATE 4: Steps 4-6 (post-task) MUST run inline after Step 3 — NEVER wait for a hook
GATE 5: State persistence — brain-state.json MUST be updated at every checkpoint listed below
```

**Architecture principle:** This skill is fully self-contained. Every step runs inline, in order, in the same session. Subagent dispatch is an optimization — the pipeline never depends on it. If a subagent fails or is unavailable, execution falls back to inline. No external hooks are required. If hooks exist, they serve as optional observers — never as workflow drivers.

**If you catch yourself about to write code without having created the context files above, STOP. You are skipping the pipeline. Go back to Step 1.**

---

## Pre-Step: Circuit Breaker Check (MANDATORY)

Before anything else, read `.brain/progress/brain-project-state.json` and check the `circuit_breaker` object.

```
IF circuit_breaker.state == "open" AND now < cooldown_until:
  BLOCK execution.
  Output: "CIRCUIT BREAKER OPEN: Pipeline blocked until {cooldown_until} ({remaining} remaining).
           Reason: {failure_count} consecutive failures. Wait for cooldown or investigate root cause."
  STOP. Do not proceed to Step 0.

IF circuit_breaker.state == "half-open":
  ALLOW execution but log: "CIRCUIT BREAKER HALF-OPEN: This execution is a probe. If it fails, breaker re-opens."
  Continue to Step 0. Track this as a probe — result determines breaker state at end.

IF circuit_breaker.state == "closed":
  Continue normally.
```

---

## Pre-Step: Interrupted Task Check

Read `.brain/working-memory/brain-state.json`. If `current_pipeline_step > 0`:

```
WARNING: Interrupted task detected.
  Task: {last_task_id}
  Interrupted at: Step {current_pipeline_step}
  Context files: {active_context_files}

Options:
  1. RESUME from Step {current_pipeline_step} (recommended if context files still exist)
  2. RESTART from Step 0 (if context is stale or task changed)
  3. ABANDON interrupted task and start fresh (resets state)

Output this warning and wait for developer direction before proceeding.
If no developer input (autonomous mode), attempt RESUME if context files exist, otherwise RESTART.
```

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

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "last_task_id": "{task_id}",
  "current_pipeline_step": 0,
  "active_context_files": [],
  "snapshot_reason": "brain-decision complete"
}
```
Also write `task_id`, `model`, `domain`, and `complexity_score` as reference fields in state (or use `last_task_id` to correlate).

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
| **Sonnet** (score 20-39) | `sonnet-context-{task_id}.md` | Tier 1 + 2 (max 5) | 30-60k |
| **Codex** (score 40-74) | `codex-context-{task_id}.md` | Tier 1 + 2 (+ Tier 3 if critical) | 100-150k |
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

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "current_pipeline_step": 1,
  "active_context_files": ["context-packet-{task_id}.md"],
  "snapshot_reason": "context loaded"
}
```

**Compaction advice:** SAFE to compact after this step. Context packet is on disk.

---

## Step 2: Generate Execution Context — DO THIS BEFORE ANY CODE

Using the context-packet from Step 1, create the model-specific context file. If plan mode is active, also read `working-memory/implementation-plan-{task_id}.md` and incorporate it.

**For Sonnet** (standard single-domain tasks, score 20-39):

Create: `working-memory/sonnet-context-{task_id}.md`

```markdown
---
task_id: YYYY-MM-DD-<slug>
complexity_score: [20-39 from brain-decision]
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

- [Mistake from hippocampus/conventions.md]
  -> Instead, use [correct pattern]

---
```

**Sonnet escalation:** If implementation fails tests after 2 attempts, escalate to Codex. Log: `escalated: sonnet -> codex (reason: [test failures | incomplete implementation])` in the task-completion record.

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

- [Mistake pattern 1 from hippocampus/conventions.md]
  -> Instead, use [correct pattern from sinapse]
- [Mistake pattern 2 from a lesson-XXXX.md]
  -> See [[sinapse-id]] for correct approach

## Previous Similar Work

(If domain has related lessons)
- See: cortex/[domain]/lessons/lesson-0042.md -- "Same pattern, different context"
- See: cortex/[domain]/lessons/lesson-00NN.md -- "Similar failure case"

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
- cortex/[domain]/lessons/lesson-0035.md -- "Same error, different module"
- cortex/backend/lessons/lesson-0042.md -- "Root cause was X"

---
```

**GATE CHECK:** Does `.brain/working-memory/[model]-context-{task_id}.md` exist now? (For Haiku, does `context-packet-{task_id}.md` exist?) If NO, you skipped this step. Go back.

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "current_pipeline_step": 2,
  "active_context_files": ["context-packet-{task_id}.md", "{model}-context-{task_id}.md"],
  "snapshot_reason": "execution context generated"
}
```

**Compaction advice:** SAFE to compact after this step. All context is on disk.

---

## Step 2.5: McKinsey Gate (architectural tasks only)

If task type is `architectural` AND plan mode is active, invoke `/brain-mckinsey` before implementation. The mckinsey output card (`working-memory/mckinsey-output.md`) provides strategic scoring, external benchmarks, and 3 alternatives. Use the recommended option to inform implementation priorities. Skip this for non-architectural tasks.

---

## Step 3: Implement — NOW you can write code

**You MUST have the context file from Step 2 open. Read it. Follow its acceptance criteria, sinapses, and "DO NOT" list as you implement.**

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "current_pipeline_step": 3,
  "snapshot_reason": "implementation started"
}
```

**Compaction advice:** DO NOT compact during this step. Implementation is in progress and requires full context window.

### Dispatch Decision Tree

The implementation strategy depends on the model tier assigned by brain-decision. Choose the matching path below.

---

### Path A: Haiku (score < 20) — Execute INLINE

1. Read the context-packet file
2. Implement following the patterns in the context packet
3. No formal quality gate — proceed directly to Step 3.5 (verification)

---

### Path B: Sonnet (score 20-39) — Dispatch SUBAGENT (with inline fallback)

**Step B.1: Assemble subagent prompt**

Build a self-contained prompt for the subagent. The subagent has NO access to your conversation context, so everything it needs must be in the prompt:

- Inline the FULL contents of `context-packet-{task_id}.md` (not a file path — paste the actual text)
- Inline the FULL contents of `sonnet-context-{task_id}.md` (not a file path — paste the actual text)
- Include condensed conventions from `.brain/hippocampus/conventions.md` (key patterns, 10-20 lines)
- Include 1-2 real code examples from the codebase (already in the context file)
- Include the acceptance criteria from the context file

**Step B.2: Dispatch subagent**

```
Agent(model: "sonnet", description: "Implement: {task_description}")
```

Record in `brain-state.json`:
```json
{
  "subagents_dispatched": [{"task_id": "{task_id}", "model": "sonnet", "status": "running"}]
}
```

**Step B.3: Read subagent result**

- **DONE:** Verify files exist on disk, proceed to Step 3.5 (verification)
- **DONE_WITH_CONCERNS:** Review concerns. If safe, proceed to Step 3.5. If not safe, fix inline.
- **BLOCKED:** Provide more context (additional sinapses, more code examples), retry ONCE. If still blocked, fall back to inline execution (Step B.4).
- **Garbage / no useful output:** Fall back to inline execution (Step B.4).
- **Subagent unavailable or errors:** Fall back to inline execution (Step B.4).

Update `brain-project-state.json` subagent_usage counters accordingly.

**Step B.4: Inline fallback**

If subagent fails for any reason:
1. Log: `subagent failed, executing inline (reason: {reason})`
2. Read the context file fully
3. Implement following the patterns and guard rails in the context file
4. Proceed to Step 3.5

**The pipeline never breaks because of a subagent failure.** Inline execution is always available.

---

### Path C: Codex / Complex (score 40-74) — Execute INLINE

Complex tasks need the full context window. Execute inline.

1. Call `codex` or `codex-cli` MCP tool with `context_file: working-memory/codex-context-{task_id}.md`
2. Review Codex output — accept, reject, or partial accept
3. If MCP unavailable: fall back to Claude implementing directly using the context file as brief

After implementation completes and Step 3.5 verification passes, dispatch parallel subagents for post-implementation work:

```
Agent(model: "sonnet", description: "Code review: {task_id}") -- runs brain-codex-review
Agent(model: "haiku", description: "Propose sinapse updates: {task_id}") -- runs brain-document
```

These subagents are fire-and-forget optimizations. If they fail, their work runs inline in Steps 4-6 as normal. Record dispatches in `brain-state.json` subagents_dispatched array.

---

### Path D: Opus / Debugging — Execute INLINE

Debugging requires full codebase access and the complete context window. Always execute inline.

1. Read the opus-debug-context file
2. Root cause analysis using the patterns and similar issues listed
3. Propose and execute fix

---

### Path E: Plan Mode (score 75+) — Execute INLINE with plan

High-complexity tasks require planning first, then inline execution.

1. Read the implementation plan (`working-memory/implementation-plan-{task_id}.md`)
2. Execute each plan phase sequentially, following the context file
3. Checkpoint progress between phases

---

## Step 3.5: Verification Gate (ALL TASKS)

**This gate runs for every task, not just Codex.** It sits between implementation and the post-task sequence.

### Universal Verification (all tiers)

**1. Run tests**

Detect the test runner from the project:
- Check `package.json` for `scripts.test`
- Check for `Makefile` test targets
- Check for `pytest`, `go test`, `cargo test`, etc.
- If no test runner detected, skip automated tests but note it in the task-completion record

**2. If tests fail: retry with same strategy (once)**

Re-read the error output, fix the issue, run tests again.

**3. If tests fail again: trigger strategy rotation**

Read `strategy_rotation` from `.brain/working-memory/brain-state.json`. Advance `current_strategy` and retry:

```
Strategy 0 (default):    Follow sinapse patterns from context file
Strategy 1 (alternative): Find the most similar file in the codebase, copy its exact pattern
Strategy 2 (minimal):     Make the smallest possible change that satisfies acceptance criteria
Strategy 3 (escalate):    Bump model tier (Haiku->Sonnet, Sonnet->Codex, Codex->Opus)
Strategy 4 (human):       STOP. Report to developer with full diagnostic:
                           - What was attempted
                           - Which strategies failed
                           - Error output
                           - Recommended next steps
```

Update `brain-state.json` after each strategy attempt:
```json
{
  "strategy_rotation": {
    "task_id": "{task_id}",
    "current_strategy": N,
    "attempts": [
      {"strategy": 0, "result": "fail", "error": "..."},
      {"strategy": 1, "result": "fail", "error": "..."}
    ]
  },
  "consecutive_failures": N
}
```

**4. On success:** Reset `consecutive_failures` to 0 in `brain-state.json`. Reset `strategy_rotation.current_strategy` to 0.

### Additional Verification: Codex Path Only (score >= 40)

After tests pass, also invoke `/brain-codex-review` **inline** (unless already dispatched as subagent in Path C):

1. Run `/brain-codex-review` -> generates `working-memory/codex-review-{task_id}.md`
2. If review passes -> proceed to Step 4
3. If review finds auto-fixable issues -> fix and re-run tests
4. If review fails with manual-fix issues -> halt, report to developer, wait for direction
5. Re-run `/brain-codex-review` after fixes until clean

**Sonnet and Haiku tasks** skip the codex-review gate. Tests are their primary quality check.

---

## After Implementation: Post-task sequence

**After Step 3.5 completes, run the post-task sequence below DIRECTLY — do not wait for a hook.**

The `TaskCompleted` hook only fires when a Task tool subagent completes. When brain-task runs in the main session (the normal case), no hook fires. Always execute Steps 4-6 inline.

### Step 4: Create task-completion record

Create `.brain/working-memory/task-completion-{task_id}.md`:

```markdown
---
task_id: {task_id}
status: success | failed
model: {model}
created_at: {ISO8601}
---

## Task
{task description}

## Files Changed
{list files with rough line counts}

## Tests
{pass/fail/count or "no tests"}

## Sinapses Referenced
{list sinapse IDs loaded in Step 1}

## Lessons
{any non-obvious findings worth preserving}
```

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "current_pipeline_step": 4,
  "tasks_completed_this_session": N+1,
  "snapshot_reason": "task-completion record written"
}
```

Also update `.brain/progress/brain-project-state.json`:
- Increment `total_tasks_completed`
- Increment `model_usage.{model}`
- Increment `tasks_since_last_consolidation`

**Compaction advice:** SAFE to compact after this step. All implementation artifacts are committed or on disk.

### Step 5: Update activity log

Append one row to `.brain/progress/activity.md`:

```
| {timestamp} | {task_id} | {short description} | {model} | success | {files count} | {sinapses count} |
```

### Step 6: Archive and propose updates

**6.1: Propose sinapse updates**

For tasks with score < 40 (Haiku / Sonnet), dispatch a haiku subagent for documentation:

```
Agent(model: "haiku", description: "Propose sinapse updates: {task_id}")
```

- Read subagent result and write to `working-memory/sinapse-updates-{task_id}.md`
- **Fallback:** If subagent fails or is unavailable, invoke `/brain-document` inline

For tasks with score >= 40 (Codex / Opus):
- If brain-document subagent was already dispatched in Path C, read its result
- If not dispatched or failed: invoke `/brain-document` inline -> proposes `sinapse-updates-{task_id}.md` in working-memory (NEVER auto-write sinapses)

**6.2: Archive context files**

Move context files from `working-memory/` to `progress/completed-contexts/`:
- `context-packet-{task_id}.md` -> `progress/completed-contexts/{task_id}-context-packet.md`
- `{model}-context-{task_id}.md` -> `progress/completed-contexts/{task_id}-{model}-context.md`

**6.3: Commit**

Commit via `/commit` with format: `<type>(<scope>): <what>`

**6.4: Consolidation check**

Count entries in `activity.md` after last `consolidation-checkpoint` marker. If 5+, output:
`BRAIN: 5+ tasks accumulated -- run /brain-consolidate`

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "current_pipeline_step": 0,
  "tasks_since_consolidate": N+1,
  "active_context_files": [],
  "snapshot_reason": "pipeline complete, state reset"
}
```

**6.5: Circuit breaker update**

Update `.brain/progress/brain-project-state.json` based on task outcome:

```
ON SUCCESS:
  circuit_breaker.state = "closed"
  circuit_breaker.failure_count = 0
  circuit_breaker.last_failure_at = null
  circuit_breaker.cooldown_until = null

ON FAILURE:
  circuit_breaker.failure_count += 1
  circuit_breaker.last_failure_at = now

  IF failure_count >= 3 AND all 3 failures occurred within last 10 minutes:
    circuit_breaker.state = "open"
    circuit_breaker.cooldown_until = now + 5 minutes
    Output: "CIRCUIT BREAKER OPENED: 3 consecutive failures in 10 min. Pipeline blocked for 5 min."

  IF circuit_breaker was "half-open" (this was a probe):
    circuit_breaker.state = "open"
    circuit_breaker.cooldown_until = now + 5 minutes
    Output: "CIRCUIT BREAKER RE-OPENED: Probe task failed. Cooldown extended."
```

**Compaction advice:** SAFE to compact after Step 6. If context pressure > 75%, skip optional steps (detailed brain-document analysis, verbose archival notes) and output minimal completion summary instead.

---

## Context Pressure Management

Track estimated token usage at each step. If context pressure is high, adapt:

| Pressure Level | Action |
|---------------|--------|
| < 50% | Normal execution, full detail |
| 50-75% | Reduce code examples in context files from 3 to 1 |
| > 75% | Skip optional steps: brain-document runs as subagent only (no inline fallback), archival writes minimal notes, skip Brain Health Status in context files |
| > 90% | Emergency mode: complete current step, write state to brain-state.json, output "CONTEXT PRESSURE CRITICAL -- compact now and resume from Step {N}" |

---

## Quick Reference

### Flags
| Flag | Effect |
|------|--------|
| `/brain-task [description]` | brain-decision first -> route -> Pre-checks -> Steps 1-3.5 -> Steps 4-6 (all inline) |
| `--sonnet` | Force Sonnet model |
| `--debug` | Force Opus debugging mode |
| `--plan` | Force plan mode before Step 1 |
| `--lightweight` | Haiku mode: Tier 1 only |
| `--resume` | Resume interrupted task from last checkpoint |
| `--no-subagent` | Force all execution inline, skip subagent dispatch |

### Files Created

| Step | File | Archived to |
|------|------|-------------|
| 1 | `working-memory/context-packet-{task_id}.md` | `progress/completed-contexts/` (Step 6) |
| 2 | `working-memory/[model]-context-{task_id}.md` | `progress/completed-contexts/` (Step 6) |
| 3.5 | `working-memory/codex-review-{task_id}.md` | kept for reference (Codex path only) |
| 4 | `working-memory/task-completion-{task_id}.md` | cleaned up by brain-consolidate |
| 6 | `working-memory/sinapse-updates-{task_id}.md` | cleaned up by brain-consolidate |

### State Files Modified

| File | When Updated |
|------|-------------|
| `.brain/working-memory/brain-state.json` | Every step checkpoint (GATE 5) |
| `.brain/progress/brain-project-state.json` | Step 4 (counters), Step 6.5 (circuit breaker) |
| `.brain/progress/activity.md` | Step 5 (append row) |

### Subagent Dispatch Summary

| Trigger | Model | Task | Fallback |
|---------|-------|------|----------|
| Step 3, Path B (Sonnet) | sonnet | Implement task | Execute inline |
| Step 3, Path C post-impl | sonnet | Code review (brain-codex-review) | Run inline at Step 3.5 |
| Step 3, Path C post-impl | haiku | Propose sinapse updates (brain-document) | Run inline at Step 6 |
| Step 6.1, score < 40 | haiku | Propose sinapse updates (brain-document) | Run inline |

---

## The #1 failure mode

**Skipping Steps 1-2 and going straight to implementation.** This has happened. The agent reads this skill, understands the concept, then defaults to its own workflow (launch Explore agents, write code directly). The context files never get created. No sinapses are proposed. The entire learning loop breaks.

**The fix is the gates above.** If `context-packet-{task_id}.md` doesn't exist, Step 2 cannot run. If `[model]-context-{task_id}.md` doesn't exist, Step 3 cannot run. Treat these as hard dependencies, not suggestions.

**The #2 failure mode:** Waiting for a hook that never fires. brain-task is self-contained — Steps 4-6 always run inline after Step 3. No hooks are in the critical path.

**The #3 failure mode:** Subagent dispatch treated as required. Subagents are optimizations. If one fails, the pipeline continues inline. Never block on a subagent result beyond one retry.

---

**Created:** 2025-03-25 | **Agent Type:** Orchestrator | **Last Updated:** 2026-03-26 | **Architecture:** Self-contained (no hook dependencies), subagent-optimized, circuit-breaker protected
