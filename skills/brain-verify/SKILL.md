---
name: brain-verify
description: 6-phase implementation verification — build, types, lint, tests, security, diff review
---

# brain-verify — Implementation Verification

## Trigger

Called by brain-task at Step 5, or directly via `/brain-verify`.

## Iron Law

**NEVER output a GO verdict without actual tool output confirming it.**

- No tool output = no verdict. Every phase needs a real command result.
- Script produces all SKIPs → run phases manually (instructions below). Do NOT accept SKIPs as PASS.
- "Looks fine" is not verification. Run the commands.
- Unavailable tool → mark **SKIP**, never PASS.

---

## Execution

First, try the automated script:

```bash
bash scripts/brain-verify.sh --json --project-root .
```

**If the script returns all SKIPs for phases 1–4:** the script cannot detect this project's toolchain. Run those phases manually using the commands in each phase section below.

Run phases in order: 1 → 6. **STOP immediately on the first BLOCKING failure.**

---

## Phase 1 — Build (BLOCKING)

Try each command in order. Stop at the first one that works.

```bash
npm run build                          # if package.json has a "build" script
node -c {main_entry_js_file}           # plain Node.js syntax check (e.g. node -c mcp/brain-config-server.js)
python -m py_compile {main_py_file}    # Python syntax check
go build ./...                         # Go
```

To find a Node.js entry file: check for `main` in `package.json`, or look for files in `mcp/`, `src/`, or the project root ending in `.js`.

PASS = exit 0. FAIL = exit non-zero (BLOCKING — stop here, report NO-GO). SKIP = no build system found.

---

## Phase 2 — Types (non-blocking)

```bash
npx tsc --noEmit    # TypeScript
mypy .              # Python
```

SKIP if neither tool is available. PASS = exit 0. FAIL = exit non-zero (note but continue).

---

## Phase 3 — Lint (non-blocking)

**Step 1: Check `.brain/brain.config.json` for configured linters.**

Read the `linters` section of `.brain/brain.config.json`:
```json
"linters": {
  ".js": "npx eslint --fix",
  ".py": "ruff check --fix",
  ".ts": "npx eslint --fix"
}
```

Run the linter command for each file extension touched in this task. Example: if `.js` files were modified and brain.config has `".js": "npx eslint --fix"`, run:

```bash
npx eslint --fix {changed_js_files}
```

**Step 2: If brain.config.json not found or linters section is empty**, try:

```bash
npx eslint .        # JavaScript/TypeScript
ruff check .        # Python
golangci-lint run   # Go
```

SKIP if no linter found. PASS = 0 errors. FAIL = errors found (note but continue).

---

## Phase 4 — Tests (non-blocking)

Try each in order until one succeeds:

```bash
npm test                                      # if package.json has "test" script
node tests/{relevant_test_file}.test.js       # plain Node.js test files
pytest                                        # Python
go test ./...                                 # Go
```

**To find Node.js test files:** `ls tests/*.test.js 2>/dev/null` or `ls tests/*.test.js` on Windows.

Run the most specific test file for the changed code first. If all tests pass, run the full suite.

PASS = exit 0 and all tests pass. FAIL = any test fails (note but continue).

---

## Phase 5 — Security (BLOCKING)

```bash
grep -rn \
  -e "password\s*=\s*['\"][^'\"]" \
  -e "secret\s*=\s*['\"][^'\"]" \
  -e "api_key\s*=\s*['\"][^'\"]" \
  -e "private_key\s*=\s*['\"][^'\"]" \
  --include="*.js" --include="*.ts" --include="*.py" \
  . 2>/dev/null | grep -v "test\|spec\|example\|\.env"
```

PASS = no output (no matches). FAIL = any match found (BLOCKING — stop here, report NO-GO).

---

## Phase 6 — Diff (non-blocking)

```bash
git diff --stat HEAD
```

Compare the changed files to the plan's file list. Flag any unexpected files as WARN.

PASS = all changes are expected. WARN = unexpected file changed (note but continue).

---

## Report Format

Always output this table with actual command results:

```
VERIFICATION REPORT:
  Phase | Result | Details
  ------|--------|--------
  Build | PASS   | node -c server.js — exit 0
  Types | SKIP   | no type checker found
  Lint  | PASS   | eslint (from brain.config) — 0 errors
  Tests | PASS   | node tests/server.test.js — 60/60
  Sec.  | PASS   | no secrets detected
  Diff  | PASS   | 2 files changed (expected)

  Verdict: GO
```

## Verdict

- **GO** — all BLOCKING phases passed (non-blocking failures are noted)
- **NO-GO** — any BLOCKING phase failed → report clearly, hand back to brain-task

---

**Refactored:** 2026-03-30 | **Token Budget:** 5k in / 3k out
