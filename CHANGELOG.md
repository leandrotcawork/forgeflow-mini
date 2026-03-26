# Changelog

All notable changes to ForgeFlow Mini are documented in this file.

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
