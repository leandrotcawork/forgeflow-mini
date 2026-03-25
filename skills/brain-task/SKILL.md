---
name: brain-task
description: Full task orchestration — context assembly → implementation → documentation → archival + cleanup
---

# brain-task Skill — Task Orchestrator

**Purpose:** Execute a task end-to-end using assembled brain context. Called after brain-decision routes to this skill with model selection.

**Token Budget:** 60-150k per task (varies by complexity and implementation)

**Trigger:** `/brain-task [description]` (after brain-decision classification) or `/brain-task --plan [description]`

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

**For Codex** (80% of tasks):

Create: `working-memory/codex-context.md`

```markdown
---
task_id: [uuid from brain-decision]
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
- See: lessons/lesson-0042.md — "Same pattern, different context"
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

Create: `working-memory/opus-debug-context.md`

```markdown
---
task_id: [uuid]
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
(From lessons/ matching error keywords)
- lessons/lesson-0035.md — "Same error, different module"
- cortex/backend/lessons/lesson-0042.md — "Root cause was X"

---
```

---

### Step 3: Execute Implementation

**Flow depends on model selected by brain-decision:**

#### **For Codex Model:**

```
1. Context file: codex-context.md (generated in Step 2)
2. Open the file in your editor (working-memory/codex-context.md)
3. Invoke Codex VSCode extension with @context
   - Codex reads prepared context
   - Generates implementation
   - You review and integrate
4. Continue to Step 4 (documentation proposals)
```

#### **For Opus Model (Debugging):**

```
1. Context file: opus-debug-context.md (generated in Step 2)
2. This skill guides diagnosis:
   - Read error message + stack trace carefully
   - Check similar lessons (do we have this pattern documented?)
   - Root cause analysis
   - Propose fix
   - Execute fix
3. Continue to Step 4 (documentation proposals)
```

---

### Step 4: Document Outcomes

After implementation is complete and tests pass:

**Create:** `working-memory/task-completion-record.md`

```markdown
---
task_id: [uuid]
description: [original task]
status: success | failed
model_used: [codex | opus | haiku]
complexity_score: [0-100]
duration_minutes: [N]
tokens_estimated: [N]
files_changed: [count]
tests_passed: [yes/no]
created_at: [ISO8601]
---

## What Was Built

[Brief summary of what was implemented]

## Files Changed

- apps/server_core/internal/modules/[module]/[file].go — +N lines, -M lines
- apps/web/src/[component].tsx — +P lines
- [...]

## Tests

- [Test 1]: [OK] PASS
- [Test 2]: [OK] PASS
- [Test 3]: [Error] FAIL (reason: [])

## Sinapses Used

(Which sinapses were loaded and used for this task?)
- [[sinapse-1]] — Used for [pattern X]
- [[sinapse-2]] — Used for [pattern Y]

## Lessons Identified

(During implementation, did you discover something new to document?)
- New pattern: [description] → should become lesson-XXXX.md
- Mistake found: [description] → document in cortex/[domain]/lessons/lesson-XXXX.md

---
```

---

### Step 5: Propose Documentation Updates

After task completion, invoke brain-document to propose sinapse updates (no auto-write):

**Output:** `working-memory/sinapse-updates.md` (developer review required)

```
For each sinapse loaded in this task:
- If sinapse is now outdated: propose update with diff
- If sinapse needs new backlink to related sinapses: suggest
- If task revealed new pattern: propose new sinapse for cortex/[domain]/

Never auto-write — always propose for developer approval.
```

---

### Step 6: Archive Context & Clear Working Memory

**At task completion, after developer approves/rejects sinapse-updates.md:**

**Archive context files to permanent record:**

```bash
# Move context files to progress/completed-contexts/
mv working-memory/codex-context.md \
   progress/completed-contexts/[task-id]-codex-context.md

mv working-memory/opus-context.md \
   progress/completed-contexts/[task-id]-opus-context.md

# Archive completion record with metadata
mv working-memory/task-completion-record.md \
   progress/completed-contexts/[task-id]-completion-record.md
```

**Record outcome in progress/completed-contexts/[task-id]-OUTCOME.md:**

```markdown
---
task_id: [uuid]
status: success | failed
root_cause: [if failed]
context_size: [N lines]
sinapses_loaded: [N]
created_at: [ISO8601]
---

# Task [task-id] — Outcome

## Result

[Brief outcome: "Feature implemented successfully" or "Debug fixed data leak"]

## What Context Had

- Sinapses: [N] (domains: backend, frontend)
- Lessons: [N] (domains: backend, cross-domain)
- Code examples: [N] patterns shown

## What Worked Well

- [Pattern A from context was helpful]
- [Pattern B prevented mistake X]

## What Was Missing (if any)

- [Missing context: should have loaded lesson-00NN]
- [Missing pattern: new sinapse needed for cortex/backend]

## For Future

- Create lesson-XXXX.md: [pattern found during task]
- Update sinapse-YYYY.md: [information became stale]
- Add example code: [new pattern discovered]

---
```

**Clear working memory (remove stale files):**

```bash
rm: working-memory/codex-context.md (archived ✓)
rm: working-memory/opus-context.md (archived ✓)
rm: working-memory/current-task.md (if present)
rm: working-memory/context-packet.md (if present)
rm: working-memory/task-completion-record.md (archived ✓)
rm: working-memory/sinapse-updates.md (processed)

# Keep only:
# - working-memory/sinapse-review.md (developer's approval record)
```

**Update progress activity log:**

Append to `progress/activity.md`:

```markdown
## [timestamp] Task [task-id]

- **Description:** [task]
- **Model:** [codex | opus | haiku]
- **Status:** [success | failed]
- **Duration:** [M] min
- **Tokens:** ~[N]k
- **Files:** [P] changed
- **Context:** [N sinapses] + [N lessons]
- **Archive:** progress/completed-contexts/[task-id]-*.md
```

---

## Context Assembly Algorithm (Tier 1+2)

```python
def assemble_context(task_description, domain):
    """Assemble sinapses for task context."""

    tier1 = {
        'hippocampus_architecture': condense(load_file('hippocampus/architecture.md')),
        'hippocampus_conventions': condense(load_file('hippocampus/conventions.md')),
        'top_lessons': query_db(
            'SELECT * FROM lessons WHERE domain=? ORDER BY weight DESC LIMIT 3',
            domain
        ),
        'task': task_description,
    }

    tier2 = {
        'domain_sinapses': query_db(
            'SELECT * FROM sinapses WHERE region LIKE ? ORDER BY weight DESC LIMIT 5',
            f'%{domain}%'
        ),
        'cross_cutting': query_db(
            'SELECT * FROM sinapses WHERE region LIKE "sinapses/%" ORDER BY weight DESC LIMIT 2'
        )
    }

    # Tier 3 available on-demand if needed
    return {
        'tier1': tier1,         # ~4k tokens
        'tier2': tier2,         # ~10-15k tokens
        'tier3_available': True
    }
```

---

## Files Created/Used During Task

| File | Purpose | Created | Archived | Cleared |
|------|---------|---------|----------|---------|
| `working-memory/context-packet.md` | Assembled sinapses from Tier 1+2 | Step 1 | — | Step 6 |
| `working-memory/codex-context.md` | Execution context for Codex (sent to extension) | Step 2 | progress/completed-contexts/ | Step 6 |
| `working-memory/opus-context.md` | Execution context for Opus (debugging) | Step 2 | progress/completed-contexts/ | Step 6 |
| `working-memory/task-completion-record.md` | Outcome + files + tests + lessons | Step 4 | progress/completed-contexts/ | Step 6 |
| `working-memory/sinapse-updates.md` | Proposed sinapses updates (developer approves) | Step 5 | — | Step 6 |
| `progress/completed-contexts/[id]-*.md` | Archived context (permanent learning record) | Step 6 | — | Never |
| `progress/completed-contexts/[id]-OUTCOME.md` | Outcome analysis for pattern matching | Step 6 | — | Never |
| `progress/activity.md` | Running activity log (all tasks) | — | — | Never |

---

## Trigger Conditions

| Input | Behavior |
|-------|----------|
| `/brain-task [description]` | Normal flow: brain-decision routes, Step 1→6 |
| `/brain-task --plan [description]` | Force plan mode: EnterPlanMode before Step 1 |
| After brain-decision classification | Model selection already made, proceed with Step 2 |

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Skip context assembly (Step 1) | Codex works blind, lower quality | Always run Step 1 + Step 2 |
| Auto-update sinapses | Changes made without developer approval | Always propose in Step 5, wait for approval |
| Keep stale working-memory files | Confusion about which context is current | Always archive + clear in Step 6 |
| Delete context files (no archive) | Can't learn from task (why did it fail?) | Always archive to progress/completed-contexts/ |
| Forget to record outcome | No learning loop (context → outcome analysis) | Always create [task-id]-OUTCOME.md |
| Mix brain-task with $ms workflow | Conflicting context sources | Keep separate: use brain-task OR $ms, not both |
| Codex on critical bugs | Wrong model for root cause analysis | Use Opus for critical/unfamiliar errors |

---

## Testing Checklist

brain-task is working when:

- [ ] `/brain-task "Add button to page"` generates context-packet.md + codex-context.md
- [ ] codex-context.md contains 2+ real code examples from actual codebase
- [ ] codex-context.md lists common mistakes from hippocampus/conventions.md
- [ ] After implementation: task-completion-record.md created with files, tests, lessons
- [ ] After completion: context files archived to progress/completed-contexts/
- [ ] After completion: [task-id]-OUTCOME.md created for pattern analysis
- [ ] After completion: working-memory/ cleared (no stale codex/opus context files)
- [ ] progress/activity.md appended with task entry
- [ ] sinapse-updates.md proposed (not auto-written)
- [ ] 3+ tasks completed → suggests brain-consolidate

---

**Created:** 2026-03-25 | **Phase:** 5 | **Agent Type:** Orchestrator
