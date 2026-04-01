# ForgeFlow Mini — V1 Architecture

## Product Vision

ForgeFlow Mini is a Claude Code plugin that enforces professional software development discipline through a rigid, deterministic workflow. It prevents the common LLM failure modes: skipping planning, ignoring existing patterns, producing fragile solutions, and degrading quality over long tasks.

The goal is not just "make it work" — it is code that meets senior engineering standards: correct architecture, reuse over reinvention, consistency across modules, and maintainability over time.

## Core Principles

1. **No phase skipping** — spec → approval → plan → implement → review → verify → document. Every task, no exceptions.
2. **Spec before plan** — no plan without an approved spec.
3. **User approval gate** — spec must be approved by the user before any code is written.
4. **Review ≠ verify** — review is qualitative judgment; verify is objective evidence.
5. **Write gate** — Write/Edit blocked before plan_approved. Stop blocked without verify_passed.
6. **Search-first, reuse-first** — repo → .claude/rules/ → .brain/ → libs → web. Mandatory before spec.
7. **Worktree per task** — every code-writing task runs in forgeflow/{task_id} on its own branch.
8. **Auto-commit, manual merge** — commit generated after verify passes; merge is always manual.
9. **Memory is consultive** — brain enriches spec and plan; never authorizes skipping phases.
10. **Rules vs brain** — .claude/rules/ holds normative stable conventions; .brain/ holds memory, episodes, proposals.

## Public Commands (V1)

| Command | Purpose |
|---------|---------|
| `/brain-dev` | Main entry — classifies intent and starts the development flow |
| `/brain-config` | Bootstrap or upgrade project structure |

## Internal Pipeline

```
brain-dev (classify + state + worktree)
  → brain-spec (search-first, generate, dispatch spec-reviewer)
  → USER APPROVAL
  → brain-plan (execution strategy, allowed_files, TDD steps)
  → brain-task (dispatch implementer agent)
  → brain-review (spec-compliance-reviewer → code-quality-reviewer)
  → brain-verify (build, types, lint, tests, security, diff)
  → brain-document (episode, sinapse proposals, auto-commit)
```

## Phase State Machine

```
SPEC_PENDING → SPEC_REVIEW → SPEC_APPROVAL → PLAN_PENDING
  → IMPLEMENTING → REVIEWING → VERIFYING → DOCUMENTING → COMPLETED
```

Writes are gated on plan_status = "approved" (set when entering IMPLEMENTING).
Session end is gated on verify_status = "passed" (set when entering DOCUMENTING).

## Agents

| Agent | When | Responsibility |
|-------|------|---------------|
| `spec-reviewer` | After brain-spec, before user approval | Spec quality: gaps, ambiguities, consistency |
| `implementer` | brain-task | Write code per spec + plan, within allowed_files |
| `spec-compliance-reviewer` | First stage of brain-review | Does implementation match spec? |
| `code-quality-reviewer` | Second stage of brain-review | Is implementation well-engineered? |

## Hooks

| Hook | Event | Responsibility |
|------|-------|---------------|
| `session-start.sh` | SessionStart | Inject ForgeFlow orientation |
| `subagent-start.sh` | SubagentStart | Inject discipline contract into every agent |
| `pre-tool-use.sh` | PreToolUse: Write\|Edit | Block writes before plan approved; block writes outside allowed_files |
| `stop.sh` | Stop | Block session end before verify passes |

## Directory Layout

### Plugin (`forgeflow-mini/`)

```
agents/          — 4 specialized agent files
skills/          — 11 skill files
hooks/           — 4 bash/Python hook scripts + hooks.json
templates/       — artifact templates + stack rule packs
scripts/         — workflow-state.js, build_brain_db.py, release.sh
tests/           — unit tests + smoke scenarios
docs/            — architecture, specs, plans
```

### User Project

```
.claude/
  CLAUDE.md                  — ForgeFlow active declaration
  rules/
    workflow-core.md
    testing.md
    architecture-reuse.md
    stacks/{stack}.md

.brain/
  hippocampus/               — immutable conventions (never auto-modified)
  cortex/                    — domain knowledge
  sinapses/                  — cross-cutting patterns
  instincts/                 — learned behaviors (v2+)
  working-memory/            — active task state (workflow-state.json)
  specs/                     — approved spec artifacts
  plans/                     — approved plan artifacts
  reviews/                   — review reports
  verifications/             — verification reports
  episodes/                  — execution records
  proposals/                 — pending sinapse updates
  progress/                  — activity log, health reports
  brain.config.json
```

## Phased Roadmap

**V1 (this plan):** Rigid flow, 4 agents, worktree isolation, 3 stack packs, smoke tests.
**V1.5:** Episodes, sinapse proposals, memory feeds spec/plan quality.
**V2:** brain-debug, brain-improve, brain-consult public commands.
**Vision:** Advanced agents (architect, security, frontend), risk scoring, brain-health observability.
