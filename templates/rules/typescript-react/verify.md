# TypeScript + React Verify Commands

## Build
```bash
npm run build
```
PASS = exit 0. FAIL = build error.

## Types
```bash
npx tsc --noEmit
```
PASS = exit 0 with no errors. FAIL = type errors.

## Lint
```bash
npx eslint . --ext .ts,.tsx
```
PASS = 0 errors. FAIL = lint errors.

## Tests
```bash
npx vitest run
```
Or:
```bash
npm test
```
PASS = all tests pass. FAIL = any test failure.

## Security
```bash
grep -rn \
  -e "password\s*=\s*['\"][^'\"]\+" \
  -e "apiKey\s*=\s*['\"][^'\"]\+" \
  --include="*.ts" --include="*.tsx" . | grep -v "\.test\.\|\.spec\."
```
PASS = no output. FAIL = hardcoded secrets found.

## Diff
```bash
git diff --stat HEAD
```
Verify: only allowed_files changed.
