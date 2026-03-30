# Verification Phases — Detailed Reference

brain-verify runs 6 phases in order. Two are BLOCKING (pipeline stops on failure).

## Phase 1: Build Check — BLOCKING

Detect build system in this order (first match wins):
1. `package.json` → look for `scripts.build` → run `npm run build`
2. `Makefile` → run `make`
3. `go.mod` → run `go build ./...`
4. `Cargo.toml` → run `cargo build`

If none found → **SKIP** (no build system detected).

**PASS:** exit code 0.
**FAIL:** report full error output. Pipeline stops — code cannot compile.

## Phase 2: Type Check — non-blocking

Detect type checker:
- TypeScript → `npx tsc --noEmit`
- Python (mypy installed) → `mypy .`
- Go → `go vet ./...`

If none found → **SKIP**.

**PASS:** no type errors. **FAIL:** report errors, warn, continue pipeline.

## Phase 3: Lint Check — non-blocking

Read linter from `brain.config.json` field `linter`, or detect by extension:

| Extension     | Command                       |
|---------------|-------------------------------|
| `.ts`, `.js`  | `eslint .` or `biome check .` |
| `.py`         | `ruff check .`                |
| `.go`         | `golangci-lint run`           |
| `.rs`         | `cargo clippy`                |

If `brain.config.json` specifies a linter, use that command directly.
If none found → **SKIP**. PASS: no errors (warnings OK). FAIL: warn, continue.

## Phase 4: Test Check — non-blocking

Detect test runner (first match wins):
1. `package.json` with `scripts.test` → `npm test`
2. `pytest.ini` or `pyproject.toml` with pytest → `pytest`
3. `go.mod` → `go test ./...`
4. `Cargo.toml` → `cargo test`

If none found → **SKIP** (no test runner detected).

**PASS:** all tests pass (exit code 0). **FAIL:** report failing tests, warn, continue.

## Phase 5: Security Scan — BLOCKING

Grep the codebase for:
- Hardcoded secrets: `API_KEY = "..."`, `password = "..."`, `secret = "..."`
- AWS keys: `AKIA[0-9A-Z]{16}`
- Private keys: `-----BEGIN (RSA|EC|DSA) PRIVATE KEY-----`
- SQL injection: string concatenation in queries (`"SELECT.*" +`, `f"SELECT.*{`)
- Tokens in code: `ghp_`, `sk-`, `Bearer [a-zA-Z0-9]`

Exclude: `.env.example`, test fixtures, `node_modules/`, `vendor/`.

**PASS:** no matches found.
**FAIL:** report matches with file:line. Pipeline stops — security risk.

## Phase 6: Diff Review — non-blocking

Run `git diff --stat` to review changes:
- Flag unexpected changes (files outside task scope)
- Flag large binary files (> 1MB)
- Flag generated files committed by accident (`dist/`, `build/`, `.next/`)

**PASS:** changes look scoped and intentional.
**WARN:** unexpected files changed — note in report, continue pipeline.

## Execution Rules

1. Run phases in order (1 → 6). On BLOCKING failure, skip remaining phases.
2. Each phase MUST execute a real command — no assumed results.
3. Unavailable tool → verdict is SKIP, never PASS.
4. Collect all results into the verification report table.
