---
name: brain-plan
description: Generate TDD implementation plans from context-packets
---

# brain-plan

Generate TDD implementation plans from context-packets with interactive
Q&A, micro-step decomposition, and convention conflict detection.

## Trigger

`/brain-plan <description>` or invoked by brain-dev after routing.

## Input

Requires a context-packet (`context-packet-{task_id}.md`).
If missing, call brain-map first to generate it.

## Budget

- Read: 500 tokens
- Output: 2k tokens
- Max steps: 25

## Phase 0: Clarify with User

Interactive clarification before planning. ONE question at a time.

- Ask 1-3 clarifying questions about scope, approach, or constraints
- Wait for answer before asking the next question
- Skip this phase entirely if complexity score < 30

Question priority:
1. Ambiguity in intent or scope
2. Implementation approach (when multiple valid options exist)
3. Constraints (backwards compat, zero-downtime, etc.)

## Phase 1: Load Context

1. Call brain-map if `context-packet-{task_id}.md` does not exist
2. Extract from context-packet:
   - Domain classification
   - Relevant conventions (with sinapse IDs)
   - Related lessons (failures to avoid)
   - Architecture constraints from ADRs
3. Read 2-3 files in the target domain to understand existing patterns

## Phase 2: Design File Structure

Before decomposing into steps, list ALL files to create or modify.

For each file specify:
- Full path from project root
- Action: `create` or `modify`
- Purpose (one line)
- Dependencies on other files

Prefer small, focused files. Follow project naming conventions.

## Phase 3: Decompose into Micro-Steps

Break the task into TDD micro-steps. See `references/tdd-micro-steps.md`.

Each step follows RED-GREEN-REFACTOR:
1. Write a failing test
2. Write minimal implementation to pass
3. Refactor if needed

Each step must be independently verifiable and take max 5 min of agent work.

Step format:
- Title, domain, files affected
- Spec: file path + concrete test cases
- Implementation: file path + pattern to follow + key decisions
- Acceptance gate: exact test/lint commands
- Dependencies: which steps must complete first

## Phase 4: Convention Conflict Check

Cross-reference each step against the context-packet:

- Does any step contradict an ADR?
- Does any step violate a convention from a linked sinapse?
- Does any step risk a known pitfall from a lesson?

Flag all conflicts for user review with concrete resolution.

## Phase 5: Determine Dispatch Mode

| Score  | Steps  | Mode                     |
|--------|--------|--------------------------|
| < 20   | 1-3    | inline                   |
| 20-39  | <= 8   | single subagent          |
| 40-74  | <= 20  | subagent + code-reviewer |
| >= 75  | 20+    | dual review (spec + code)|

## Phase 6: Write Plan

Use `templates/plan-document.md` to produce the final plan.

Fill in all placeholders:
- Goal, context (complexity, domain, conventions)
- File structure table
- Numbered steps with action/expected/files
- Verification commands (build, test, lint)
- Dispatch mode and reason

Output: `.brain/working-memory/implementation-plan-{task_id}.md`

## Next Step

After user approves the plan, invoke brain-task with the task_id.
brain-plan does not orchestrate execution — brain-task owns that.

Pipeline: `brain-dev -> brain-plan -> brain-task`
