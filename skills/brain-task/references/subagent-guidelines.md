# Subagent Guidelines

## What Subagents Receive

Each subagent is dispatched with a self-contained prompt (~300-400 lines max):

1. **Prompt template** — role-specific instructions (implementer, spec-reviewer,
   or code-reviewer) from `prompts/`.
2. **Implementation plan** — the approved plan from brain-plan output.
3. **Context packet** — project conventions, file map, and relevant state from
   `.brain/working-memory/context-packet-{task_id}.md`.
4. **Conventions summary** — naming, formatting, and structural rules extracted
   from the context packet.

The goal is a **complete, self-contained prompt** that requires zero additional
context to execute.

## What Subagents Do NOT Receive

- Session history or conversation context
- Full `.brain/` directory contents
- Other skill definitions
- Previous subagent outputs (unless explicitly passed in a review cycle)
- Working memory or brain state

Subagents are stateless. Each dispatch is independent.

## Dispatch Modes

Dispatch mode is determined by the task's complexity score:

| Score   | Mode             | Description                              |
|---------|------------------|------------------------------------------|
| < 20    | Inline           | Execute directly, no subagent dispatch   |
| 20–39   | Single subagent  | Dispatch implementer only                |
| 40–74   | Subagent+review  | Dispatch implementer, then spec-reviewer |
| >= 75   | Dual review      | Implementer + spec-reviewer + code-reviewer |

### Inline Mode
- Brain-task executes the plan directly in the current session.
- No subagent prompt is assembled.
- Suitable for trivial changes (rename, config tweak, small fix).

### Single Subagent
- Assemble implementer prompt with plan + context.
- Dispatch and wait for completion.
- Verify output, proceed to post-task.

### Subagent + Review
- Dispatch implementer.
- On completion, dispatch spec-reviewer with plan + changed files.
- If spec-reviewer finds issues, feed back to implementer (max 2 cycles).
- Proceed to post-task after PASS or max cycles.

### Dual Review
- Dispatch implementer.
- Dispatch spec-reviewer (plan compliance).
- Dispatch code-reviewer (code quality).
- If either reviewer finds **blocking** issues, feed back to implementer
  (max 2 cycles).
- Proceed to post-task after PASS or max cycles.

## Fallback Strategy

When a subagent fails or produces unacceptable output:

1. **Retry once** — re-dispatch with the same prompt + failure context.
2. **Fall back to inline** — if retry fails, execute the plan directly in
   the current session.
3. **Log failure** — record the failure in `.brain/activity.md` with cause.

## Strategy Rotation on Test Failures

When tests fail after implementation, rotate strategy before retrying:

1. **Alternative approach** — re-read the plan and attempt a different
   implementation path.
2. **Minimal approach** — implement the smallest possible change that
   satisfies the plan.
3. **Escalate** — if both alternatives fail, mark task as blocked and
   report to user with failure details.

Each rotation is a new subagent dispatch (not a retry of the same prompt).
The failure context from the previous attempt is included in the new prompt.
