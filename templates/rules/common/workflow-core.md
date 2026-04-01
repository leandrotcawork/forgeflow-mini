# ForgeFlow Workflow Core Rules

## The Non-Negotiable Flow

Every development task follows this exact sequence, no exceptions:

```
/brain-dev → brain-spec → USER APPROVAL → brain-plan → brain-task
  → brain-review → brain-verify → brain-document
```

## Phase Gates

- **Write gate:** No file may be written or edited before `plan_status = approved`
- **Stop gate:** Session may not end before `verify_status = passed`
- **Spec gate:** No plan may be written before the user approves the spec
- **Review gate:** brain-verify may not run before `review_status = passed`
- **Document gate:** brain-document may not run before `verify_status = passed`

## What ForgeFlow Prevents

- Skipping spec or plan ("just implement it quickly")
- Writing code without knowing what files are allowed
- Ending a session before verification
- Making architectural decisions during implementation (those belong in planning)

## When You Are Stuck

If you cannot proceed because a gate is blocking you, do not bypass it.
Instead: return to the previous phase and fix the root cause.
