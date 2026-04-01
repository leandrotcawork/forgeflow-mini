# Smoke Test 03: Edit Before Plan

**Validates:** PreToolUse hook blocks Write/Edit before `plan_status = approved`; state stays at SPEC_APPROVAL.

---

## Setup

1. Run `/brain-dev "Fix the user validation bug"`
2. Let brain-dev and brain-spec run
3. Stop at the USER APPROVAL GATE (do not approve the spec yet)
4. Verify `workflow-state.json` has:
   - `phase: SPEC_APPROVAL`
   - `plan_status: pending`

## Test Steps

1. While in `SPEC_APPROVAL` phase, attempt to directly write a source file:
   - Try to use the Write tool on any source file (e.g., `src/user.js`)
   
2. The pre-tool-use hook must BLOCK this write

3. Check the block message contains:
   - Current plan_status (`pending` or `reviewing`)
   - Current phase (`SPEC_APPROVAL`)
   - Instructions: "Complete brain-spec, get user approval, then run brain-plan"

4. Verify `workflow-state.json` still shows:
   - `phase: SPEC_APPROVAL` (unchanged)
   - `plan_status: pending` (unchanged)

## Expected Block Message

```
Write blocked: plan_status is 'pending' (must be 'approved').
Current phase: 'SPEC_APPROVAL'.
Complete brain-spec, get user approval, then run brain-plan before writing code.
```

## Pass Criteria

- Write attempt is blocked (not silently ignored)
- Block message names the exact plan_status and phase
- Block message provides actionable instructions
- `workflow-state.json` is unchanged after the denial
- No source files were written
