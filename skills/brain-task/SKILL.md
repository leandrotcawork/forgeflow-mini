---
name: brain-task
description: Full task orchestration — context assembly → implementation → documentation → archival + cleanup
---

# brain-task Skill — Task Orchestrator

## Pipeline Position

```
brain-decision → brain-map → brain-task → [brain-codex-review] → [TaskCompleted hook] → brain-document → brain-consolidate
                              ↑ you are here
```

**Purpose:** Execute a task end-to-end using assembled brain context.

**Token Budget:** 60-150k per task (varies by complexity and implementation)

**Entry-point rule:** If `/brain-task [description]` is called directly by the user (without prior brain-decision routing), brain-task MUST invoke brain-decision first to classify and route. brain-task never executes without classification.

**Trigger:** `/brain-task [description]` | `/brain-task --plan [description]` | `/brain-task --lightweight [description]`

---

## Pre-Execution Checklist

Before running `/brain-task [description]`, verify:

- [ ] Task description is clear (what are we building/reviewing/fixing?)
- [ ] Understand task type: code review | implementation | debugging?
- [ ] Read `hippocampus/brain-workflow.md` for file location rules
- [ ] Read `hippocampus/brain-task-execution.md` for step-by-step scaffolding
- [ ] Know the task domain: backend | frontend | database | infra | analytics

**Note:** These files are auto-generated in each Brain from this skill during brain-init. They provide local reference copies of the workflow.

---

## File Location Guardrails

⚠️ **CRITICAL:** All task artifacts go to `.brain/working-memory/` during Steps 1-5, then archived in Step 6.

### ✅ Correct File Locations

| Step | File Pattern | Location | Absolute Rule |
|------|---------|----------|---|
| 1 | `context-packet-{task_id}.md` | `.brain/working-memory/` | ✅ ALL |
| 2 | `codex-context-{task_id}.md` | `.brain/working-memory/` | ✅ ALL |
| 2 | `opus-debug-context-{task_id}.md` | `.brain/working-memory/` | ✅ ALL |
| 4 | `task-completion-{task_id}.md` | `.brain/working-memory/` | ✅ ALL |
| 5 | `sinapse-updates-{task_id}.md` | `.brain/working-memory/` | ✅ ALL |
| 6 | `{task_id}-*.md` | `.brain/progress/completed-contexts/` | ✅ ARCHIVE |

### ❌ Common Location Errors

| Error | Wrong Location | Correct Location | Why |
|-------|---|---|---|
| Review saved as file | `tasks/analytics-review.md` | `.brain/working-memory/task-completion-[id].md` | Task artifacts are ephemeral |
| Plan in sprint backlog | `tasks/implementation-plan.md` | `.brain/working-memory/codex-context-[id].md` | Plans go to working-memory during execution |
| Artifact in docs | `docs/brain-review.md` | `.brain/working-memory/task-completion-[id].md` | Docs are permanent; task artifacts are temporary |
| Task in cortex | `.brain/cortex/task-xyz.md` | `.brain/working-memory/` | Cortex stores curated domain knowledge (sinapses + domain-local lessons), not transient task artifacts |

**Enforcement:** If you find yourself saving task artifacts anywhere except `.brain/working-memory/`, stop and re-read this guardrails section.

---

## Execution Modes

| Mode | Flag | Context Loading | Context File | Implementation |
|------|------|----------------|--------------|----------------|
| **Codex** | (default) | Tier 1 + 2 (+ Tier 3 if critical) | codex-context.md | Codex MCP or Claude fallback |
| **Opus** | `--debug` | Tier 1 + 2 | opus-debug-context-{task_id}.md | Claude Opus (root cause analysis) |
| **Lightweight** | `--lightweight` | Tier 1 only (~4k tokens) | None (context packet sufficient) | Claude implements directly |

**Lightweight mode** is used for Haiku-scored tasks (complexity < 20). It follows the same pipeline but with reduced overhead — still tracked in activity.md, still fires TaskCompleted hook, still creates working-memory artifacts.

---

## Workflow

### Step 1: Load Context (ContextMapper)

Assemble sinapses using 3-tier loading:

**Tier 1 (always, ~4k tokens):**
- Hippocampus summary: architecture.md + conventions.md (condensed)
- Top 3 lessons matching task domain from brain.db
- Task description

**Tier 2 (domain-specific, ~10-15k tokens):**
- Query brain.db: `SELECT * FROM sinapses WHERE region LIKE '%{domain}%' ORDER BY weight DESC LIMIT 5`
- Load top 5 sinapses by weight in relevant cortex region
- Include tags + links for context

**Tier 3 (on-demand, ~5k tokens):**
- Additional sinapses explicitly linked in Tier 2 content
- Load only if ContextMapper flags critical
- Query: `SELECT target_id FROM sinapse_links WHERE source_id IN (...) LIMIT 3`

**Output:** `working-memory/context-packet.md` with assembled sinapses

---

### Step 2: Generate Execution Context (brain-decision route)

Create task-specific context file based on model selection from brain-decision:

**If plan mode was active** (via brain-decision Step 4 or `--plan` flag): read `working-memory/implementation-plan-{task_id}.md` and incorporate the plan's subtasks and acceptance criteria into the execution context file.

**For Codex** (80% of tasks):

Create: `working-memory/codex-context.md`

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

---

### Step 3: Execute Implementation

**Flow depends on model selected by brain-decision:**

#### **For Codex Model (via MCP):**

```
1. Context file: codex-context.md (generated in Step 2)
2. Call codex-cli MCP server:
   codex_response = invoke MCP tool "codex-execute" with:
   - context_file: working-memory/codex-context.md
   - task_id: YYYY-MM-DD-<slug>
   - domain: [backend | frontend | database | infra]

3. codex-cli MCP server does:
   - Read codex-context.md
   - Send to Codex VSCode extension API
   - Receive implementation response
   - Return response to brain-task

4. Review Codex output and integrate:
   - Accept changes: commit to files
   - Reject changes: document reason in task-completion-record.md
   - Partial accept: merge manually + note deviation

5. Continue to TaskCompleted hook (Steps 4-6 are automated)
```

**Fallback (if MCP unavailable):** Claude implements directly using codex-context.md as the brief — read it fully, apply all sinapses and guard rails, run tests after.

**MCP Integration Details:**

```
Available MCP Servers (both connected at user scope):
  codex-cli: npx @cexll/codex-mcp-server  ← primary
  codex:     codex mcp-server              ← alternative

Tool: codex-execute
Inputs:
  - context_file (path): working-memory/codex-context.md
  - task_id: YYYY-MM-DD-<slug>
  - domain (string): backend | frontend | database | infra
Outputs:
  - generated_code (string): implementation from Codex
  - explanation (string): Codex reasoning
  - files_affected (array): list of files Codex targets
```

#### **For Opus Model (Debugging):**

```
1. Context file: opus-debug-context-{task_id}.md (generated in Step 2)
2. This skill guides diagnosis:
   - Read error message + stack trace carefully
   - Check similar lessons (do we have this pattern documented?)
   - Root cause analysis
   - Propose fix
   - Execute fix (may invoke Opus via claude.ai if needed)
3. Continue to Step 4 (documentation proposals)
```

---

### Steps 4-6: Post-Task Documentation, Archival & Commit

**Owned entirely by the TaskCompleted hook in settings.json. brain-task does NOT run these steps.**

When implementation is complete and tests pass, signal completion. The hook fires automatically and runs the full post-task sequence:

1. Generates `working-memory/task-completion-[task-id].md`
2. Invokes `/brain-document` → proposes `sinapse-updates-[task-id].md`
3. Archives context files to `progress/completed-contexts/`
4. Appends entry to `progress/activity.md`
5. Updates MEMORY.md if a durable project fact was established
6. Commits all changes via `/commit`
7. Checks if 5+ tasks have accumulated → suggests `/brain-consolidate`

**Why the hook owns this:** Centralizes post-task logic in one place. If brain-task also ran Steps 4-6, files would be written twice, archival would fail on already-moved files, and commits would duplicate. Single responsibility: brain-task = context + implementation. Hook = documentation + archival + commit.

---

## Context Assembly

Context assembly is owned by brain-map. See brain-map SKILL.md for the canonical 3-tier loading algorithm, SQL queries, and token budgets.

---

## Files Created/Used During Task

| File | Purpose | Created | Archived | Cleared |
|------|---------|---------|----------|---------|
| `working-memory/context-packet.md` | Assembled sinapses from Tier 1+2 | Step 1 | — | Step 6 |
| `working-memory/codex-context.md` | Execution context for Codex (sent to extension) | Step 2 | progress/completed-contexts/ | Step 6 |
| `working-memory/opus-debug-context-{task_id}.md` | Execution context for Opus (debugging) | Step 2 | progress/completed-contexts/ | Step 6 |
| `working-memory/task-completion-record.md` | Outcome + files + tests + lessons | Step 4 | progress/completed-contexts/ | Step 6 |
| `working-memory/sinapse-updates.md` | Proposed sinapses updates (developer approves) | Step 5 | — | Step 6 |
| `progress/completed-contexts/[id]-*.md` | Archived context (permanent learning record) | Step 6 | — | Never |
| `progress/completed-contexts/[id]-OUTCOME.md` | Outcome analysis for pattern matching | Step 6 | — | Never |
| `progress/activity.md` | Running activity log (all tasks) | — | — | Never |

---

## Trigger Conditions

| Input | Behavior |
|-------|----------|
| `/brain-task [description]` | Invokes brain-decision first → routes → Step 1→3 → hook |
| `/brain-task --debug [description]` | Opus debugging mode: Tier 1+2, opus-debug-context-{task_id}.md, root cause analysis |
| `/brain-task --plan [description]` | Force plan mode: EnterPlanMode before Step 1 |
| `/brain-task --lightweight [description]` | Haiku mode: Tier 1 only, no context file, direct implementation |
| After brain-decision classification | Model selection already made, proceed with Step 1 |

---

## Anti-Patterns

### Execution Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Skip context assembly (Step 1) | Codex works blind, lower quality | Always run Step 1 + Step 2 |
| Auto-update sinapses | Changes made without developer approval | TaskCompleted hook proposes via brain-document, never auto-writes |
| Keep stale working-memory files | Confusion about which context is current | TaskCompleted hook archives + clears automatically |
| Delete context files (no archive) | Can't learn from task (why did it fail?) | Hook archives to progress/completed-contexts/ |
| Forget to record outcome | No learning loop (context → outcome analysis) | Hook creates task-completion record + OUTCOME.md |
| Mix brain-task with $ms workflow | Conflicting context sources | Keep separate: use brain-task OR $ms, not both |
| Codex on critical bugs | Wrong model for root cause analysis | Use Opus for critical/unfamiliar errors |

### File Location Anti-Patterns (Most Common)

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Save review to `tasks/` | Tasks are sprint backlog (permanent), not ephemeral artifacts | Save to `.brain/working-memory/task-completion-[id].md` |
| Save plan to `tasks/` | Plans are execution context, not action items | Save to `.brain/working-memory/codex-context-[id].md` |
| Save artifact to `docs/` | Docs are permanent; task artifacts are temporary | Save to `.brain/working-memory/` during Steps 1-3 |
| Save task artifacts to `.brain/cortex/` | Cortex stores curated domain knowledge, not transient tasks | Save to `.brain/working-memory/` |
| Delete working-memory files | Files are learning data (why did task fail?) | TaskCompleted hook archives to `.brain/progress/completed-contexts/` |
| Skip completing the task | Hook never fires, working-memory accumulates stale files | Always signal task completion so hook runs cleanup |

---

## Testing Checklist

brain-task is working when:

- [ ] `/brain-task "Add button to page"` generates context-packet.md + codex-context.md
- [ ] codex-context.md contains 2+ real code examples from actual codebase
- [ ] codex-context.md lists common mistakes from hippocampus/conventions.md
- [ ] After implementation: TaskCompleted hook fires automatically
- [ ] Hook creates task-completion-[task-id].md in working-memory/
- [ ] Hook invokes brain-document → sinapse-updates-[task-id].md proposed (not auto-written)
- [ ] Hook archives context files to progress/completed-contexts/
- [ ] Hook appends entry to progress/activity.md
- [ ] Hook commits all changes
- [ ] 5+ entries in activity.md → hook suggests brain-consolidate

---

## Local Reference Documentation

This skill is the canonical, reusable workflow definition. Each Brain project should have local reference copies auto-generated by brain-init:

**Auto-generated during brain-init:**
- `hippocampus/brain-workflow.md` — File locations + lifecycle (copy of this guardrails section)
- `hippocampus/brain-task-execution.md` — Step-by-step scaffolding + checklists (copy of Steps 1-3 + hook handoff)

**Why two locations?**
- **Skill** = canonical definition (all projects use this)
- **Brain** = local reference (developers see it immediately, no dig into plugin files)

**If skill changes:** Run brain-init to regenerate local copies in `.brain/hippocampus/`

**If local copies get out of sync:** Compare `.brain/hippocampus/brain-workflow.md` with this skill. Skill is source of truth.

---

**Created:** 2026-03-25 | **Agent Type:** Orchestrator | **Last Updated:** 2026-03-25
