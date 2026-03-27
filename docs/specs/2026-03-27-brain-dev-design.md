---
title: brain-dev — Intelligent Entry Point
date: 2026-03-27
status: approved
authors: [leandro, claude]
---

# brain-dev Design Spec

## Problem

The current plugin has two main entry points developers use daily:
- `/brain-decision` → classifies → hands off to `/brain-task`
- `/brain-task` → full pipeline, always inline, always sequential

This creates three pain points:
1. **All execution is inline** — multi-step tasks run sequentially in the same session, consuming the full context window, taking too long
2. **No interactive Q&A** — Claude assumes everything upfront; wrong assumptions cause rework cycles worth 40-80k tokens
3. **No intelligence layer** — Claude executes what you say without evaluating whether it's the best approach, surfacing consequences, or using brain knowledge proactively

---

## Solution: `/brain-dev`

A new primary entry point that handles ANY developer request intelligently, routes to the right flow, evaluates against brain knowledge before acting, and dispatches subagents for multi-step work.

### Command

```
/brain-dev [anything you want to say]
```

Replaces `/brain-decision` as the developer-facing entry point. brain-decision is absorbed internally.

---

## Architecture

### Phase 1 — Classify + Evaluate (brain-dev, silent)

brain-dev reads the request and produces a classification + brain evaluation. No questions asked unless the intent is completely ambiguous.

**Intent taxonomy:**

| Intent | Examples | Routes to |
|--------|----------|-----------|
| build | "implement X", "add feature Y" | brain-plan → subagents |
| fix | "X isn't working", "why is Z failing" | brain-consult → brain-task if fix needed |
| review | "is this approach right?" | brain-consult (consensus mode) |
| question | "how does X work?", "explain Y" | brain-consult (quick/research) |
| refactor | "clean up X", "improve performance" | brain-plan → subagents |

**Complexity scoring (enforced, not advisory):**

```
score = 15 (baseline)
     + domain: cross-domain +30, backend +10, other +0
     + risk: critical +35, high +20, medium +5
     + type: architectural +20, debugging +15, unknown_pattern +10

Model selection:
  any    | debugging  → Opus   (priority override — always wins)
  < 20   | build/fix  → Haiku
  20–39  | build/fix  → Sonnet
  40–74  | build/fix  → Codex
  75+    | build/fix  → Codex + plan mode
```

**Brain evaluation (silent):**
- Loads sinapses relevant to the request domain
- Checks: is this approach optimal? any consequences? missing dependencies? conflicts with existing architecture?
- Writes findings to `.brain/working-memory/dev-context-{task_id}.md`
- Does NOT ask questions — passes concerns to brain-plan as context

**The only exception:** if intent is completely ambiguous (cannot classify at all), brain-dev asks one clarifying question before proceeding.

---

### Phase 2 — Route

```
build/refactor + complexity < 20  → brain-task directly (no plan, Haiku)
build/refactor + complexity >= 20 → brain-plan (Q&A + plan) → subagent dispatch
fix/debug                         → brain-consult → brain-task if fix confirmed
review/question                   → brain-consult
```

---

### Phase 3 — brain-plan (interactive, owns ALL Q&A)

brain-plan is redesigned to be the Q&A + planning layer. It is the equivalent of superpowers' brainstorming + writing-plans combined, but implementation-focused.

**Flow:**
1. Reads `dev-context-{task_id}.md` from brain-dev (classification, concerns, sinapses already loaded)
2. Asks **1-3 targeted questions, one at a time** — including any concern brain-dev flagged
3. Proposes **2 implementation approaches** with trade-offs + recommendation
4. Gets approval, then generates **Cortex-Linked TDD micro-steps plan**
5. Presents plan to developer before execution

**Key principle:** brain-plan does NOT re-load context that brain-dev already loaded. It reads the dev-context handoff file.

**Plan output includes:**
- Sinapse index (all referenced [[sinapse-id]] notations)
- File structure (all files before any micro-step)
- TDD micro-steps with spec-first acceptance gates
- Dependency DAG with parallelizable groups annotated (for reference)
- Model recommendation per step (Haiku/Sonnet/Codex)

---

### Phase 4 — Subagent Dispatch (brain-dev as controller, brain-task as worker)

Execution model: **sequential fresh subagents** (superpowers SDD pattern).

```
brain-dev reads plan → creates TodoWrite with all steps
  → for each step:
      dispatch brain-task as fresh subagent (full task text + context, no file reading)
      subagent implements → tests → commits → self-reviews
      dispatch spec-compliance reviewer subagent
      if issues → brain-task fixes → re-review
      dispatch code-quality reviewer subagent
      if issues → brain-task fixes → re-review
      mark step complete
  → post-execution: brain-lesson if learnings detected
```

**Why sequential not parallel:** Git conflicts, easier to review between steps, matches superpowers SDD. Speed gain comes from fresh context per subagent (no context pollution), not parallelism.

**Model selection per step:** Use the model complexity table. Mechanical steps (1-2 files, clear spec) → Haiku. Integration steps → Sonnet. Architecture/judgment → Codex.

---

## Changes to Existing Skills

### brain-decision → absorbed into brain-dev
brain-decision's classification + routing logic lives inside brain-dev Phase 1. brain-decision SKILL.md is retired as a developer-facing command. Its logic is not deleted — it moves into brain-dev.

### brain-plan → redesigned (interactive Q&A layer)
- **Add:** Q&A phase (1-3 questions, one at a time, like superpowers brainstorming)
- **Add:** Approach proposals (2 options + recommendation)
- **Add:** Reads `dev-context-{task_id}.md` from brain-dev instead of re-loading context
- **Fix:** Remove parallel dispatch language — execution is sequential with fresh subagents
- **Fix:** `--dispatch` flag renamed to `--subagents` (means sequential subagent dispatch, not parallel)

### brain-task → stays, redesigned as worker
- **Keep:** All 6 pipeline steps (context load → execution context → implementation → post-task)
- **Change:** CASE B (called directly) warning updated for brain-dev subagent dispatch
- **Change:** Step 1 context loading is the ONLY place context is loaded (brain-decision no longer calls brain-map)
- **Add:** Accepts handoff from brain-dev via `dev-context-{task_id}.md` (skips re-classification)

### brain-aside → absorbed into brain-consult
brain-aside's pipeline-check-and-remind behavior (20 lines) moves into brain-consult Step 1. brain-aside SKILL.md is retired.

### brain-decision fixes (before it's absorbed)
- Remove MetalShopping / `$ms` section (dead content from previous project)
- Add priority override row to model selection table: `any | debugging → Opus (priority override)`
- Fix plan mode flow: brain-map owned by brain-task Step 1 only, not brain-decision

---

## What Gets Automated (scripts, not LLM)

The implementation planning should identify which operations can move to scripts:

| Operation | Current | Target |
|-----------|---------|--------|
| Subagent dispatch loop | LLM inline | brain-dev SKILL.md (LLM orchestrates, but loop logic is in the skill spec) |
| dev-context file creation | LLM tool calls | brain-dev writes via Write tool (1 tool call, structured JSON/MD) |
| Plan parsing (extract tasks) | LLM reads plan file | Script: `scripts/brain-parse-plan.js` — extracts micro-steps to JSON |
| TodoWrite population | LLM iterates | Scripted from plan JSON output |
| Spec/quality reviewer dispatch | LLM | brain-dev SKILL.md (subagent dispatch, same as superpowers SDD) |

---

## Files Affected

| Action | File | Change |
|--------|------|--------|
| Create | `skills/brain-dev/SKILL.md` | New primary entry point skill |
| Rewrite | `skills/brain-plan/SKILL.md` | Add Q&A + approach proposals + handoff file support |
| Update | `skills/brain-task/SKILL.md` | CASE B fix, context loading ownership clarification |
| Update | `skills/brain-decision/SKILL.md` | Fixes before absorption: remove MetalShopping, fix model table, fix plan mode |
| Update | `skills/brain-consult/SKILL.md` | Absorb brain-aside pipeline-check logic |
| Retire | `skills/brain-aside/SKILL.md` | Mark as absorbed into brain-consult |
| Create | `scripts/brain-parse-plan.js` | Parse micro-steps from plan MD to JSON |
| Update | `README.md` | New skill count, brain-dev row in skill table, updated flow diagram |
| Update | `CHANGELOG.md` | v0.9.0 entry |

---

## Success Criteria

- [ ] `/brain-dev "investigate why shipping cost with EAN isn't returning"` → classifies as fix/debug → routes to brain-consult → Opus
- [ ] `/brain-dev "implement product recommendations feature"` → classifies as build → brain-plan Q&A (2 questions) → plan → subagent dispatch
- [ ] `/brain-dev "add a button to the page"` → classifies as build < 20 → brain-task directly, no plan
- [ ] brain-plan asks one question at a time, proposes 2 approaches before generating plan
- [ ] Each subagent gets full task text (no file reading), implements, commits, gets reviewed
- [ ] Score 45 debugging task routes to Opus (not Codex)
- [ ] Plan mode context loaded exactly once (brain-task Step 1 only)

---

## What brain-dev Does NOT Do

- Does not ask questions unless intent is unclassifiable
- Does not re-load context that brain-plan will load
- Does not implement anything itself — routes to brain-plan or brain-consult
- Does not dispatch parallel subagents — always sequential
- Does not replace brain-consult for questions/investigations
