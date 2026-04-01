# Smoke Test 04: Verify Fails

**Validates:** Stop hook blocks session finalization when `verify_status ≠ passed`; phase stays at VERIFYING; brain-document does not run.

---

## Setup

1. Run a full flow through brain-review (both reviewers PASS)
2. Manually corrupt `workflow-state.json` to force a verify failure:
   ```json
   {
     "phase": "VERIFYING",
     "verify_status": "pending",
     "review_status": "passed"
   }
   ```
3. Simulate brain-verify returning NO-GO (e.g., a test fails)

## Test Steps

1. With `phase: VERIFYING` and `verify_status: pending`, attempt to end the session (Stop event)

2. The stop hook must BLOCK finalization

3. Check the block message contains:
   - The task_id
   - The current phase (`VERIFYING`)
   - The current verify_status (`pending`)
   - Required action: "Run brain-verify to completion"

4. Verify `workflow-state.json` still shows:
   - `phase: VERIFYING` (unchanged)
   - `verify_status: pending` (unchanged)

5. Confirm brain-document has NOT been invoked (no episode file exists)

## Expected Block Message

```
Session end blocked: task 'YYYY-MM-DD-task-name' is in phase 'VERIFYING' with verify_status='pending'.
Run brain-verify to completion before ending the session.
Required action: complete brain-verify → brain-document → phase COMPLETED.
```

## Pass Criteria

- Stop event is blocked (not silently ignored)
- Block message names the task_id, phase, and verify_status
- Block message provides actionable next steps
- `workflow-state.json` phase remains `VERIFYING`
- `.brain/episodes/` does not contain an episode for this task
- No commit was generated
