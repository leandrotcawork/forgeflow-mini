# Smoke Test 01: Simple Feature

**Validates:** Full flow executes end-to-end; all 5 artifacts created; auto-commit generated.

---

## Setup

1. Start with a clean project that has ForgeFlow initialized:
   ```bash
   ls .brain/working-memory/
   ls .claude/rules/
   ```
2. Confirm hooks are registered in `.claude/settings.json` (or equivalent)
3. Confirm `workflow-state.json` does not exist or has phase COMPLETED

## Test Steps

1. Run `/brain-dev "Add a hello-world utility function"`
2. brain-dev should:
   - Classify intent as `build`
   - Create `.brain/working-memory/dev-context-YYYY-MM-DD-hello-world.md`
   - Create `.brain/working-memory/workflow-state.json` with `phase: SPEC_PENDING`
   - Create worktree at `.worktrees/YYYY-MM-DD-hello-world`
   - Route to brain-spec

3. brain-spec should:
   - Execute search-first steps (repo, rules, brain, libs, web)
   - Write `.brain/specs/spec-YYYY-MM-DD-hello-world.md` with all sections populated
   - Dispatch spec-reviewer agent
   - Present spec + reviewer result for user approval

4. **User approves the spec**
   - `workflow-state.json` phase advances to `PLAN_PENDING`

5. brain-plan should:
   - Write `.brain/plans/plan-YYYY-MM-DD-hello-world.md` with TDD micro-steps
   - Set `plan_status: approved`, `phase: IMPLEMENTING`

6. brain-task should:
   - Dispatch implementer agent with spec + plan inlined
   - Implementer writes code following TDD steps
   - Phase advances to `REVIEWING`

7. brain-review should:
   - Dispatch spec-compliance-reviewer → PASS
   - Dispatch code-quality-reviewer → PASS
   - Write `.brain/reviews/review-YYYY-MM-DD-hello-world.md`
   - Phase advances to `VERIFYING`

8. brain-verify should:
   - Run 6-phase check (build/types/lint/tests/security/diff)
   - Write `.brain/verifications/verification-YYYY-MM-DD-hello-world.md`
   - Phase advances to `DOCUMENTING`

9. brain-document should:
   - Write `.brain/episodes/episode-YYYY-MM-DD-hello-world.md`
   - Generate auto-commit with message `feat(*): YYYY-MM-DD-hello-world — ... [forgeflow]`
   - Phase advances to `COMPLETED`

## Expected Artifacts

After completion, verify all 5 exist:
- [ ] `.brain/specs/spec-YYYY-MM-DD-hello-world.md`
- [ ] `.brain/plans/plan-YYYY-MM-DD-hello-world.md`
- [ ] `.brain/reviews/review-YYYY-MM-DD-hello-world.md`
- [ ] `.brain/verifications/verification-YYYY-MM-DD-hello-world.md`
- [ ] `.brain/episodes/episode-YYYY-MM-DD-hello-world.md`

## Pass Criteria

- All 5 artifacts exist with content in every section
- `workflow-state.json` has `phase: COMPLETED`
- Auto-commit exists on branch `forgeflow/YYYY-MM-DD-hello-world`
- No hook denials occurred during legitimate flow execution
