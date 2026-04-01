# Smoke Test 05: Review Fails

**Validates:** brain-review returns FAIL; routes back to brain-task with feedback; no proceed to verify.

---

## Setup

1. Run a full flow through brain-task (implementer completes with DONE)
2. `workflow-state.json` has `phase: REVIEWING`

## Test Steps — Spec Compliance Fails

1. brain-review dispatches spec-compliance-reviewer
2. Spec-compliance-reviewer returns FAIL with:
   - One unmet acceptance criterion
   - One scope creep finding

3. brain-review must:
   - NOT dispatch code-quality-reviewer (gate: spec must pass first)
   - Update `workflow-state.json`:
     ```json
     { "phase": "IMPLEMENTING", "review_status": "pending" }
     ```
   - Return to brain-task with the spec-compliance failure findings as feedback

4. Verify `workflow-state.json` shows `phase: IMPLEMENTING`
5. Verify brain-verify was NOT invoked (no verification file exists)

## Test Steps — Code Quality Fails

1. After spec compliance passes, brain-review dispatches code-quality-reviewer
2. Code-quality-reviewer returns FAIL with a Critical finding
3. brain-review must:
   - Update `workflow-state.json`:
     ```json
     { "phase": "IMPLEMENTING", "review_status": "pending" }
     ```
   - Return to brain-task with the quality findings as feedback
4. Verify brain-verify was NOT invoked

## Pass Criteria

- Spec compliance FAIL: code-quality-reviewer is NOT dispatched
- Either FAIL: brain-task receives specific findings with file:line references
- Either FAIL: `workflow-state.json` phase is `IMPLEMENTING` (not `VERIFYING`)
- Either FAIL: no verification file exists in `.brain/verifications/`
- After fix and re-review: flow proceeds normally to brain-verify
