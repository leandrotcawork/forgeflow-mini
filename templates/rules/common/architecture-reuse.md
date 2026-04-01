# ForgeFlow Architecture and Reuse Rules

## Search Before You Build

Before writing any new code, check in this order:

1. **Repo scan** — Does this already exist? Is there a similar module to extend?
2. **Rules** (`.claude/rules/`) — What conventions must I follow?
3. **Brain** (`.brain/`) — Has this problem been solved before? What was learned?
4. **Known libraries** — Is there a well-established library for this?
5. **Web research** — Only if steps 1-4 are insufficient

Every spec must document what was found in each step in the `## Reuse Strategy` section.

## Consistency Over Novelty

If the codebase already has a pattern for X, use that pattern for new X.
Do not invent a new pattern when an existing one works.

Inconsistency between similar modules is a defect, not a style choice.

## When to Create vs Reuse

Create something new only when:
- No existing component solves the problem
- Extending existing code would make it significantly worse
- The spec explicitly calls for a new component

## The Reuse Strategy Section

Every spec must have:
```
## Reuse Strategy
- Existing code found: [list of files/patterns found in step 1]
- Rules applied: [which rules from .claude/rules/ are relevant]
- Brain context: [any relevant episodes or sinapses]
- Decision: [what will be reused vs created new, and why]
```

If this section is empty, the spec is incomplete.
