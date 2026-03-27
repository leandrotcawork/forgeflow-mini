---
name: brain-verify
description: 6-phase implementation verification — build, types, lint, tests, security, diff review
---

# brain-verify — Implementation Verification

## Pipeline Position
Called by brain-task at Step 3.5, or manually via `/brain-verify`.

## Execution (Delegated to Script — v0.8.0)

Run all 6 phases via script:
```bash
bash scripts/brain-verify.sh --json --project-root .
```

Read the JSON output. LLM responsibility:
- If `overall_verdict: "GO"` -> continue pipeline
- If `overall_verdict: "NO_GO"` -> stop pipeline, report blocking phase to developer
- If any phase has `status: "FAIL"` but is non-blocking -> summarize and continue
- If any phase has `status: "WARN"` -> note in output
- Interpret ambiguous failures (the ONLY part requiring AI reasoning)

**Fallback:** If the script is unavailable or fails with exit code 3, fall back to running phases manually as described below.

## Execution Flow

Run these 6 phases IN ORDER. Stop on first blocking failure.

**Blocking phases (stop pipeline on failure):** Phase 1 (build fails — code cannot compile), Phase 5 (hardcoded secrets found — security risk).
**Non-blocking phases (warn and continue):** Phase 2 (type errors), Phase 3 (lint warnings), Phase 4 (test coverage below threshold), Phase 6 (unexpected file changes).
Command detection: try commands in order (e.g., for tests: npm test → pytest → go test → cargo test), use the first that exists and succeeds.

### Phase 1: Build Check
- Detect build system: package.json scripts.build, Makefile, go build, cargo build
- Run build command
- PASS: exit code 0 | FAIL: report errors

### Phase 2: Type Check
- Detect: tsc --noEmit, mypy, go vet
- PASS: no type errors | FAIL: report errors

### Phase 3: Lint Check
- Detect: eslint, biome, ruff, golangci-lint
- PASS: no errors (warnings OK) | FAIL: report errors

### Phase 4: Test Check
- Detect: npm test, pytest, go test, cargo test
- Run test suite
- PASS: all tests pass | FAIL: report failures

### Phase 5: Security Scan
- Check for: hardcoded secrets (API keys, passwords in code)
- Check for: SQL injection patterns
- Check for: XSS patterns (innerHTML, unsanitized HTML injection without sanitize)
- PASS: no issues | WARN: flag for review

### Phase 6: Diff Review
- Run git diff --stat
- Verify: no unintended files changed
- Verify: no large binary files added
- Output: summary of changes

## Output Format
VERIFICATION REPORT:
  Phase 1 (Build):    PASS | FAIL
  Phase 2 (Types):    PASS | FAIL | SKIP (no type checker)
  Phase 3 (Lint):     PASS | FAIL | SKIP (no linter)
  Phase 4 (Tests):    PASS | FAIL | SKIP (no test runner)
  Phase 5 (Security): PASS | WARN
  Phase 6 (Diff):     PASS | WARN

  Verdict: GO | NO-GO (reason)

## Token Budget
5k in / 3k out (runs tools, doesn't generate much text)
