---
name: brain-task
description: Full task orchestration — circuit breaker check, state persistence, context assembly, implementation (inline or subagent), verification, documentation, archival + cleanup
---

# brain-task — EXECUTE THESE STEPS IN ORDER

**This is not a reference document. These are instructions. Execute them sequentially. Do not skip steps. Do not "go straight to implementation." Every step produces a concrete artifact that the next step depends on.**

## HARD RULE: No step can be skipped

```
GATE 0: brain-dev MUST run first (classifies complexity, selects model)
GATE 1: context-packet-{task_id}.md MUST exist before Step 2
GATE 2: Implementation MUST use the context packet as its brief — not your own judgment
GATE 3: Steps 3-5 (post-task) MUST run inline after Step 2 — NEVER wait for a hook
GATE 4: State persistence — brain-state.json MUST be updated at every checkpoint listed below
GATE 5: brain-state.json current_pipeline_step MUST be updated at Steps 0, 1, and 2, and per micro-step in Path F — these are the recovery points for interrupted task detection
```

## Anti-Rationalization — STOP

These thoughts are warning signs. If you catch yourself thinking any of these, you are rationalizing a shortcut. Stop and follow the pipeline.

| Thought | Reality |
|---------|---------|
| "I can skip the context packet — the task is obvious" | The context packet loads sinapses that prevent repeating past mistakes. Feeling confident is not the same as having context. |
| "I already know what to do, Step 1 is just overhead" | Step 1 is the only guarantee the brain's knowledge is applied. Skip it and you build blindly. |
| "The subagent said DONE — that's enough" | The implementer's report means nothing. Run acceptance gates yourself. DONE is not verified until you have tool output. |
| "The tests passed in the subagent's output" | You have not seen test output. Read it. Run it. Do not trust reported results — verify them. |
| "Step 2.5 is just a formality — the code looks correct" | Step 2.5 is a hard gate. Either tool output says GO or it doesn't. There is no "looks correct." |
| "The spec reviewer only catches edge cases — the main thing is fine" | The spec reviewer is your only formal check. If it is not ✅, the task is not done. |
| "Post-task steps are bookkeeping — I'll skip them to save tokens" | Post-task updates state, captures episodes, and clears current_skill. Skipping corrupts the brain state. |
| "This is a simple fix, I don't need the full pipeline" | 'Simple' is where the most pipeline violations happen. Score determines complexity — not your intuition. |

**Architecture principle:** This skill is fully self-contained. Pipeline orchestration (routing, state, verification, archival) always runs inline in the current session. Implementation may be delegated to a subagent (Haiku or Sonnet) for speed and token efficiency — but every subagent dispatch has an immediate inline fallback. The pipeline never depends on a subagent succeeding. No external hooks are required. If hooks exist, they serve as optional observers — never as workflow drivers.

**If you catch yourself about to write code without having created the context packet above, STOP. You are skipping the pipeline. Go back to Step 1.**

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

**Present options using `AskUserQuestion`:**

```
AskUserQuestion(
  questions: [{
    question: "Interrupted task detected: {last_task_id} at Step {current_pipeline_step}. How should we proceed?",
    header: "Resume",
    options: [
      { label: "Resume (Recommended)", description: "Continue from Step {N} — context files still exist" },
      { label: "Restart", description: "Start over from Step 0 — context may be stale" },
      { label: "Abandon", description: "Discard interrupted task and start fresh" }
    ],
    multiSelect: false
  }]
)
```

---

## Step 0: Route through brain-dev (MANDATORY)

**CASE A: Called via brain-dev (dev-context file present)**
brain-dev passes via dev-context file: `task_id`, `score`, `model`, `domain`, `plan_mode`, `keywords`. Use these values directly.

**CASE B: Called directly by user (no flags)**
Proceed with defaults: score=50, model=sonnet, domain=cross-domain, plan_mode=false. Log a warning: **'brain-task called without brain-dev routing — using defaults. For optimal results, use /brain-dev first.'** Do NOT invoke brain-dev.

**Note for subagent execution:** If brain-task is dispatched as a subagent by brain-dev, it receives task_id, model, domain, score via the dev-context file at `.brain/working-memory/dev-context-{task_id}.md`. Read that file first. CASE B only fires when those values are truly absent (direct user invocation without routing).

**You need these values for every subsequent step. Do not guess them.**

**Plan-mode guard:** If `plan_mode = true` but `.brain/working-memory/implementation-plan-{task_id}.md` does not exist:
- Log warning: "Plan mode active but no plan file found. This is unexpected — brain-plan should have created it before invoking brain-task."
- STOP. Report to the developer: "Plan file missing. Re-run `/brain-dev` to restart the pipeline from classification."
- Do NOT invoke `/brain-plan` from here — the pipeline is linear (CLASSIFY → PLAN → EXECUTE). brain-task cannot send control backwards to brain-plan.

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:

**State update (v1.2.0):** Always set `current_skill: "brain-task"` here, even if brain-dev already set it. This ensures the routing guard allows brain-task to write source files, including when brain-task is invoked directly (CASE B).

```json
{
  "current_skill": "brain-task",
  "last_task_id": "{task_id}",
  "current_pipeline_step": 0,
  "active_context_files": [],
  "snapshot_reason": "brain-dev routing complete"
}
```
Also write `task_id`, `model`, `domain`, and `complexity_score` as reference fields in state (or use `last_task_id` to correlate).

---

## All artifacts go to `.brain/working-memory/`

| Step | You MUST create this file | Location |
|------|--------------------------|----------|
| 1 | `context-packet-{task_id}.md` | `.brain/working-memory/` |

Never save task artifacts to `tasks/`, `docs/`, or `.brain/cortex/`. Those are permanent locations. Task artifacts are ephemeral.

---

## Execution Modes (determined by brain-dev)

| Model | Sinapses | Token Budget |
|-------|----------|-------------|
| **Haiku** (score < 20) | Tier 1 only | 8-15k |
| **Sonnet** (score 20-39) | Tier 1 + 2 (max 5) | 30-60k |
| **Codex** (score 40-74) | Tier 1 + 2 (+ Tier 3 if critical) | 100-150k |
| **Opus** (debugging) | Tier 1 + 2 | 120-150k |

All models use `context-packet-{task_id}.md` as their implementation brief. If Sonnet fails after 2 attempts, escalate to Codex. Log the escalation.

---

# EXECUTE THESE STEPS NOW

## Step 1: Load Context — DO THIS FIRST

**Context ownership:** brain-task Step 1 ensures a context-packet exists. If brain-plan already created one (planned path), reuse it. If not (trivial/fix-known path), call brain-map to create it.

1. Check if `.brain/working-memory/context-packet-{task_id}.md` already exists
2. **If YES** (brain-plan path): Read it. Skip to Step 1 gate check.
3. **If NO** (trivial/fix-known path): Call brain-map to create it:
   a. Read `.brain/hippocampus/architecture.md` and `.brain/hippocampus/conventions.md`
   b. Query brain.db for domain sinapses
   c. Write context-packet-{task_id}.md

**For Haiku (lightweight) tasks:** Load Tier 1 only (hippocampus + sinapses, ~4k tokens). Skip Tier 2.

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

## Step 2: Implement + Verify

**You MUST have the context packet from Step 1 open. Read it. Follow its acceptance criteria, sinapses, and "DO NOT" list as you implement.**

**STATE PERSISTENCE (GATE 5):** Update `.brain/working-memory/brain-state.json`:
```json
{
  "current_pipeline_step": 2,
  "snapshot_reason": "implementation started"
}
```

**Compaction advice:** DO NOT compact during this step. Implementation is in progress and requires full context window.

### Dispatch Decision Tree

The implementation strategy depends on the model tier assigned by brain-dev. Choose the matching path below.

---

### Path A: Haiku (score < 20) — Dispatch HAIKU SUBAGENT (with inline fallback)

**Why subagent:** The session model (Sonnet) stays free for orchestration. The actual implementation runs on `claude-haiku-4-5` — faster and cheaper for small tasks. If the subagent is unavailable, fall back to inline (same session).

**Pre-dispatch guard:** If `--no-subagent` flag was passed, skip directly to Step A.4 (inline execution).

**Step A.1: Assemble subagent prompt**

Build a self-contained prompt — the subagent has NO access to your conversation:

- Inline the FULL contents of `context-packet-{task_id}.md` (paste the text, not the path)
- Include the task description and acceptance criteria
- Include key conventions from `.brain/hippocampus/conventions.md` (5-10 lines max — Haiku tasks are small)
- Include 1 real code example from the codebase (5-10 lines) showing the pattern to follow — take from the context packet or read the relevant file directly

**Step A.2: Dispatch subagent**

```
Agent(model: "haiku", description: "Implement: {task_description}")
```

Record in `brain-state.json`:
```json
{
  "subagents_dispatched": [{"task_id": "{task_id}", "model": "haiku", "status": "running"}]
}
```

**Step A.3: Read subagent result**

Update `brain-project-state.json` subagent_usage counters for each outcome below:

- **DONE:** Verify files exist on disk, increment `subagent_usage.dispatched` + `subagent_usage.succeeded` + `subagent_usage.by_model.haiku.dispatched` + `subagent_usage.by_model.haiku.succeeded`, proceed to Step 2.5
- **DONE_WITH_CONCERNS:** Review concerns. If safe, proceed. If not, fix inline. Increment `subagent_usage.dispatched` + `subagent_usage.succeeded` + `subagent_usage.by_model.haiku.dispatched` + `subagent_usage.by_model.haiku.succeeded`.
- **BLOCKED / Garbage / Unavailable:** Increment `subagent_usage.dispatched` + `subagent_usage.failed_with_fallback` + `subagent_usage.by_model.haiku.dispatched` + `subagent_usage.by_model.haiku.failed`. Fall back to inline (Step A.4).

**No retry policy:** Haiku path intentionally uses zero retries. Immediate inline fallback is faster for score < 20. Retrying would negate the speed benefit.

**Step A.4: Inline fallback**

If subagent fails or `--no-subagent` was passed:
1. Log: `haiku subagent failed, executing inline (reason: {reason})` (skip log if `--no-subagent`)
2. Read the context-packet file
3. Implement following the patterns in the context packet
4. No formal quality gate — proceed directly to Step 2.5

---

### Path B: Sonnet (score 20-39) — Dispatch SUBAGENT (with inline fallback)

**Pre-dispatch guard:** If `--no-subagent` flag was passed, skip directly to Step B.4 (inline execution).

**Step B.1: Assemble subagent prompt**

Build a self-contained prompt for the subagent. The subagent has NO access to your conversation context, so everything it needs must be in the prompt:

- Inline the FULL contents of `context-packet-{task_id}.md` (not a file path — paste the actual text)
- Include condensed conventions from `.brain/hippocampus/conventions.md` (key patterns, 10-20 lines)
- Include 1-2 real code examples from the codebase (already in the context packet)
- Include the acceptance criteria from the context packet

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

- **DONE:** Verify files exist on disk, increment `subagent_usage.dispatched` + `subagent_usage.succeeded` + `subagent_usage.by_model.sonnet.dispatched` + `subagent_usage.by_model.sonnet.succeeded`, proceed to Step 2.5 (verification)
- **DONE_WITH_CONCERNS:** Review concerns. If safe, proceed to Step 2.5. If not safe, fix inline. Increment `subagent_usage.dispatched` + `subagent_usage.succeeded` + `subagent_usage.by_model.sonnet.dispatched` + `subagent_usage.by_model.sonnet.succeeded`.
- **BLOCKED:** Provide more context (additional sinapses, more code examples), retry ONCE. If still blocked, increment `subagent_usage.dispatched` + `subagent_usage.failed_with_fallback` + `subagent_usage.by_model.sonnet.dispatched` + `subagent_usage.by_model.sonnet.failed` and fall back to inline execution (Step B.4).
- **Garbage / no useful output:** Increment `subagent_usage.dispatched` + `subagent_usage.failed_with_fallback` + `subagent_usage.by_model.sonnet.dispatched` + `subagent_usage.by_model.sonnet.failed` and fall back to inline execution (Step B.4).
- **Subagent unavailable or errors:** Increment `subagent_usage.dispatched` + `subagent_usage.failed_with_fallback` + `subagent_usage.by_model.sonnet.dispatched` + `subagent_usage.by_model.sonnet.failed` and fall back to inline execution (Step B.4).

Update `brain-project-state.json` subagent_usage counters accordingly.

**Step B.4: Inline fallback**

If subagent fails for any reason:
1. Log: `subagent failed, executing inline (reason: {reason})`
2. Read the context packet fully
3. Implement following the patterns and guard rails in the context packet
4. Proceed to Step 2.5

**The pipeline never breaks because of a subagent failure.** Inline execution is always available.

---

### Path C: Codex / Complex (score 40-74) — Execute INLINE

Complex tasks need the full context window. Execute inline.

1. Call `codex` or `codex-cli` MCP tool with `context_file: .brain/working-memory/context-packet-{task_id}.md`
2. Review Codex output — accept, reject, or partial accept
3. If MCP unavailable: fall back to Claude implementing directly using the context packet as brief

After implementation completes and Step 2.5 verification passes, dispatch parallel subagents for post-implementation work:

```
Agent(model: "sonnet", description: "Code review: {task_id}") -- runs brain-codex-review
Agent(model: "haiku", description: "Propose sinapse updates: {task_id}") -- runs brain-document
```

The brain-document subagent is fire-and-forget — if it fails, sinapse updates run inline in Step 4.
The brain-codex-review subagent is **blocking for Path C only** — wait for its result before proceeding to Step 3. If the subagent fails or times out (30s), run brain-codex-review inline.
Record dispatches in `brain-state.json` subagents_dispatched array.

---

### Path D: Opus / Debugging — Execute INLINE

Debugging requires full codebase access and the complete context window. Always execute inline.

1. Read the context packet file
2. Root cause analysis using the patterns and similar issues listed
3. Propose and execute fix

---

### Path E: REMOVED in v1.2.0

Legacy standard plans (`plan_type: standard`) are no longer supported. All plans are now expanded format via brain-plan. If a legacy plan file is encountered, treat it as an expanded plan (route to Path F).

---

### Path F: Dispatcher Mode — Execute EXPANDED PLAN via subagent-per-micro-step

**When:** `plan_type: expanded` in the implementation plan AND (
        (`dispatch_ready: true` AND (`step_count >= 5` OR `estimated_tokens >= 40000`))
        OR `--subagents` flag is explicitly set
      )
Note: If `dispatch_ready: true` but `step_count < 5` and `tokens < 40k` and `--subagents` not set,
      execute micro-steps sequentially within Path F (no parallel subagents).

This path is the execution engine for Cortex-Linked TDD plans produced by the upgraded brain-plan skill.

**Why subagents:** Each TDD micro-step is self-contained (spec + implementation + acceptance gate). Dispatching one subagent per micro-step gives token isolation, parallel execution for independent steps, and clear pass/fail per unit of work. The orchestrator (this session) handles sequencing, spec review, and state persistence.

**Fallback:** If any subagent fails or `--no-subagent` flag was passed, execute that micro-step inline. The pipeline never blocks on a subagent.

---

**Step F.1: Read and validate the expanded plan**

Read `.brain/working-memory/implementation-plan-{task_id}.md` and extract:

- `micro_steps`: total count
- `estimated_tokens`: total budget
- File Structure table: all files to be created/modified
- Sinapse Index: all linked sinapses and embedded `## Lessons Learned` references
- Implementation Order: topological sort with parallelizable groups
- Subagent model per step: recommended model for each micro-step

**Validation checks:**

```
IF micro_steps == 0 OR File Structure table is empty:
  → ABORT: "Expanded plan is invalid — no micro-steps or file structure found."
  → Fall back to inline execution (execute plan steps sequentially in current session)

IF any micro-step references a file NOT in the File Structure table:
  → WARN: "Plan integrity issue — micro-step M{N} references unlisted file {path}"
  → Continue but flag for spec review
```

Record in `brain-state.json`:
```json
{
  "current_pipeline_step": 3,
  "dispatch_mode": "expanded_plan",
  "plan_micro_steps": N,
  "plan_completed_steps": 0,
  "snapshot_reason": "Path F dispatcher initialized"
}
```

---

**Step F.2: Execute micro-steps in dependency order**

Process micro-steps following the Implementation Order from the plan. For each parallelizable group, dispatch subagents concurrently. For sequential dependencies, wait for completion before proceeding.

**For each micro-step M{N}:**

**F.2.1: Assemble subagent prompt**

Build a self-contained prompt for the subagent. The subagent has NO access to your conversation context. Include:

- The micro-step's Spec section (exact test cases to write)
- The micro-step's Implementation section (exact file, pattern, key decisions)
- The micro-step's Acceptance Gate (exact commands to run)
- All sinapses referenced by `[[sinapse-id]]` in this micro-step — inline the relevant sinapse content from the context packet (not just the ID)
- Relevant `## Lessons Learned` bullets from referenced sinapses — inline that sinapse-backed guidance
- The File Structure table (so the subagent knows where files go)
- If this micro-step depends on others (Requires field), include the file paths and signatures created by those completed steps

**Prompt structure:**

```
You are implementing micro-step M{N} of an expanded TDD plan.

## Your Task: {micro-step title}

## Spec (write this FIRST)
{Spec section from plan — exact file path, exact test cases}

## Implementation (write AFTER spec passes)
{Implementation section from plan — exact file path, pattern, decisions}

## Conventions (MUST follow)
{Inlined sinapse content for each [[sinapse-id]] referenced}

## Mistakes to Avoid
{Inlined relevant `## Lessons Learned` bullets from referenced sinapses}

## File Structure Context
{Relevant rows from File Structure table}

## Files from Previous Steps (already on disk)
{List of files created by prerequisite micro-steps, with key exports/signatures}

## Acceptance Gate
{Exact checklist — spec exists, implementation passes, commands to run}

IMPORTANT: Write the spec file FIRST. Run it. It should fail. Then write the
implementation. Run the spec again. It should pass. Do NOT skip the spec.
```

**F.2.2: Dispatch subagent**

Use the model recommended in the plan's "Subagent model per step" table:

```
Agent(model: "{recommended_model}", description: "TDD micro-step M{N}: {title}")
```

Record in `brain-state.json`:
```json
{
  "subagents_dispatched": [
    {"micro_step": "M{N}", "model": "{model}", "status": "running", "dispatched_at": "{ISO8601}"}
  ]
}
```

**F.2.3: Read subagent result and run spec review**

After the subagent completes:

1. **Verify spec file exists** at the path specified in the micro-step
2. **Verify implementation file exists** at the path specified
3. **Run the acceptance gate commands** listed in the micro-step (test command, lint command)
4. **Spec review:** Read the spec file. Verify it contains all test cases listed in the plan. If any test case is missing, flag it.

**Result handling:**

```
DONE + all acceptance gates pass + spec review clean:
  → Mark M{N} as complete
  → Update brain-state.json: plan_completed_steps += 1
  → Update brain-project-state.json subagent counters (dispatched + succeeded)
  → Proceed to next micro-step

DONE + acceptance gates pass + spec review has warnings:
  → Mark M{N} as complete with warnings
  → Log warnings in brain-state.json
  → Proceed (warnings are non-blocking)

DONE + acceptance gates FAIL (tests fail or lint errors):
  → Attempt inline fix: read the error, fix the file, re-run acceptance gates
  → If fix succeeds: mark complete, proceed
  → If fix fails: mark M{N} as failed, log error, continue to next independent step
  → Update brain-project-state.json subagent counters (dispatched + failed)

BLOCKED / Garbage / Unavailable:
  → Execute M{N} inline (Step F.2.4)
  → Update brain-project-state.json subagent counters (dispatched + failed_with_fallback)
```

**F.2.4: Inline fallback for single micro-step**

If subagent dispatch fails or `--no-subagent` was passed:

1. Log: `subagent failed for M{N}, executing inline (reason: {reason})`
2. Read the micro-step's Spec section — write the spec file
3. Run the spec — confirm it fails (TDD red phase)
4. Read the micro-step's Implementation section — write the implementation
5. Run the spec — confirm it passes (TDD green phase)
6. Run acceptance gate commands
7. Proceed to next micro-step

**F.2.5: Review gates (per micro-step, after acceptance gates pass)**

After a micro-step passes its acceptance gates, run two review subagents:

**Spec-compliance reviewer (blocking):**

```
Agent(
  model: "haiku",
  description: "Spec review: M{N}: {title}",
  prompt: """
Review the implementation of micro-step M{N}: {title} for spec compliance.

CRITICAL: Do NOT trust the implementer's report or self-review. Run `git diff HEAD~1`
yourself. Your verdict must be based on what you observe in the diff and in the files —
not on what the implementer claimed was done.

1. Was EVERYTHING in the spec implemented? List any gaps.
2. Was ANYTHING added that was NOT in the spec? List extras.
3. Do the tests actually verify the specified behaviour (not just mock it)?

Output: ✅ COMPLIANT or ❌ ISSUES: [list]
"""
)
```

If ❌: fix inline (read issues, apply fixes, re-run acceptance gates). Then re-run spec reviewer. Repeat until ✅.

**Code-quality reviewer (blocking):**

```
Agent(
  model: "haiku",
  description: "Quality review: M{N}: {title}",
  prompt: """
Review micro-step M{N}: {title} for code quality.

Run `git diff HEAD~1` to see what changed. Read only the changed files.

Check for:
1. Bugs or logic errors (reference line numbers)
2. Names that are unclear or misleading
3. YAGNI violations (features NOT in the spec)
4. Tests that only mock behaviour without verifying real outcomes

Output: ✅ APPROVED or ⚠️ ISSUES: Important: [list] / Minor: [list]
"""
)
```

If Important issues: fix inline, re-run quality reviewer until ✅.

**F.2.6: Confidence display (per micro-step)**

After reviews pass, display confidence to user:
- `confidence: high` → `🧠 Task {N}: {title} — DONE ✓`
- `confidence: medium` → `🧠 Task {N}: {title} — DONE (confidence: medium)` + each ⚠ warning
- `confidence: low` → `🧠 Task {N}: {title} — DONE (confidence: low)` + warnings + `Should I address these before moving to the next task?`

**The "fix it" loop:** If user says "fix it" after seeing low-confidence warnings:
1. Create a fix specification from the specific warnings
2. Re-dispatch brain-task implementer for this micro-step with the fix specification
3. Re-run review gates after fix

**F.2.7: Post-task per micro-step (REQUIRED — do NOT skip)**

After reviews pass and confidence is displayed, run the post-task pipeline for this micro-step:

```bash
node scripts/brain-post-task.js \
  --task-id "{task_id}-step-{N}" \
  --status "{success|failure}" \
  --model "{model}" \
  --domain "{domain}" \
  --score {score} \
  --files-changed '{files_json_array}' \
  --sinapses-loaded '{sinapses_json_array}' \
  --short-description "{micro_step_title}" \
  --task-description "{micro_step_description}" \
  --tests-summary "{tests_pass_fail_summary}"
```

Read JSON output and handle `lesson_trigger` / `consolidation_needed` as defined in Steps 3-5.

---

**Step F.3: Parallel dispatch for independent micro-steps**

When the Implementation Order identifies parallelizable groups (micro-steps with no mutual dependencies), dispatch their subagents concurrently:

```
Group 1: [M1] — dispatch immediately
  Wait for M1 to complete

Group 2: [M2, M3] — both depend only on M1
  Agent(model: "sonnet", description: "TDD micro-step M2: {title}")
  Agent(model: "haiku", description: "TDD micro-step M3: {title}")
  Wait for both to complete

Group 3: [M4] — depends on M2 and M3
  Agent(model: "sonnet", description: "TDD micro-step M4: {title}")
  Wait for M4 to complete
```

Record all parallel dispatches in `brain-state.json` subagents_dispatched array.

---

**Step F.4: Plan completion checkpoint**

After all micro-steps are processed:

```
IF all micro-steps marked complete:
  → Update plan status to "completed" in implementation-plan-{task_id}.md
  → Log: "Expanded plan fully executed: {completed}/{total} micro-steps succeeded"
  → Proceed to Step 2.5 (Verification Gate)

IF some micro-steps failed:
  → Update plan status to "partial" in implementation-plan-{task_id}.md
  → Log: "Expanded plan partially executed: {completed}/{total} succeeded, {failed}/{total} failed"
  → List failed micro-steps with error summaries
  → Proceed to Step 2.5 (Verification Gate will catch remaining issues)

IF majority of micro-steps failed (> 50%):
  → Update plan status to "failed" in implementation-plan-{task_id}.md
  → Log: "EXPANDED PLAN FAILED: {failed}/{total} micro-steps failed. Consider revising the plan."
  → Trigger strategy rotation (see Step 2.5 strategy 3: escalate model tier)
```

Update `brain-state.json`:
```json
{
  "current_pipeline_step": "3.5",
  "dispatch_mode": "expanded_plan",
  "plan_micro_steps": N,
  "plan_completed_steps": M,
  "plan_failed_steps": K,
  "snapshot_reason": "Path F dispatch complete — advancing to Step 2.5 (verification)"
}
```

---

## Step 2.5: Verification Gate (ALL TASKS)

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
Strategy 0 (default):    Follow sinapse patterns from context packet
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

After tests pass, invoke `/brain-codex-review`:
- **Path C:** Already dispatched as blocking subagent after implementation. If that subagent succeeded, skip this step.
- **All other paths:** Run inline.

1. Run `/brain-codex-review` -> generates `.brain/working-memory/codex-review-{task_id}.md`
2. If review passes -> proceed to Step 3
3. If review finds auto-fixable issues -> fix and re-run tests
4. If review fails with manual-fix issues -> halt, report to developer, wait for direction
5. Re-run `/brain-codex-review` after fixes until clean

**Sonnet and Haiku tasks** skip the codex-review gate. Tests are their primary quality check.

---

## After Implementation: Post-task sequence

**After Step 2.5 completes, run the post-task sequence below DIRECTLY — do not wait for a hook.**

**Path F exception (v1.2.0):** If the task used Path F (expanded plan dispatch), the per-micro-step post-task (F.2.7) already ran `brain-post-task.js` for each step. Do NOT run `brain-post-task.js` again here — it would double-count tasks and consolidation triggers. Instead, skip directly to the self-check + LLM confidence assessment (Steps 3+4+5 below handle only the overall task summary, not re-running brain-post-task.js).

The `TaskCompleted` hook only fires when a Task tool subagent completes. When brain-task runs in the main session (the normal case), no hook fires. Always execute Steps 3-5 inline.

### Steps 3+4+5.2+5.4+5.5: Post-Task Automation (Delegated)

**These steps are delegated to `scripts/brain-post-task.js`.** Do NOT manually edit
task-completion records, activity.md, brain-state.json, or brain-project-state.json for these steps.

**Skip for Path F:** If this task used Path F, brain-post-task.js was already called per micro-step in F.2.7. Skip this call. Proceed to Self-Check + LLM Confidence Assessment below.

Run:
```bash
node scripts/brain-post-task.js \
  --task-id "{task_id}" \
  --status "{success|failure}" \
  --model "{model}" \
  --domain "{domain}" \
  --score {score} \
  --files-changed '{files_json_array}' \
  --sinapses-loaded '{sinapses_json_array}' \
  --lessons-loaded '{sinapse_ids_with_embedded_lessons_json_array}' \
  --short-description "{short_description}" \
  --task-description "{full_task_description}" \
  --tests-summary "{tests_pass_fail_summary}"
```

Read the JSON output:
- `consolidation_needed: true` -> output: "BRAIN: 5+ tasks accumulated -- run /brain-consolidate"
- `circuit_breaker_state.state: "open"` -> output breaker warning to developer
- `lesson_trigger: "full"` -> Write a **full episode** file (see below)
- `lesson_trigger: "draft"` -> Write a **draft episode** file (see below)
- `lesson_trigger: null` -> No episode needed

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

---

### Episode Capture (Auto-Lesson) — FINAL step before returning status

**This must be the LAST thing brain-task does before reporting status back to brain-dev.** The subagent has full failure context at this point — once it returns, the context is lost.

**If `lesson_trigger === "full"` (struggled — strategy rotation had 2+ attempts):**

Write `.brain/working-memory/episode-{task_id}.md`:

```yaml
---
type: episode
task_id: {task_id}
domain: {domain}
severity: {estimate based on failure impact}
trigger: struggled
tags: ["{relevant tags from task context}"]
sinapses_loaded: {pass the FULL sinapse ID array from --sinapses-loaded, not just the count}
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{what failed — error messages, test failures, verbatim}

## What Worked
{the fix that resolved it — what you changed and why}

## Files Involved
{list of files modified during the struggle}
```

Token cost: ~800-1.5k (includes LLM reasoning for "What Worked").

**If `lesson_trigger === "draft"` (simple failure — no recovery):**

Write `.brain/working-memory/episode-{task_id}.md`:

```yaml
---
type: episode
task_id: {task_id}
domain: {domain}
severity: {estimate}
trigger: failure
tags: ["{relevant tags}"]
sinapses_loaded: {sinapse ID array}
related_completion: task-completion-{task_id}.md
created_at: {ISO8601}
---

## What Happened
{error message or test failure — verbatim}

## Files Involved
{list of files}
```

Token cost: ~300-500 (no LLM reasoning, just raw data capture).

**Important:** Pass the sinapse ID array (not just the count) via `--sinapses-loaded` when calling brain-post-task.js. Example: `--sinapses-loaded '["sinapse-auth-001", "sinapse-session-003"]'`

**LLM still owns:** Step 5.1 (brain-document sinapse proposals), Step 5.3 (/commit), episode capture (auto-lesson), and self-assessment confidence.
**LLM still writes:** The episode file "What Worked" section for struggled tasks, and the confidence self-assessment ("Is there anything I'm uncertain about?").

---


---

## Context Pressure Management

Track estimated token usage at each step. If context pressure is high, adapt:

| Pressure Level | Action |
|---------------|--------|
| < 50% | Normal execution, full detail |
| 50-75% | Reduce code examples in context files from 3 to 1 |
| > 75% | Prefer subagent dispatch for documentation and post-implementation steps. Inline fallback remains available — use it if subagent is unavailable or fails. Never disable inline fallback regardless of context pressure. |
| > 90% | Emergency mode: complete current step, write state to brain-state.json, output "CONTEXT PRESSURE CRITICAL -- compact now and resume from Step {N}" |

---

## Quick Reference

### Flags
| Flag | Effect |
|------|--------|
| `/brain-task [description]` | brain-dev first -> route -> Pre-checks -> Steps 1-2.5 -> Steps 3-5 (all inline) |
| `--sonnet` | Force Sonnet model |
| `--debug` | Force Opus debugging mode |
| `--plan` | Force plan mode before Step 1 |
| `--lightweight` | Haiku mode: Tier 1 only |
| `--resume` | Resume interrupted task from last checkpoint |
| `--no-subagent` | Force all execution inline, skip subagent dispatch |
| `--subagents` | Force Path F dispatcher mode for expanded plans |

### Files Created

| Step | File | Archived to |
|------|------|-------------|
| 1 | `.brain/working-memory/context-packet-{task_id}.md` | `progress/completed-contexts/` (Step 5) |
| 2.5 | `.brain/working-memory/codex-review-{task_id}.md` | archived to `.brain/progress/completed-contexts/` at Step 5.2 |
| Plan mode | `.brain/working-memory/implementation-plan-{task_id}.md` | archived to `.brain/progress/completed-contexts/` at Step 5.2 (plan-mode tasks only) |
| 3 | `.brain/working-memory/task-completion-{task_id}.md` | cleaned up by brain-consolidate |
| 5 | `.brain/working-memory/sinapse-updates-{task_id}.md` | cleaned up by brain-consolidate |

### State Files Modified

| File | When Updated |
|------|-------------|
| `.brain/working-memory/brain-state.json` | Every step checkpoint (GATE 5) |
| `.brain/progress/brain-project-state.json` | Step 3 (counters), Step 5.5 (circuit breaker) |
| `.brain/progress/activity.md` | Step 4 (append row) |

### Subagent Dispatch Summary

| Trigger | Model | Task | Fallback |
|---------|-------|------|----------|
| Step 2, Path A (Haiku) | haiku | Implement task | Execute inline (same session) |
| Step 2, Path B (Sonnet) | sonnet | Implement task | Execute inline |
| Step 2, Path C post-impl | sonnet | Code review (brain-codex-review) | Run inline at Step 2.5 |
| Step 2, Path C post-impl | haiku | Propose sinapse updates (brain-document) | Run inline at Step 4 (fallback) |
| Step 5.1, score < 40 | haiku | Propose sinapse updates (brain-document) | Run inline |
| Step 2, Path F (Dispatcher) | per-step | TDD micro-step (spec + impl) | Execute micro-step inline |
| Step 2, Path F parallel | per-step | Independent micro-steps in parallel | Execute sequentially inline |

---

## The #1 failure mode

**Skipping Step 1 and going straight to implementation.** This has happened. The agent reads this skill, understands the concept, then defaults to its own workflow (launch Explore agents, write code directly). The context packet never gets created. No sinapses are proposed. The entire learning loop breaks.

**The fix is the gates above.** If `context-packet-{task_id}.md` doesn't exist, Step 2 cannot run. Treat this as a hard dependency, not a suggestion.

**The #2 failure mode:** Waiting for a hook that never fires. brain-task is self-contained — Steps 3-5 always run inline after Step 2. No hooks are in the critical path.

**The #3 failure mode:** Subagent dispatch treated as required. Subagents are optimizations. If one fails, the pipeline continues inline. Never block on a subagent result beyond one retry.

---

**Created:** 2026-03-27 | **Updated:** 2026-03-29 | **Version:** v1.2.0
