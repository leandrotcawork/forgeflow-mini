---
name: brain-verify
description: 6-phase implementation verification — build, types, lint, tests, security, diff review
---

# brain-verify — Implementation Verification

## Trigger

Called by brain-task at Step 3.5, or directly via `/brain-verify`.

## Iron Law

**NEVER output a GO verdict without actual tool output confirming it.**
No tool output = no verdict. If a phase tool is unavailable, verdict is **SKIP** — never PASS.

## Phases

| #  | Phase    | Blocking | What it checks              |
|----|----------|----------|-----------------------------|
| 1  | Build    | YES      | Code compiles / builds      |
| 2  | Types    | no       | Type-checker passes         |
| 3  | Lint     | no       | Linter reports no errors    |
| 4  | Tests    | no       | Test suite passes           |
| 5  | Security | YES      | No hardcoded secrets / SQLi |
| 6  | Diff     | no       | No unexpected file changes  |

> Details: [references/verification-phases.md](references/verification-phases.md)

## Execution

Run all 6 phases via script when available:
```bash
bash scripts/brain-verify.sh --json --project-root .
```

If script unavailable (exit code 3), fall back to running phases manually per
[verification-phases.md](references/verification-phases.md).

Run phases in order (1 → 6). Stop on first **BLOCKING** failure.

## Verdict

- **GO** — all blocking phases passed (non-blocking failures noted but allowed).
- **NO-GO** — any blocking phase failed. Report failures, return to brain-task.

## Report Format

```
VERIFICATION REPORT:
  Phase | Result | Details
  ------|--------|--------
  Build | PASS   | npm run build — exit 0
  Types | SKIP   | no type checker found
  Lint  | PASS   | eslint — 0 errors
  Tests | FAIL   | 2 tests failing (non-blocking)
  Sec.  | PASS   | no secrets detected
  Diff  | WARN   | 1 unexpected file changed

  Verdict: GO | NO-GO (reason)
```

## Rules

1. NEVER output GO without running commands — "looks fine" is not verification.
2. No tool output = no verdict. Every phase needs a real command result.
3. Unavailable tool → mark **SKIP**, not PASS.
4. On NO-GO: report blocking failures clearly, hand back to brain-task.

## Token Budget

5k in / 3k out
