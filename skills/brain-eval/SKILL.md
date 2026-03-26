---
name: brain-eval
description: Define success criteria before implementation â€” capability evals and regression evals
---

# brain-eval â€” Eval-Driven Development

Define testable success criteria BEFORE implementation begins.

## When to Use
- Before brain-task Step 3 (implementation)
- When acceptance criteria need to be precise
- When the task could break existing functionality

## Eval Types

### Capability Eval
"Can the system do X after this change?"
- Define: input, expected output, grader
- Grader types: code-based (test assertion), command-based (CLI exit code), manual (developer verifies)

### Regression Eval
"Does Y still work after this change?"
- Define: existing test suite or manual check
- Run BEFORE implementation (baseline) and AFTER (verify no regression)

## Workflow

Step 1: Read task description from brain-decision
Step 2: Propose 2-3 capability evals + 1-2 regression evals
Step 3: Developer approves or modifies evals
Step 4: Write evals to .brain/working-memory/evals-{task_id}.md
Step 5: brain-task Step 3 references evals during implementation
Step 6: brain-verify Phase 4 runs eval checks

## Output Format
.brain/working-memory/evals-{task_id}.md:
  - Capability: [description] â†’ [pass condition] â†’ [grader]
  - Regression: [description] â†’ [test command] â†’ [baseline result]

## Token Budget
3k in / 2k out
