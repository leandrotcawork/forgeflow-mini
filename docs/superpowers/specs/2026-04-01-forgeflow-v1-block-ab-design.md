# ForgeFlow Mini — Block A + B Design Spec
## V1 Functional Flow: Foundation through Smoke Tests

**Date:** 2026-04-01  
**Scope:** PR-0 through PR-11 (Block A: Foundation + Block B: V1 Functional Flow)  
**Status:** Approved  
**Approach:** Option 3 — Foundation first, then layered flow (static artifacts → behavior + validation)  
**Sources:** ForgeFlow v3 Master Upgrade Plan + Codex Operational Doc  

---

## 1. Objective

Deliver a reliable, rigid, auditable V1 of ForgeFlow Mini where:

- `/brain-dev` runs the full development flow end-to-end without skipping any phase
- Hooks enforce the flow deterministically at the tool level
- Every task produces consistent, structured artifacts (spec, plan, review, verification, episode)
- Every code-writing task runs in an isolated worktree with an auto-commit on completion
- Smoke tests validate that the flow cannot be bypassed

**Out of scope:** Instinct system, observation pipeline, consolidation engine, brain-debug, brain-improve, brain-consult, install profiles (Core/Pro/Team), brain-health dashboarding beyond current state.

---

## 2. Core Principles (Non-Negotiable)

1. **No phase skipping** — spec → approval → plan → implement → review → verify → document. Every task, no exceptions.
2. **Spec before plan** — no plan without an approved spec.
3. **User approval gate** — spec must be approved by the user before implementation begins.
4. **Review ≠ verify** — review is qualitative (did we build it right?); verify is objective evidence (does it work?).
5. **Write gate** — `Write`/`Edit` blocked before `plan_approved`. `Stop` blocked without `verify_passed`.
6. **Search-first, reuse-first** — repo → `.claude/rules/` → `.brain/` → libs → web. Mandatory before spec.
7. **Worktree per task** — every code-writing task runs in `forgeflow/{task_id}` worktree on its own branch.
8. **Auto-commit, manual merge** — commit generated automatically after verify passes; merge is always manual.
9. **Memory is consultive** — brain enriches spec and plan but never authorizes skipping a phase.
10. **`.claude/rules/` vs `.brain/`** — rules are normative and stable; brain is memory, episodes, and proposals.

---

## 3. Implementation Approach

Three sequential layers, each verified before the next begins:

```
LAYER 0 — Foundation (PR-0 → PR-4)
  "Make the skeleton rigid"

LAYER 1 — Static Artifacts (PR-5 → PR-6)
  "Define the contracts before wiring the behavior"

LAYER 2 — Behavior + Validation (PR-7 → PR-11)
  "Wire the flow, add isolation, enforce reuse, validate everything"
```

No layer begins until the previous is functional and validated.

---

## 4. Layer 0 — Foundation (PR-0 to PR-4)

### PR-0: Freeze Architecture

**Objective:** Create a single stable reference document for V1 architecture.

**Deliverables:**
- Update `docs/architecture/forgeflow-v3.md` — expand the current 67-line stub into the full architecture doc covering: principles, public commands, internal pipeline, hook responsibilities, agent roles, `.claude/` vs `.brain/` separation, worktree strategy, and phased roadmap.

**Acceptance criteria:**
- Any new collaborator can understand the architecture without additional context
- No internal contradictions
- Phased roadmap (V1 → V1.5 → V2 → Vision) is documented

---

### PR-1: Clean brain-dev

**Objective:** Make brain-dev a pure classifier/router with no implementation behavior.

**Deliverables:**
- Remove complexity scoring (score 0-100, domain/risk/type modifiers) from `skills/brain-dev/SKILL.md`
- Remove any inline execution path or paths that skip spec/plan
- Remove orientation messages that suggest shortcuts
- brain-dev responsibilities after: classify intent → extract keywords → write `dev-context-{task_id}.md` → update `brain-state.json` → route to brain-spec or brain-consult → done

**Routing table (preserved):**
| Intent | Route |
|--------|-------|
| build, fix, refactor, improve, debug | brain-spec |
| consult, question, review | brain-consult |

**Acceptance criteria:**
- brain-dev never writes spec, plan, or code
- brain-dev never routes directly to brain-plan or brain-task
- No mention of score or complexity in the skill
- Orientation messages contain no skip suggestions

---

### PR-2: Rigid Workflow State

**Objective:** Create the blocking state machine that every task must pass through.

**Deliverables:**
- Define `workflow-state.json` schema with all V1 fields:

```json
{
  "task_id": "YYYY-MM-DD-{slug}",
  "worktree_name": "forgeflow/{task_id}",
  "branch_name": "forgeflow/{task_id}",
  "intent": "build|fix|refactor|improve|debug|consult|question|review",
  "phase": "SPEC_PENDING|SPEC_REVIEW|SPEC_APPROVAL|PLAN_PENDING|IMPLEMENTING|REVIEWING|VERIFYING|DOCUMENTING|COMPLETED",
  "spec_status": "pending|reviewing|approved|rejected",
  "plan_status": "pending|approved",
  "review_status": "pending|passed|failed",
  "verify_status": "pending|passed|failed",
  "allowed_files": [],
  "needs_user_approval": true,
  "commit_sha": null
}
```

- Update `scripts/workflow-state.js` helpers to read/write the new phase set

**Acceptance criteria:**
- Every task begins with a workflow-state.json entry
- Phase advances only via explicit state writes
- Tests in `tests/workflow-state.test.js` cover all phase transitions

---

### PR-3: Project Bootstrap

**Objective:** brain-config generates the complete project structure for ForgeFlow V1.

**Deliverables:**
- `skills/brain-config/SKILL.md` updated to generate:

`.claude/` structure:
```
.claude/
  CLAUDE.md                    # ForgeFlow active — /brain-dev required
  rules/
    workflow-core.md           # Flow principles, phase gates, no-skip rule
    testing.md                 # Test requirements, verify expectations
    architecture-reuse.md      # Search-first, reuse-first principles
    stacks/
      go.md                    # (if Go selected)
      python.md                # (if Python selected)
      typescript-react.md      # (if TS/React selected)
```

`.brain/` structure:
```
.brain/
  hippocampus/
  cortex/
  sinapses/
  instincts/
  working-memory/
  specs/
  plans/
  reviews/
  verifications/
  episodes/
  proposals/
  progress/
  brain.config.json
```

- `--upgrade` flag: adds missing directories to existing `.brain/` installs without overwriting
- Stack selection: user picks one or more stacks during bootstrap; corresponding pack(s) installed

**Acceptance criteria:**
- Running brain-config on a fresh repo produces a complete, usable structure
- Running brain-config `--upgrade` on an existing install adds only what's missing
- Generated `CLAUDE.md` declares ForgeFlow active and requires `/brain-dev`
- No global dependencies required

---

### PR-4: Hooks V1

**Objective:** Deterministic enforcement at the tool level.

**Deliverables — 4 hooks:**

| Hook | Event | Responsibility |
|------|-------|---------------|
| `session-start.sh` | SessionStart | Inject ForgeFlow orientation: active, `/brain-dev` required, flow is rigid |
| `subagent-start.sh` | SubagentStart | Inject discipline contract: scope, role, allowed_files, no shortcuts |
| `pre-tool-use.sh` | PreToolUse: Write\|Edit | Block writes before `plan_status === approved`; block writes outside `allowed_files` |
| `stop.sh` | Stop | Block finalization without `verify_status === passed` |

All hooks output the modern `hookSpecificOutput.permissionDecision` schema. All block messages name the exact reason and what the user must do to proceed.

**Acceptance criteria:**
- Attempting `Write`/`Edit` before plan_approved → blocked with clear message
- Attempting to write outside allowed_files → blocked with filename cited
- Attempting to end session without verify_passed → blocked with clear message
- All hooks pass tests in `tests/brain-hooks.test.js`

---

## 5. Layer 1 — Static Artifacts (PR-5 to PR-6)

### PR-5: Artifact Templates

**Objective:** Define fixed contracts for all flow artifacts.

**Deliverables — 5 templates in `templates/`:**

**`spec.md`**
```
# Spec: {task_id}
## Objective
## Constraints
## Reuse Strategy        ← mandatory; flow-enforcer blocks if empty
## Affected Areas
## Acceptance Criteria
## Risks
```

**`plan.md`**
```
# Plan: {task_id}
## Execution Strategy
## Agent Selection
## Allowed Files
## TDD Micro-Steps       ← numbered, each testable
## Verify Plan
```

**`review.md`**
```
# Review: {task_id}
## Spec Compliance       ← filled by spec-compliance-reviewer
### Checklist
### Result: PASS | FAIL
## Code Quality          ← filled by code-quality-reviewer
### Checklist
### Result: PASS | FAIL
## Overall: PASS | FAIL
```

**`verification.md`**
```
# Verification: {task_id}
## Build
## Types
## Lint
## Tests
## Security
## Diff Summary
## Result: PASS | FAIL
```

**`episode.md`**
```
# Episode: {task_id}
## What Was Done
## Errors Encountered
## Patterns Used
## Proposed Sinapse Updates
```

**Acceptance criteria:**
- All 5 templates exist in `templates/`
- Each template has all required sections
- Artifacts saved by flow land in correct `.brain/` subdirectory (specs/, plans/, reviews/, verifications/, episodes/)

---

### PR-6: Agents V1

**Objective:** Four specialized agents, each with one clear responsibility.

**Deliverables — 4 agent files in `agents/`:**

**`implementer.md`**
- Role: Write code according to spec and plan
- Receives: spec + plan + context packet (inlined, not file refs)
- Constraints: only allowed_files; SubagentStart hook injects discipline contract
- Tools: Read, Write, Edit, Bash, Grep, Glob
- Output: implementation + `task-completion-{task_id}.md`

**`spec-reviewer.md`**
- Role: Review spec quality before user approval
- Receives: spec only
- Checks: gaps, ambiguities, internal consistency, reuse strategy present
- Tools: Read, Grep, Glob (read-only)
- Output: PASS/FAIL + specific improvement suggestions

**`spec-compliance-reviewer.md`**
- Role: Verify implementation matches spec
- Receives: spec + implementation diff
- Checks: every acceptance criterion met, no scope creep, allowed_files respected
- Tools: Read, Grep, Glob, Bash
- Output: PASS/FAIL + unmet criteria with file:line references
- Does NOT review code quality (that is code-quality-reviewer's job)

**`code-quality-reviewer.md`**
- Role: Assess engineering quality of implementation
- Receives: implementation diff + allowed_files
- Checks: architecture, patterns, reuse, maintainability, security basics, duplication
- Tools: Read, Grep, Glob, Bash
- Output: PASS/FAIL + findings with file:line references
- Does NOT check spec compliance (that is spec-compliance-reviewer's job)

**Acceptance criteria:**
- Each agent has YAML frontmatter (name, description, tools)
- Each agent has a single stated responsibility
- Each agent defines its exact output format
- No overlapping responsibilities between agents

---

## 6. Layer 2 — Behavior + Validation (PR-7 to PR-11)

### PR-7: Full `/brain-dev` Flow

**Objective:** Wire all previous PRs into a working end-to-end sequence.

**Full sequence** (target state after all Block B PRs are complete):

```
brain-dev
  → classify intent + create workflow-state + create worktree  ← worktree impl in PR-8
  → brain-spec
      → search-first: repo → rules → brain → libs → web
      → generate spec using spec.md template
      → save to .brain/specs/spec-{task_id}.md
      → dispatch spec-reviewer agent
      → present spec + review to user
  → USER APPROVAL GATE (phase: SPEC_APPROVAL)
  → brain-plan
      → load approved spec + brain context
      → generate plan using plan.md template
      → define allowed_files
      → save to .brain/plans/plan-{task_id}.md
      → update phase: IMPLEMENTING, plan_status: approved
  → brain-task
      → dispatch implementer agent (spec + plan + context inlined)
      → update phase: REVIEWING
  → brain-review
      → dispatch spec-compliance-reviewer
      → if FAIL → return to brain-task with feedback
      → dispatch code-quality-reviewer
      → if FAIL → return to brain-task with feedback
      → update review_status: passed, phase: VERIFYING
  → brain-verify
      → run 6-phase check: build, types, lint, tests, security, diff
      → save to .brain/verifications/verification-{task_id}.md
      → update verify_status: passed, phase: DOCUMENTING
  → brain-document
      → register episode using episode.md template
      → save to .brain/episodes/episode-{task_id}.md
      → propose sinapse updates (for developer review later)
      → generate auto-commit with standardized message
      → update phase: COMPLETED
      → present worktree path + branch for manual merge
```

**Acceptance criteria:**
- Full flow executes from `/brain-dev` through to episode registration
- No phase can be entered without the previous phase artifact present
- Spec and plan artifacts always exist before implementation begins
- Review runs both compliance and quality checks
- Verify runs before document
- Episode registered at end of every completed task

---

### PR-8: Worktree + Auto-Commit

**Objective:** Isolate every code-writing task and produce a clean commit on completion.

**Deliverables:**
- brain-dev creates `forgeflow/{task_id}` worktree + branch at task start
- `workflow-state.json` records `worktree_name` and `branch_name`
- brain-document generates auto-commit after `verify_status === passed`
- Commit message format: `feat({domain}): {task_id} — {one-line summary} [forgeflow]`
- brain-document presents: worktree path, branch name, merge instructions
- Merge is always manual — never automated

**Acceptance criteria:**
- Worktree created at task start, recorded in state
- Task runs fully within the worktree
- Auto-commit fires only after verify passes
- Merge prompt is clear and actionable
- Branch principal is never touched by the flow

---

### PR-9: Search-First, Reuse-First

**Objective:** Reduce duplication and raise architectural quality by enforcing a search order before spec generation.

**Deliverables:**
- brain-spec enforces search order before generating content:
  1. Repo scan (existing patterns, similar modules, reusable components)
  2. `.claude/rules/` (architectural conventions, stack rules)
  3. `.brain/` (episodes, proposals, sinapses)
  4. Known libs/frameworks
  5. Web research (only when steps 1-4 are insufficient)
- `## Reuse Strategy` section in spec.md is mandatory — spec cannot be submitted for user approval if this section is empty
- Plan must explicitly reference reuse decisions made in spec

**Acceptance criteria:**
- Spec always documents what was found in each search step
- Reuse strategy section is never empty
- Plan references spec's reuse decisions
- No unnecessary reimplementation of existing patterns

---

### PR-10: Stack Packs

**Objective:** Provide normative technical context per technology stack.

**Deliverables — 3 packs in `templates/rules/`:**

Each pack contains:
- Naming conventions
- Test expectations (framework, coverage baseline, test placement)
- Linting/formatting standards
- Minimal architecture guidance (module structure, error handling, dependency patterns)
- Verify expectations (what build/lint/test commands look like for this stack)

**Packs:**
- `templates/rules/go/` — Go conventions, table-driven tests, error wrapping, package structure
- `templates/rules/python/` — Python conventions, pytest patterns, type hints, module structure
- `templates/rules/typescript-react/` — TS/React conventions, component patterns, testing with RTL/Vitest

brain-config `--upgrade` installs the selected pack into `.claude/rules/stacks/`.
brain-spec and brain-plan load the active stack pack from `.claude/rules/stacks/`.

**Acceptance criteria:**
- Each pack installs cleanly via brain-config
- Spec and plan reflect stack-specific conventions
- Verify commands in verification.md match the stack's actual toolchain

---

### PR-11: Smoke Tests V1

**Objective:** Validate that the V1 flow cannot be bypassed and all critical hooks work.

**Deliverables — 5 scenarios in `tests/smoke/`:**

| Scenario | What it validates |
|----------|------------------|
| Simple feature | Full flow executes; all 5 artifacts created; auto-commit generated |
| Multi-file feature | `allowed_files` respected; no unauthorized writes attempted |
| Edit before plan | PreToolUse blocks with clear message; state remains at SPEC_APPROVAL |
| Verify fails | Stop hook blocks finalization; phase stays at VERIFYING; brain-document does not run |
| Review fails | brain-review returns FAIL; routes back to brain-task with feedback; no proceed to verify |

Each scenario has: setup steps, exact commands to run, expected outputs, pass/fail criteria.

**Acceptance criteria:**
- All 5 scenarios documented and manually runnable
- Scenarios 3, 4, 5 produce hook block messages, not silent failures
- After all 5 pass: V1 is declared ready

---

## 7. V1 Definition of Done

- [ ] `/brain-dev` runs full flow end-to-end (spec → approval → plan → task → review → verify → document)
- [ ] Hooks block writes before `plan_approved`
- [ ] Hooks block finalization without `verify_passed`
- [ ] SubagentStart injects discipline contract into every agent
- [ ] Worktree + auto-commit works for every code-writing task
- [ ] Spec and plan always exist before implementation
- [ ] 4-agent review always runs (spec-reviewer + spec-compliance + code-quality + implementer)
- [ ] `.claude/rules/` generated by bootstrap with correct stack pack
- [ ] All 5 smoke scenarios pass

---

## 8. Key Constraints

- **agent_success_rate is 0%** in this project's history. Agent files must have minimal, focused context — no implicit assumptions, no inherited state. Each agent receives everything it needs inlined.
- **No score-based routing** anywhere in the flow. Every task follows the full pipeline.
- **No inline execution path** — brain-dev is a classifier only; brain-task always dispatches the implementer agent.
- **Blocks must be informative** — every hook denial names the exact reason and the required action.
