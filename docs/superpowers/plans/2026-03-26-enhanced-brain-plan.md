# Plan B: Enhanced brain-plan with Cortex-Linked TDD Planning

**Date:** 2026-03-26
**Status:** Completed
**Scope:** brain-plan, brain-task, brain-decision, plugin.json

---

## Problem Statement

The existing brain-plan skill produces high-level subtasks (description + files + acceptance criteria) but lacks:
- Test-first discipline: subtasks do not mandate writing specs before implementation
- File structure design: no upfront file inventory, leading to ad-hoc file creation
- Sinapse linking: convention references use prose instead of `[[sinapse-id]]` notation, making them invisible to subagents
- Self-review: no checklist to catch placeholders, missing specs, or unlinked conventions
- Dispatch readiness: plans cannot be executed by brain-task Path F (subagent-per-step) because subtasks are too coarse

## Solution: Cortex-Linked TDD Planning

Upgrade brain-plan to produce **expanded plans** (`plan_type: expanded`) with TDD micro-steps that are self-contained enough for subagent dispatch.

---

## Tasks

### Tasks 1-3: Rewrite brain-plan SKILL.md

**File:** `skills/brain-plan/SKILL.md`

Replaced the subtask format with a 6-stage planning workflow:

1. **Stage 1: Analyze Context Packet** — Build a sinapse index mapping every convention to its `[[sinapse-id]]`
2. **Stage 2: File Structure Design** — Complete file inventory table (path, action, purpose, dependencies) before any micro-step decomposition
3. **Stage 3: TDD Micro-Steps** — Each micro-step follows spec-first pattern: write failing test, write implementation, verify green. Includes sinapse-linked conventions, concrete test cases, exact commands, and dependency DAG
4. **Stage 4: Conflict Detection** — Cross-reference micro-steps against sinapse index for ADR, convention, and lesson violations
5. **Stage 5: Self-Review Checklist** — 10-item mandatory checklist enforcing no-placeholders rule, sinapse linking, valid DAG, and complete specs
6. **Stage 6: Token Budget** — Per-step estimates with dispatch recommendations

Output format includes `plan_type: expanded` in metadata, `dispatch_ready` flag, and subagent model recommendations per step.

### Task 4: Add brain-task Path F (Dispatcher Mode)

**File:** `skills/brain-task/SKILL.md`

Added Path F after Path E in the Step 3 dispatch decision tree:

- **Step F.1:** Read and validate expanded plan (micro-step count, file structure, sinapse index)
- **Step F.2:** Execute micro-steps in dependency order — one subagent per step with self-contained prompts including inlined sinapse content, spec sections, and acceptance gates
- **Step F.3:** Parallel dispatch for independent micro-steps (groups from topological sort)
- **Step F.4:** Plan completion checkpoint with full/partial/failed status handling

Updated Path E to check `plan_type` in frontmatter — expanded plans route to Path F, standard plans stay on Path E.

Added `--dispatch` flag to quick reference and Path F entries to subagent dispatch summary.

### Task 5: Update brain-decision plan-mode section

**File:** `skills/brain-decision/SKILL.md`

Updated Step 4 (plan mode) to describe:
- Cortex-Linked TDD plan output format
- `plan_type: expanded` routing to Path F
- `--dispatch` flag for parallel execution
- Clarification that legacy plans route to Path E

### Task 6: Update plugin.json descriptions

**File:** `.claude-plugin/plugin.json`

- Top-level description: added "TDD micro-step planning" to feature list
- brain-plan skill description: updated to reflect Cortex-Linked TDD capability

### Task 7: Create plan document

**File:** `docs/superpowers/plans/2026-03-26-enhanced-brain-plan.md` (this file)

Record of the enhancement for future reference.

---

## Architecture Impact

```
brain-decision Step 4 (plan mode)
  → Invokes /brain-plan
    → Produces plan_type: expanded (NEW)
      → brain-task detects expanded plan
        → Routes to Path F (NEW) instead of Path E
          → Dispatches subagent per TDD micro-step
          → Runs spec review after each
          → Supports parallel dispatch for independent steps
```

**Backward compatibility:** Plans without `plan_type` or with `plan_type: standard` continue to use Path E (inline sequential execution). No existing behavior is broken.

## Files Changed

| File | Change |
|------|--------|
| `skills/brain-plan/SKILL.md` | Full rewrite — 6-stage TDD planning workflow |
| `skills/brain-task/SKILL.md` | Added Path F, updated Path E with plan_type check |
| `skills/brain-decision/SKILL.md` | Updated plan-mode section for expanded plans |
| `.claude-plugin/plugin.json` | Updated descriptions |
| `docs/superpowers/plans/2026-03-26-enhanced-brain-plan.md` | Plan document (this file) |
