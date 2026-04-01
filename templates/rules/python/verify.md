# Python Verify Commands

## Build / Import Check
```bash
python -c "import <module>"
```
Or for packages:
```bash
pip install -e . --dry-run
```
PASS = exit 0. FAIL = import error or install failure.

## Types
```bash
mypy . --strict
```
PASS = exit 0. SKIP = mypy not installed.

## Lint
```bash
ruff check .
```
PASS = 0 errors. FAIL = lint errors.

## Tests
```bash
pytest -v --tb=short
```
PASS = all tests pass. FAIL = any test failure.

## Security
```bash
grep -rn \
  -e "password\s*=\s*['\"][^'\"]\+" \
  -e "secret\s*=\s*['\"][^'\"]\+" \
  --include="*.py" . | grep -v "test_\|_test.py"
```
PASS = no output. FAIL = hardcoded secrets found.

## Diff
```bash
git diff --stat HEAD
```
Verify: only allowed_files changed.
