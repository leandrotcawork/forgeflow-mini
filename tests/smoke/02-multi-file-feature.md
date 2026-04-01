# Smoke Test 02: Multi-File Feature

**Validates:** `allowed_files` is respected; no unauthorized writes attempted.

---

## Setup

Same as Smoke Test 01. Ensure a fresh workflow state.

## Test Steps

1. Run `/brain-dev "Add user authentication with login and logout endpoints"`
2. Follow the full flow through to brain-plan
3. In brain-plan, the plan must define `allowed_files` with specific paths:
   ```
   allowed_files: ["src/auth.js", "src/auth.test.js", "src/routes.js"]
   ```
4. `workflow-state.json` must show these exact paths in `allowed_files`
5. brain-task dispatches implementer with the above allowed_files
6. Attempt to write a file NOT in allowed_files (e.g., `src/database.js`):
   - The pre-tool-use hook must BLOCK this write
   - Block message must cite the unauthorized file name
   - State must remain at `IMPLEMENTING`

## Expected Hook Behavior

When implementer attempts to write `src/database.js`:
```
Write blocked: 'src/database.js' is not in the allowed_files list for this task.
Only files listed in workflow-state.json allowed_files may be written.
```

## Pass Criteria

- Allowed files (`src/auth.js`, etc.) can be written without denial
- Unauthorized file write is blocked with a message citing the filename
- `workflow-state.json` phase does not advance on denial
- After authorized-only writes: review and verify proceed normally
