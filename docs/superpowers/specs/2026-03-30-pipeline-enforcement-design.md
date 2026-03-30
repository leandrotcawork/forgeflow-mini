# Pipeline Enforcement Design
**Date:** 2026-03-30
**Status:** Approved

## Problem

The brain-plan → brain-task pipeline depends entirely on LLM compliance. Hooks enforce only
4 failure modes (hippocampus writes, router isolation, config weakening, circuit breaker).
Everything else — pipeline ordering, plan file creation, execution mode selection, post-task
steps — depends on the LLM following instructions correctly under token pressure.

Observed failures:
- brain-plan shows the plan in chat but skips writing `implementation-plan-{task_id}.md`
- brain-task picks inline/subagent path automatically instead of asking the user
- brain-task skips post-task steps (brain-post-task.js, brain-document) with no enforcement
- brain-plan's fixed 3-question limit causes plans built on assumptions

## Goal

Make the pipeline file-driven and user-confirmed, not LLM-memory-driven.
Model: superpowers brainstorming → writing-plans → executing-plans.

---

## Architecture

```
brain-plan (Phase 0b — open Q&A until no unknowns remain)
  ↓ HARD-GATE: Write implementation-plan-{task_id}.md FIRST
  ↓ AskUserQuestion: "inline or subagent?"
  ↓ writes execution_mode to plan frontmatter
brain-task Step 0
  ↓ reads execution_mode from plan file (not threshold logic)
  → planFileGate: blocks source writes if plan file absent      [NEW HOOK]
  → executionModeGuard: blocks if execution_mode null           [NEW HOOK]
  → implementation runs
SessionEnd
  → postTaskGate: warns if task-completion file missing         [NEW HOOK]
```

---

## Component 1: `planFileGate` Hook

**Tier:** 2
**Event:** PreToolUse
**Matcher:** Write|Edit
**Position in hooks.json:** after routingGuard

### Logic

```javascript
function planFileGate(input) {
  const skill = readBrainState().current_skill
  if (skill !== 'brain-task') return { decision: 'approve' }

  const target = normalizePath(input.tool_input?.file_path || input.tool_input?.path || '')
  const wmDir = path.join(projectRoot, '.brain', 'working-memory')
  if (target.startsWith(wmDir)) return { decision: 'approve' }

  const taskId = readBrainState().last_task_id
  if (!taskId) return { decision: 'approve' } // no task context yet

  const planPath = path.join(wmDir, `implementation-plan-${taskId}.md`)
  if (fs.existsSync(planPath)) return { decision: 'approve' }

  return {
    decision: 'block',
    reason: `[planFileGate] No plan file for task "${taskId}". Run /brain-plan first, ensure the plan .md is written before approval.`
  }
}
```

### What It Catches

Any attempt by brain-task to write a source file without a plan existing for the current task.
Does NOT block: state files, context packets, dev-context files, anything in `.brain/working-memory/`.

---

## Component 2: `executionModeGuard` Hook

**Tier:** 2
**Event:** PreToolUse
**Matcher:** Write|Edit
**Position in hooks.json:** after planFileGate

### Logic

```javascript
function executionModeGuard(input) {
  const skill = readBrainState().current_skill
  if (skill !== 'brain-task') return { decision: 'approve' }

  const target = normalizePath(input.tool_input?.file_path || input.tool_input?.path || '')
  const wmDir = path.join(projectRoot, '.brain', 'working-memory')
  if (target.startsWith(wmDir)) return { decision: 'approve' }

  const taskId = readBrainState().last_task_id
  if (!taskId) return { decision: 'approve' }

  const planPath = path.join(wmDir, `implementation-plan-${taskId}.md`)
  if (!fs.existsSync(planPath)) return { decision: 'approve' } // planFileGate handles this

  const planContent = fs.readFileSync(planPath, 'utf8')
  const match = planContent.match(/^execution_mode:\s*(.+)$/m)
  const mode = match ? match[1].trim() : null

  if (!mode || mode === 'null' || mode === '[To be confirmed by developer at approval step]') {
    return {
      decision: 'block',
      reason: `[executionModeGuard] execution_mode not confirmed in plan "${taskId}". Complete the brain-plan approval step and select inline or subagent.`
    }
  }

  return { decision: 'approve' }
}
```

### What It Catches

brain-task proceeding to implementation without the user having confirmed execution mode.
Falls through silently if planFileGate already blocked (plan file absent).

---

## Component 3: `postTaskGate` Hook

**Tier:** 2
**Event:** SessionEnd
**Matcher:** `*`

### Logic

```javascript
function postTaskGate() {
  const state = readBrainState()
  const step = state.current_pipeline_step || 0
  const taskId = state.last_task_id

  if (!taskId || step < 2) return {}

  const wmDir = path.join(projectRoot, '.brain', 'working-memory')
  const completionPath = path.join(wmDir, `task-completion-${taskId}.md`)
  if (fs.existsSync(completionPath)) return {}

  return {
    additionalContext: `[postTaskGate] Task "${taskId}" ended at pipeline step ${step} without a task-completion record. Post-task steps were not completed. Next session: call brain-post-task.js for task ${taskId} before starting new work. brain-state.json left at step ${step}.`
  }
}
```

### What It Catches

Sessions that end mid-task without running post-task steps. Non-blocking (session is ending),
but the additionalContext is injected into the next session via stateRestore.

---

## Component 4: brain-plan Skill Changes

### 4a: HARD-GATE (add at top, same structure as brainstorming)

```
<HARD-GATE>
Do NOT present the plan for developer approval until implementation-plan-{task_id}.md
has been written to .brain/working-memory/. The plan displayed in chat is a preview only.
The file is the source of truth that brain-task and the hooks read.
Writing the file is Step 1 of approval. Approval is Step 2.
</HARD-GATE>
```

### 4b: Phase 0b — Remove fixed question limit, replace with judgment-based stopping

**Remove:**
> "Maximum 3 questions. Stop after 3 even if more would be useful."

**Replace with:**

> Ask questions one at a time, no fixed limit.
>
> **Stopping condition:** You have enough information when you could write every micro-step
> right now with concrete file paths, exact function names, real test cases, and zero TODOs.
> If any micro-step would require an assumption about scope, naming, approach, or constraints —
> ask one more question about that specific assumption before proceeding.
>
> Questions must target real unknowns, not curiosity. One question per message. Wait for
> the answer before asking the next.

### 4c: Remove Dispatch Metadata auto-threshold from plan output template

**Remove from plan output template:**
```
**Recommended mode:** [inline | dispatch]
- inline: Execute micro-steps sequentially in current session (< 5 steps or < 40k tokens)
- subagents: Use brain-task Path F...
```

**Replace with:**
```
## Execution Mode
execution_mode: [set at approval step]
```

### 4d: Add execution mode confirmation at approval step

After self-review checklist passes and plan .md is written, present:

```
AskUserQuestion(
  questions: [{
    question: "How should brain-task execute this plan?",
    header: "Execution Mode",
    options: [
      {
        label: "Inline (current session)",
        description: "Micro-steps run sequentially in this session. Faster, no context overhead."
      },
      {
        label: "Subagent per micro-step",
        description: "Each step gets a fresh subagent with full context. Better for complex multi-file plans."
      }
    ],
    multiSelect: false
  }]
)
```

Write the selected value as `execution_mode: inline` or `execution_mode: subagents` into the
plan file frontmatter (Edit the file, not rewrite).

---

## Component 5: brain-task Skill Changes

### 5a: Remove Path F threshold logic

**Remove:**
```
If dispatch_ready: true AND (step_count >= 5 OR estimated_tokens >= 40000) → dispatch subagents
If dispatch_ready: true but step_count < 5 AND tokens < 40k → execute inline
```

**Replace with:**
```
Read execution_mode from plan frontmatter (.brain/working-memory/implementation-plan-{task_id}.md):
  - execution_mode: inline      → execute micro-steps sequentially in current session (Path F sequential)
  - execution_mode: subagents   → dispatch Agent per micro-step (Path F dispatch)
  - execution_mode: missing/null → STOP. executionModeGuard should have caught this.
                                   Report: "Plan found but execution_mode not set. Re-run brain-plan approval."
```

### 5b: Step 0 reads plan frontmatter explicitly

After reading dev-context, add:
```
Read .brain/working-memory/implementation-plan-{task_id}.md frontmatter.
Extract: execution_mode, micro_steps, estimated_tokens, plan_type, dispatch_ready.
These values override any defaults. Do not infer execution mode from step count or token estimates.
```

---

## Data Flow

```
1. brain-plan Phase 0b   → open Q&A until zero unknowns
2. brain-plan Stage 1-6  → builds plan in memory
3. brain-plan HARD-GATE  → writes implementation-plan-{task_id}.md  ← file created
4. brain-plan approval   → AskUserQuestion: inline or subagent?
5. brain-plan            → edits plan frontmatter: execution_mode set  ← file updated
6. brain-plan            → sets current_skill: "brain-task", invokes /brain-task
7. brain-task Step 0     → reads dev-context + plan frontmatter
8. [planFileGate]        → any source write: checks plan file exists    ← hook enforces
9. [executionModeGuard]  → any source write: checks execution_mode set  ← hook enforces
10. brain-task Step 2    → implements using execution_mode from file (not threshold)
11. brain-task Steps 3-5 → post-task runs (brain-post-task.js, brain-document)
12. [postTaskGate]       → SessionEnd: warns if task-completion missing ← hook enforces
```

---

## Files Changed

| File | Change |
|------|--------|
| `hooks/brain-hooks.js` | Add `planFileGate`, `executionModeGuard`, `postTaskGate` functions |
| `hooks/hooks.json` | Register 3 new hooks with correct event/matcher/tier |
| `skills/brain-plan/SKILL.md` | HARD-GATE, Phase 0b Q&A redesign, remove threshold, add AskUserQuestion at approval |
| `skills/brain-task/SKILL.md` | Step 0 reads execution_mode from file, remove Path F threshold logic |

---

## What This Does NOT Change

- Codex MCP invocation (Path C) — separate concern, not in scope
- brain-document post-task dispatch — already in the skill, postTaskGate surfaces when it's missed
- brain-map, brain-consult, brain-verify — not affected
- hooks.json Tier 1 hooks — untouched

---

## Spec Self-Review

- [x] No TBDs or placeholders — all hook logic is concrete
- [x] No internal contradictions — planFileGate and executionModeGuard are ordered correctly (plan must exist before mode can be checked)
- [x] Scope is focused — 4 files, 3 hooks, targeted skill text changes
- [x] Execution mode decision is user-confirmed, not LLM-inferred
- [x] Plan file write is enforced by HARD-GATE (skill) + planFileGate (hook) — dual enforcement
- [x] postTaskGate is non-blocking at SessionEnd (appropriate — can't block a closing session)
- [x] Phase 0b stopping condition is concrete and verifiable ("no micro-step requires an assumption")
