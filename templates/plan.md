# Plan: {task_id}

## Execution Strategy

> Describe the overall approach: what will be built in what order and why.

## Agent Selection

| Agent | Responsibility |
|-------|----------------|
| implementer | Write code per spec and plan |

## Allowed Files

> List every file the implementer is permitted to create or modify.
> Pre-tool-use hook will BLOCK writes to any file not listed here.

- `path/to/file.ext`

## TDD Micro-Steps

> Numbered steps — each must be independently testable.
> Format: write failing test → implement → pass → commit.

1. Write failing test for [behavior]
2. Run test — expect FAIL
3. Implement minimal code to pass
4. Run test — expect PASS
5. Commit: `type(scope): description`

## Verify Plan

> Define the exact commands to run during brain-verify.

- **Build:** `<build command>`
- **Types:** `<type check command>`
- **Lint:** `<lint command>`
- **Tests:** `<test command>`
- **Security:** `<security scan command>`
- **Diff:** Review `git diff main..HEAD` for scope creep
