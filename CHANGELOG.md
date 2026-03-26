# Changelog

All notable changes to ForgeFlow Mini are documented in this file.

## [0.6.0] - 2026-03-26

### Added
- **brain-setup** (new skill) — Interactive configuration wizard for `brain.config.json`. Menu-driven section navigation, markdown table display of current values, inline change validation, before/after diff preview, and change logging to `activity.md`.
- **MCP config server** (`mcp/brain-config-server.js`) — Pure Node.js, zero npm dependencies. Implements 4 tools: `brain_config_read`, `brain_config_write`, `brain_config_validate`, `brain_config_diff`. Full validation schema for all 50+ configurable fields across 13 sections.
- **Config validation schema** — Type constraints (string, number, integer, boolean, array, enum, nullable_enum), range checks (min/max), enum enforcement, readonly field protection. Covers: database, hooks, linters, resilience, subagents, learning, context_loading, token_budgets, token_optimization, consolidation, lesson_escalation, weight_decay.
- **40 tests** for the MCP config server (`tests/brain-config-server.test.js`) — Covers all 4 tools, validation rules, deep get/set helpers, CLI integration, schema completeness, and error handling.
- **Skill count** — 14 → 15 skills (added brain-setup).
- **brain-plan rewrite** — Cortex-Linked TDD Planner with micro-steps, sinapse linking, file structure design, dispatch metadata, and self-review gates. Replaces the previous simple planner.
- **Path F dispatcher mode** (`brain-task`) — Executes expanded TDD plans one subagent per micro-step with spec reviews after each. Activated by `plan_type: expanded` + `dispatch_ready: true`.
- **`--dispatch` flag** — Forces Path F parallel subagent dispatch for expanded plans regardless of step count threshold.

## [0.3.0] - 2026-03-26

### Architecture
- **Self-contained pipeline** — All skills run inline without hook dependencies. Hooks are optional enhancements, never workflow drivers.
- **Subagent dispatch engine** — brain-task dispatches implementation to model-appropriate subagents (Haiku/Sonnet) with inline fallback. Saves 76% main context tokens for Sonnet tasks.
- **Parallel execution** — brain-mckinsey runs 2-3 research subagents in parallel. Post-implementation runs review + document subagents simultaneously.
- **State persistence** — brain-state.json (session) + brain-project-state.json (project) survive compaction and session boundaries.

### Added
- **8 hooks, 3 tiers** — Hook runner (`hooks/brain-hooks.js`) with profile system (minimal/standard/strict). Includes hippocampus guard, config protection, strategy rotation, quality gate, task safety net, activity observer.
- **Circuit breaker** — 3 consecutive failures in 10 min opens breaker. 5-min cooldown. Half-open probe. Prevents cascading failures.
- **Strategy rotation** — After 2 failures: default → alternative → minimal → escalate → human. Tracked in brain-state.json.
- **Confidence-scored learning** — Lessons start at 0.3 confidence, grow with evidence. Promotion pipeline: instinct → active → convention candidate → convention.
- **brain-verify** (new skill) — 6-phase verification: build, types, lint, tests, security, diff review. GO/NO-GO verdict.
- **brain-eval** (new skill) — Eval-driven development: define capability and regression evals before implementation.
- **brain-aside** (new skill) — Quick question without losing pipeline context. Auto-saves and reminds to resume.
- **Strategic compaction** — Phase-aware advice: safe/unsafe to compact at each pipeline step.
- **Context pressure management** — Tracks token usage, degrades gracefully at 75%+ pressure.
- **brain-init --upgrade** — Migrate v0.2.0 projects to v0.3.0 without full re-init.
- **brain-init --hooks-only** — Reconfigure hooks without touching .brain/ content.
- **brain_state table** — Key-value store in brain.db for state persistence backup.

### Fixed
- **TaskCompleted hook stall** (critical) — Hook only fires for Agent tool subagents, never for Skill-based execution. All post-task steps now run inline. Hook serves as optional safety net.
- **Pipeline position diagrams** — All 11 skills updated to show correct self-contained flow.

### Changed
- **brain-task** — Complete rewrite: subagent dispatch decision tree, state persistence at every gate, circuit breaker check, verification gate, strategy rotation, context pressure monitoring.
- **brain-init Phase 7** — Tiered hook installation with profile selection and safe merge.
- **brain.config.json** — v0.3.0 with resilience, subagents, hooks, learning, token_optimization sections.
- **brain-decision** — Circuit breaker check before routing, state write after dispatch.
- **brain-lesson** — Confidence scoring, evidence tracking, promotion pipeline, scope tracking.
- **Skill count** — 11 → 14 skills (added brain-verify, brain-eval, brain-aside).

## [0.5.0] - 2026-03-26

### Changed
- `build_brain_db.py`: align confidence column to REAL type + fix cortex_registry paths
- `release.sh`: bump template versions on release + use chore() commit type

## [0.4.1] - 2026-03-26

### Fixed
- hooks: use `continue:true` instead of `decision:'continue'` in `ok()`

## [0.4.0] - 2026-03-26

### Fixed
- All critical and high gaps identified in the v0.4.0 gap analysis — paths, schema, field naming, counters, and codex-review step references

## [0.2.0] - 2026-03-25

### Added
- **Sonnet model tier** — New routing band (score 20-39) between Haiku and Codex for standard single-domain tasks. Token-efficient with 30-60k budget. Auto-escalates to Codex after 2 failed attempts.
- **Automatic hook setup** — `brain-init` Phase 7 now creates SessionStart and TaskCompleted hooks in project-level `.claude/settings.json`. Uses safe merge algorithm with `matcher` tags to preserve existing hooks.
- **Consolidation checkpoint** — `activity.md` now includes a `consolidation-checkpoint` marker so the TaskCompleted hook can accurately count tasks since last consolidation.
- **McKinsey integration** — `brain-task` Step 2.5 now invokes `brain-mckinsey` for architectural tasks with plan mode active.
- **Sonnet review policy** — `brain-codex-review` documents that Sonnet tasks use test results as quality gate; manual review available via `/brain-codex-review`.
- **model_used field** — `brain-lesson` frontmatter now includes optional `model_used` for analytics.

### Fixed
- **Debugging dead zone** (critical) — Tasks scoring 20-39 with type=debugging had no valid routing branch. All debugging now routes to Opus regardless of score.
- **File name mismatches** (critical) — `brain-map` and `brain-plan` referenced `context-packet.md` instead of `context-packet-{task_id}.md`, breaking brain-task gate checks.
- **Opus glob mismatch** (critical) — Hook archived `opus-context-*.md` but actual file is `opus-debug-context-*.md`. Fixed in brain-init hook template and user settings.
- **git diff timing** (critical) — `brain-document` used `git diff HEAD~1` but runs before commit. Now reads file list from task-completion artifact or working tree diff.
- **Consolidate scan pattern** (critical) — `brain-consolidate` searched for `task-XXXXX.md` but hook creates `task-completion-*.md`.
- **Risk vs type confusion** (high) — Decision tree used `type == "critical"` but critical is a risk level. Changed to `risk == "critical"`.
- **Score boundary ambiguity** (high) — Table said "0-20 Haiku" but tree used `< 20`. Standardized to `0-19 Haiku`, `20-39 Sonnet`, etc.
- **Step 5 contradiction** (high) — `brain-decision` Step 5 described generating context files (brain-task's job). Rewritten as pure dispatch handoff.
- **Codex-review step reference** (high) — Referenced "Step 2" but brain-task implementation is Step 3.
- **GATE 2 Haiku exception** (medium) — Gate required model-context file but Haiku mode has none. Added explicit Haiku exception.
- **Sinapse approval ownership** (medium) — `brain-document` claimed to "update atomically" but consolidate owns approval. Made document proposal-only.
- **task_id format** (medium) — `brain-map` used `[uuid]`, rest used `YYYY-MM-DD-<slug>`. Standardized.
- **Domain enum alignment** (medium) — `brain-map` missing `analytics` domain and `unknown_pattern` task type.
- **Double separator** — Removed duplicate `---` in brain-task.
- **sinapse-review scoping** — Changed from global `sinapse-review.md` to `sinapse-review-{task_id}.md`.
- **Staleness thresholds** — Standardized `brain-status` to `7-30d = stale`, `>30d = very stale`.
- **Formula encoding** — Fixed `brain-mckinsey` composite score formula symbols.

### Changed
- **Imperative skill framing** — `brain-task` and `brain-decision` rewritten from reference documentation style to imperative commands with hard execution gates. Skills now say "EXECUTE THESE STEPS" instead of "Purpose: ...".
- **Debugging-first routing** — Decision tree now checks debugging type BEFORE score-based routing. Eliminates all dead zones.
- **Sonnet references** across downstream skills — `brain-map`, `brain-consolidate`, `brain-init` hooks, and `brain-codex-review` now reference `sonnet-context-{task_id}.md`.
- **brain-decision dispatch** simplified — Step 5 is now a clean handoff with dispatch format, not context file generation instructions.
- **Consolidate output** includes Sonnet context counts and checks for sonnet-context files during archival verification.

## [0.1.0] - 2026-03-24

### Added
- Initial release with 11 skills
- Pipeline: brain-decision -> brain-map -> brain-task -> brain-codex-review -> brain-document -> brain-consolidate
- 3-tier weighted context loading (Tier 1/2/3)
- Complexity scoring (0-100) with model routing (Haiku/Codex/Opus)
- Lesson lifecycle: draft -> active -> promotion_candidate -> promoted
- Distributed lesson storage in cortex/<domain>/lessons/
- brain-mckinsey strategic analysis for architectural decisions
- brain.db SQLite indexing with build_brain_db.py
- brain-graph.html 3D visualization
