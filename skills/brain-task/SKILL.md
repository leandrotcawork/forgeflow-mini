---
name: brain-task
description: Execute implementation plans via subagent dispatch (complex) or inline (trivial)
---

# brain-task — Subagent Dispatch

Execute implementation plans via subagent dispatch (complex) or inline (trivial).

## When Called

- By **brain-plan** after plan approval (score >= 20)
- By **brain-dev** directly for trivial tasks (score < 20)

## Input

- `implementation-plan` — approved plan from brain-plan (includes steps, files, complexity score)
- `dev-context` — context packet with conventions, file map, project state

---

## Step 1 — Load Plan & Determine Dispatch Mode

Read the implementation plan and extract the complexity score.

| Score   | Mode             | Action                                     |
|---------|------------------|--------------------------------------------|
| < 20    | Inline           | Execute directly in current session         |
| 20–39   | Single subagent  | Dispatch implementer only                   |
| 40–74   | Subagent+review  | Implementer → spec-reviewer                 |
| >= 75   | Dual review      | Implementer → spec-reviewer + code-reviewer |

See `references/subagent-guidelines.md` for full dispatch mode details.

## Step 2 — Assemble Subagent Prompt

**Skip if inline mode.**

1. Read `prompts/implementer.md` template.
2. Fill placeholders:
   - `{{task_description}}` — from plan header
   - `{{plan_content}}` — full plan steps
   - `{{context_packet_content}}` — from `.brain/working-memory/context-packet-{task_id}.md`
3. Verify assembled prompt is under 400 lines. If over, trim context to
   essential conventions only.

## Step 3 — Dispatch & Monitor

### Inline Mode (score < 20)
1. Execute plan steps directly in the current session.
2. Run verification after completion.
3. Skip to Step 4.

### Subagent Mode (score >= 20)
1. Dispatch implementer subagent with assembled prompt.
2. Wait for completion.
3. If dispatch mode includes review:
   a. Dispatch spec-reviewer with `prompts/spec-reviewer.md` + plan + changed files.
   b. If dual review: also dispatch code-reviewer with `prompts/code-reviewer.md`.
4. If reviewers find **blocking issues**:
   a. Feed issues back to implementer as additional context.
   b. Re-dispatch implementer (max **2 review cycles**).
   c. After max cycles, proceed with current state and note unresolved issues.
5. Collect final implementation summary.

## Step 4 — Post-Task

1. Update `.brain/working-memory/brain-state.json`:
   - Set `current_skill` to "brain-verify"
   - Record `last_task_result` (pass/fail, files changed)
2. Write `task-completion` entry to `.brain/working-memory/`:
   ```
   task: <description>
   status: complete | partial | failed
   files_changed: [list]
   review_cycles: N
   unresolved_issues: [list or none]
   ```
3. Append summary to `.brain/progress/activity.md`:
   ```
   - [HH:MM] brain-task: <description> → <status> (N files, M review cycles)
   ```

## Step 5 — Invoke brain-verify

Hand off to `brain-verify` for final validation (tests, lint, type-check).

---

## On Failure

When implementation fails (tests break, subagent produces bad output):

1. **Increment** `consecutive_failures` in brain-state.
2. **Strategy rotation** (see `references/subagent-guidelines.md`):
   - 1st failure → alternative approach
   - 2nd failure → minimal approach
   - 3rd failure → **circuit breaker** — stop, mark blocked, report to user
3. Each retry is a fresh subagent dispatch with failure context included.

## Budget

- SKILL.md: ~110-120 lines (this file)
- Subagent prompts: ~300-400 lines total across `prompts/` and `references/`

## File Structure

```
skills/brain-task/
├── SKILL.md                          # This file — dispatch logic
├── prompts/
│   ├── implementer.md                # Implementation agent template
│   ├── spec-reviewer.md              # Plan compliance reviewer
│   └── code-reviewer.md              # Code quality reviewer
└── references/
    └── subagent-guidelines.md        # Dispatch modes, fallbacks, strategy
```
