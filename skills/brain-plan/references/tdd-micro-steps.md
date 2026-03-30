# TDD Micro-Steps Reference

## Decomposition Rules

- One step = one observable change
- Each step takes max 5 minutes of agent work
- Each step is independently verifiable
- Each step produces a testable artifact (file, test, config)
- No step depends on ambient context — everything is explicit

## TDD Cycle

Every implementation step follows RED-GREEN-REFACTOR:

1. **RED** — Write a failing test that defines the expected behavior
2. **GREEN** — Write the minimal code to make the test pass
3. **REFACTOR** — Clean up without changing behavior, re-run tests

Never skip RED. Never write implementation before the test exists.

## Step Types

| Type          | Description                              | Starts With |
|---------------|------------------------------------------|-------------|
| test-first    | Write spec, then implementation          | Failing test |
| file-setup    | Create file, config, or scaffold         | File creation |
| integration   | Wire modules together, verify end-to-end | Integration test |
| refactor      | Restructure without behavior change      | All tests green |

## Complexity-to-Steps Mapping

| Score   | Steps  | Dispatch Mode           |
|---------|--------|-------------------------|
| < 20    | 1-3    | inline                  |
| 20-39   | 3-8    | single subagent         |
| 40-74   | 8-20   | subagent + code-reviewer |
| 75+     | 20+    | dual review (spec + code) |

Steps must not exceed 25 total. If decomposition exceeds 25,
split into multiple plans.

## Sinapse Linking

For each step, check the context-packet for:

- Conventions that apply to the file being created/modified
- Lessons (especially failures) relevant to the domain
- ADR constraints that limit approach choices

Reference format: `[[sinapse-id]]` inline with the step description.
Every convention reference must link to a specific sinapse or lesson ID.

## Eval Criteria

Each step is evaluated on two axes:

**Capability eval** — Does the step produce the correct artifact?
- Test file exists and contains specified cases
- Implementation file exists and passes all tests
- No lint errors in touched files

**Regression eval** — Does the step break anything existing?
- Full test suite passes after the step
- No new lint warnings introduced
- Build succeeds with no errors

If either eval fails, the step must be fixed before proceeding.
Do not advance to the next step with a failing eval.
