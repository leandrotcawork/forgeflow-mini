# ForgeFlow v3 Architecture

ForgeFlow v3 is a deterministic execution kernel with consultive memory. Public commands stay simple; the internal workflow is fixed, explicit, and linear.

## Principles

- Deterministic control flow: the kernel follows the same stage order every time.
- Consultive memory: prior knowledge can inform decisions, but it cannot silently change the workflow.
- Explicit handoffs: each stage reads a named artifact and writes the next one.
- Narrow public surface: users interact through a small set of commands, not internal phases.
- Verification before documentation: memory updates happen after checks, not before.
- No hidden branching: failures stop or redirect the pipeline openly.

## Public Commands

| Command | Purpose |
|---|---|
| `/brain-dev` | Main entry point for build, fix, and plan requests. |
| `/brain-debug` | Deterministic diagnostic path for stuck or failing work. |
| `/brain-improve` | Review and reconcile existing work against conventions. |
| `/brain-consult` | Ask questions or request guidance from memory and context. |
| `/brain-config` | Configure the brain system and project settings. |
| `/brain-health` | Inspect health, staleness, and review status. |

## Internal Pipeline

The v3 kernel uses a fixed internal sequence:

`brain-dev -> brain-spec -> brain-plan -> brain-task -> brain-review -> brain-verify -> brain-document`

### `brain-dev`

Classifies the request, captures the goal, and decides whether the flow needs planning or can proceed directly.

### `brain-spec`

Turns the user request into a bounded specification: scope, constraints, acceptance criteria, and risks.

### `brain-plan`

Converts the specification into an execution plan with concrete steps, file targets, and validation checks.

### `brain-task`

Implements the plan. This stage changes files, runs local checks, and records the concrete result of the work.

### `brain-review`

Checks the implementation against the spec and plan before verification. This is a structural review of correctness and scope.

### `brain-verify`

Runs the deterministic quality gate. Verification must rely on actual outputs, not on the implementation summary.

### `brain-document`

Writes the approved knowledge update after the work is verified. This is the only stage that promotes new memory.

## Workflow Guarantees

- A stage only consumes the artifact produced by the previous stage.
- Memory is advisory, not authoritative.
- Public commands do not expose internal implementation details.
- Verification is required before documentation updates.
- Review findings must be visible before a change is accepted.
- The pipeline is linear and repeatable; reruns produce the same stage order.
- If a stage fails, the failure is explicit and the next stage does not run.
