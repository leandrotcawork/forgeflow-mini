#!/usr/bin/env bash
# brain-verify.sh — 6-Phase Verification Script
# Runs build, types, lint, tests, security, and diff phases.
# Outputs JSON to stdout; diagnostics to stderr.
# Exit codes: 0=GO, 1=NO_GO, 2=invalid usage

set -uo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
PHASE=""
JSON_MODE=0
PROJECT_ROOT="."

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  cat >&2 <<EOF
Usage: $0 [--phase 1|2|3|4|5|6] [--json] [--project-root <path>]

Options:
  --phase N         Run only phase N (1-6)
  --json            Force JSON output (default when stdout is not a tty)
  --project-root P  Project root directory (default: .)

Phases:
  1  Build       Compile / bundle (BLOCKING)
  2  Types       Type checker
  3  Lint        Linter
  4  Tests       Test suite
  5  Security    Hardcoded secrets scan (BLOCKING)
  6  Diff        git diff summary
EOF
  exit 2
}

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      [[ $# -lt 2 ]] && usage
      PHASE="$2"
      if ! [[ "$PHASE" =~ ^[1-6]$ ]]; then
        echo "Error: --phase must be 1-6" >&2
        exit 2
      fi
      shift 2
      ;;
    --json)
      JSON_MODE=1
      shift
      ;;
    --project-root)
      [[ $# -lt 2 ]] && usage
      PROJECT_ROOT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Error: unknown option '$1'" >&2
      usage
      ;;
  esac
done

# ── Resolve project root ─────────────────────────────────────────────────────
if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "Error: project root '$PROJECT_ROOT' is not a directory" >&2
  exit 2
fi
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
cd "$PROJECT_ROOT"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[brain-verify] $*" >&2; }

# Phase result storage (associative arrays)
declare -A PHASE_NAME PHASE_STATUS PHASE_CMD PHASE_EXIT PHASE_SUMMARY

init_phase() {
  local n="$1" name="$2"
  PHASE_NAME[$n]="$name"
  PHASE_STATUS[$n]="SKIP"
  PHASE_CMD[$n]="null"
  PHASE_EXIT[$n]=0
  PHASE_SUMMARY[$n]="not run"
}

init_phase 1 "build"
init_phase 2 "types"
init_phase 3 "lint"
init_phase 4 "tests"
init_phase 5 "security"
init_phase 6 "diff"

BLOCKING_FAILURE=""

# Run a command, capture exit code and last N lines of output
run_check() {
  local phase="$1" cmd="$2" blocking="${3:-0}"
  PHASE_CMD[$phase]="$cmd"
  log "Phase $phase (${PHASE_NAME[$phase]}): running '$cmd'"

  local output exit_code
  if output=$(eval "$cmd" 2>&1); then
    exit_code=0
  else
    exit_code=$?
  fi
  PHASE_EXIT[$phase]=$exit_code

  if [[ $exit_code -eq 0 ]]; then
    PHASE_STATUS[$phase]="PASS"
    PHASE_SUMMARY[$phase]="ok"
    log "Phase $phase: PASS"
  else
    PHASE_STATUS[$phase]="FAIL"
    # Grab last 3 lines as summary
    local tail_out
    tail_out=$(echo "$output" | tail -3 | tr '\n' ' ' | sed 's/  */ /g' | head -c 200)
    PHASE_SUMMARY[$phase]="${tail_out:-exit code $exit_code}"
    log "Phase $phase: FAIL (exit $exit_code)"
    if [[ "$blocking" == "1" ]]; then
      BLOCKING_FAILURE="Phase $phase (${PHASE_NAME[$phase]}) failed"
    fi
  fi
}

# ── Phase 1: Build ────────────────────────────────────────────────────────────
phase_build() {
  log "Phase 1: Detecting build system..."
  if [[ -f "package.json" ]]; then
    # Check if build script exists
    if grep -q '"build"' package.json 2>/dev/null; then
      run_check 1 "npm run build" 1
      return
    fi
  fi
  if [[ -f "packages.json" ]]; then
    # forgeflow-mini style — no build step in packages.json
    :
  fi
  if [[ -f "Makefile" ]] && grep -q '^build:' Makefile 2>/dev/null; then
    run_check 1 "make build" 1
    return
  fi
  if [[ -f "go.mod" ]]; then
    run_check 1 "go build ./..." 1
    return
  fi
  if [[ -f "Cargo.toml" ]]; then
    run_check 1 "cargo build" 1
    return
  fi
  # No build system detected
  PHASE_STATUS[1]="SKIP"
  PHASE_SUMMARY[1]="no build system detected"
  log "Phase 1: SKIP — no build system detected"
}

# ── Phase 2: Types ────────────────────────────────────────────────────────────
phase_types() {
  log "Phase 2: Detecting type checker..."
  if [[ -f "tsconfig.json" ]]; then
    run_check 2 "npx tsc --noEmit" 0
    return
  fi
  if [[ -f "pyproject.toml" ]] && grep -q 'mypy' pyproject.toml 2>/dev/null; then
    run_check 2 "mypy ." 0
    return
  fi
  if [[ -f "go.mod" ]]; then
    run_check 2 "go vet ./..." 0
    return
  fi
  PHASE_STATUS[2]="SKIP"
  PHASE_SUMMARY[2]="no type checker detected"
  log "Phase 2: SKIP — no type checker detected"
}

# ── Phase 3: Lint ─────────────────────────────────────────────────────────────
phase_lint() {
  log "Phase 3: Detecting linter..."
  if [[ -f "package.json" ]]; then
    if grep -q '"lint"' package.json 2>/dev/null; then
      run_check 3 "npm run lint" 0
      return
    fi
  fi
  if [[ -f "pyproject.toml" ]] && (grep -q 'ruff' pyproject.toml 2>/dev/null || command -v ruff &>/dev/null); then
    run_check 3 "ruff check ." 0
    return
  fi
  if [[ -f "go.mod" ]] && command -v golangci-lint &>/dev/null; then
    run_check 3 "golangci-lint run" 0
    return
  fi
  PHASE_STATUS[3]="SKIP"
  PHASE_SUMMARY[3]="no linter detected"
  log "Phase 3: SKIP — no linter detected"
}

# ── Phase 4: Tests ────────────────────────────────────────────────────────────
phase_tests() {
  log "Phase 4: Detecting test runner..."
  if [[ -f "package.json" ]]; then
    if grep -q '"test"' package.json 2>/dev/null; then
      run_check 4 "npm test" 0
      return
    fi
  fi
  if [[ -f "pyproject.toml" ]] && command -v pytest &>/dev/null; then
    run_check 4 "pytest" 0
    return
  fi
  if [[ -f "go.mod" ]]; then
    run_check 4 "go test ./..." 0
    return
  fi
  if [[ -f "Cargo.toml" ]]; then
    run_check 4 "cargo test" 0
    return
  fi
  PHASE_STATUS[4]="SKIP"
  PHASE_SUMMARY[4]="no test runner detected"
  log "Phase 4: SKIP — no test runner detected"
}

# ── Phase 5: Security ────────────────────────────────────────────────────────
phase_security() {
  log "Phase 5: Scanning for hardcoded secrets..."
  PHASE_CMD[5]="grep -rn secret patterns"

  local findings=""
  # Find source files and grep for secret patterns
  if command -v grep &>/dev/null; then
    findings=$(grep -rn \
      -E '(password|secret|api_key|token)\s*[:=]\s*["'"'"'][^"'"'"']{8,}' \
      --include='*.ts' --include='*.js' --include='*.py' --include='*.go' \
      . 2>/dev/null || true)
  fi

  # Filter out common false positives (test files, examples, comments about patterns)
  if [[ -n "$findings" ]]; then
    # Remove lines that are clearly pattern definitions or documentation
    local real_findings
    real_findings=$(echo "$findings" | grep -v 'brain-verify\.sh' | grep -v '\.test\.' | grep -v 'example' || true)
    if [[ -n "$real_findings" ]]; then
      local count
      count=$(echo "$real_findings" | wc -l | tr -d ' ')
      PHASE_STATUS[5]="FAIL"
      PHASE_EXIT[5]=1
      PHASE_SUMMARY[5]="$count potential secret(s) found"
      BLOCKING_FAILURE="Phase 5 (security) — hardcoded secrets detected"
      log "Phase 5: FAIL — $count finding(s)"
      return
    fi
  fi

  PHASE_STATUS[5]="PASS"
  PHASE_EXIT[5]=0
  PHASE_SUMMARY[5]="no secrets detected"
  log "Phase 5: PASS"
}

# ── Phase 6: Diff ─────────────────────────────────────────────────────────────
phase_diff() {
  log "Phase 6: Collecting diff stats..."
  PHASE_CMD[6]="git diff --stat"

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    PHASE_STATUS[6]="SKIP"
    PHASE_SUMMARY[6]="not a git repository"
    log "Phase 6: SKIP — not a git repo"
    return
  fi

  local file_count
  # Count distinct changed files (staged + unstaged, deduplicated)
  file_count=$(git diff --name-only HEAD 2>/dev/null | sort -u | wc -l | tr -d ' ')
  # Fallback: if HEAD doesn't exist (initial commit), union staged and unstaged
  if [[ "$file_count" -eq 0 ]]; then
    file_count=$(
      { git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; } \
        | sort -u | wc -l | tr -d ' '
    )
  fi

  PHASE_STATUS[6]="PASS"
  PHASE_EXIT[6]=0
  if [[ "$file_count" -eq 0 ]]; then
    PHASE_SUMMARY[6]="working tree clean"
  else
    PHASE_SUMMARY[6]="$file_count file(s) changed"
  fi
  log "Phase 6: PASS — ${PHASE_SUMMARY[6]}"
}

# ── Run phases ────────────────────────────────────────────────────────────────
PHASES_TO_RUN=(1 2 3 4 5 6)
if [[ -n "$PHASE" ]]; then
  PHASES_TO_RUN=("$PHASE")
fi

for p in "${PHASES_TO_RUN[@]}"; do
  case "$p" in
    1) phase_build ;;
    2) phase_types ;;
    3) phase_lint ;;
    4) phase_tests ;;
    5) phase_security ;;
    6) phase_diff ;;
  esac
  # Stop on blocking failure
  if [[ -n "$BLOCKING_FAILURE" ]]; then
    log "BLOCKING failure — stopping pipeline"
    break
  fi
done

# ── Compute verdict ──────────────────────────────────────────────────────────
if [[ -n "$BLOCKING_FAILURE" ]]; then
  OVERALL="NO_GO"
else
  OVERALL="GO"
fi

# ── JSON output ──────────────────────────────────────────────────────────────
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

json_str_or_null() {
  if [[ "$1" == "null" ]]; then
    printf 'null'
  else
    printf '"%s"' "$(json_escape "$1")"
  fi
}

# Build phases JSON
PHASES_JSON="{"
first=1
for p in 1 2 3 4 5 6; do
  [[ $first -eq 0 ]] && PHASES_JSON+=","
  first=0
  PHASES_JSON+="\"$p\":{\"name\":\"${PHASE_NAME[$p]}\",\"status\":\"${PHASE_STATUS[$p]}\",\"command\":$(json_str_or_null "${PHASE_CMD[$p]}"),\"exit_code\":${PHASE_EXIT[$p]},\"summary\":\"$(json_escape "${PHASE_SUMMARY[$p]}")\"}"
done
PHASES_JSON+="}"

BF_JSON="null"
[[ -n "$BLOCKING_FAILURE" ]] && BF_JSON="\"$(json_escape "$BLOCKING_FAILURE")\""

cat <<EOF
{
  "project_root": "$(json_escape "$PROJECT_ROOT")",
  "overall_verdict": "$OVERALL",
  "blocking_failure": $BF_JSON,
  "phases": $PHASES_JSON
}
EOF

# ── Exit code ─────────────────────────────────────────────────────────────────
if [[ "$OVERALL" == "GO" ]]; then
  exit 0
else
  exit 1
fi
