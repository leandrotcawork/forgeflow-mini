# Go Verify Commands

## Build
```bash
go build ./...
```
PASS = exit 0. FAIL = compile error.

## Types
```bash
go vet ./...
```
PASS = no output. FAIL = vet errors.

## Lint
```bash
golangci-lint run
```
Or if not available:
```bash
go vet ./...
staticcheck ./...
```
PASS = 0 errors. SKIP = linter not installed.

## Tests
```bash
go test ./... -v -race
```
PASS = all tests pass. FAIL = any test failure.

## Security
```bash
grep -rn \
  -e "password\s*=\s*\"[^\"]\+" \
  -e "secret\s*=\s*\"[^\"]\+" \
  --include="*.go" . | grep -v "_test.go"
```
PASS = no output. FAIL = hardcoded secrets found.

## Diff
```bash
git diff --stat HEAD
```
Verify: only allowed_files changed.
