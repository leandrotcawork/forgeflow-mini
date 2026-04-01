---
name: brain-verify
description: Operational evidence verification only - build, types, lint, tests, security, and diff checks without design judgment.
---

# brain-verify -- Implementation Verification

Operational evidence only. brain-verify does not judge design quality, architecture choice, or plan quality.

## Trigger

Called by brain-review, or directly via `/brain-verify`.

## Hard Gates

1. Read `.brain/working-memory/workflow-state.json` first.
2. Stop unless `phase = "VERIFYING"` and `review_status = "passed"`.
3. If the gate fails, stop and return to `brain-review` without updating `verify_status` or `phase`.
4. Operational evidence only. Run commands and report results.
5. No design judgment, no architecture review, no plan approval.
6. No GO verdict without actual command output.
7. On success, update `.brain/working-memory/workflow-state.json` with `verify_status: "passed"` and `phase: "DOCUMENTING"`.

## Execution

Run phases in order and stop on the first blocking failure.

### Phase 1 - Build (blocking)

Try the first applicable command:

```bash
npm run build
node -c {main_entry_js_file}
python -m py_compile {main_py_file}
go build ./...
```

PASS = exit 0. FAIL = non-zero exit. SKIP = no build system found.

### Phase 2 - Types (non-blocking)

```bash
npx tsc --noEmit
mypy .
```

PASS = exit 0. FAIL = non-zero exit. SKIP = tool unavailable.

### Phase 3 - Lint (non-blocking)

Prefer configured project linters first. Otherwise try:

```bash
npx eslint .
ruff check .
golangci-lint run
```

PASS = 0 errors. FAIL = errors found. SKIP = no linter found.

### Phase 4 - Tests (non-blocking)

Try the most specific relevant test first, then broader suite if needed:

```bash
npm test
node tests/{relevant_test_file}.test.js
pytest
go test ./...
```

PASS = exit 0. FAIL = any failing test. SKIP = no test runner found.

### Phase 5 - Security (blocking)

```bash
grep -rn \
  -e "password\s*=\s*['\"][^'\"]" \
  -e "secret\s*=\s*['\"][^'\"]" \
  -e "api_key\s*=\s*['\"][^'\"]" \
  -e "private_key\s*=\s*['\"][^'\"]" \
  --include="*.js" --include="*.ts" --include="*.py" \
  . 2>/dev/null | grep -v "test\|spec\|example\|\.env"
```

PASS = no output. FAIL = any match found.

### Phase 6 - Diff (non-blocking)

```bash
git diff --stat HEAD
```

Operational evidence only: compare changed files to execution scope. Flag unexpected files as WARN. Do not turn this into design review.

## Report Format

Always output actual command evidence:

```text
VERIFICATION REPORT:
  Phase | Result | Details
  ------|--------|--------
  Build | PASS   | npm run build - exit 0
  Types | SKIP   | no type checker found
  Lint  | PASS   | eslint - 0 errors
  Tests | PASS   | npm test - all pass
  Sec.  | PASS   | no secrets detected
  Diff  | PASS   | expected files only

  Verdict: GO
```

## Verdict

- `GO` - all blocking phases passed
- `NO-GO` - any blocking phase failed; return to execution

## State Update

If verdict is `GO`, update `.brain/working-memory/workflow-state.json`:

```json
{
  "phase": "DOCUMENTING",
  "verify_status": "passed"
}
```

Also write the verification report to `.brain/verifications/verification-{task_id}.md` using the template at `templates/verification.md`.

If verdict is `NO-GO`, do not advance to DOCUMENTING.

## Pipeline

`brain-dev → brain-spec → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document`
