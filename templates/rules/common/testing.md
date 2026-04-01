# ForgeFlow Testing Rules

## TDD Is The Default

For all code-writing tasks:
1. Write the failing test first
2. Run it to confirm it fails
3. Write the minimal implementation to make it pass
4. Run it to confirm it passes
5. Commit the working test + implementation together

## What Counts as a Test

A test is something that runs automatically and fails when behavior is wrong.
- Unit test: tests one function/method in isolation
- Integration test: tests that two parts work together correctly
- Smoke test: tests that the system starts and basic paths work

## Verify Expectations

brain-verify runs these in order:
1. **Build** — the project compiles/parses without errors (blocking)
2. **Types** — type checker passes (non-blocking, warns)
3. **Lint** — linter passes (non-blocking, warns)
4. **Tests** — all tests pass (blocking)
5. **Security** — no obvious vulnerabilities (non-blocking, warns)
6. **Diff** — changed files are reasonable in scope

A task is not done until all blocking checks pass.
