# Changelog

All notable changes to ForgeFlow Mini are documented in this file.

## [1.1.0] — 2026-03-29

### Added
- **Self-awareness in brain-dev (Step 1a.5)** — brain-dev reads `last_task_id` from brain-state.json on every classification (~50 tokens). On debug/fix-investigate, loads task-completion record with files changed + test results (+100 tokens). Adds `recent_task` field and optional `## Previous Task` section to dev-context.
- **`scripts/brain-self-check.js`** — Zero-LLM mechanical quality check (~5ms, 0 tokens). Checks for skipped tests, missing tests, uncommitted files, missing commit. Outputs `{ confidence, warnings }`. 4 unit tests.
- **Confidence block in brain-task** — After brain-post-task.js, calls brain-self-check.js and LLM self-assessment (~100 tokens). Status report includes confidence (high/medium/low) + mechanical warnings + LLM concerns.
- **Confidence display in brain-dev Phase 3** — High: clean DONE. Medium: shows warnings. Low: asks developer before proceeding.
- **"Fix it" loop** — User says "fix it" after seeing warnings → brain-dev routes fix-known with warning context → brain-task fixes specific issues.
- **brain-consult Previous Task awareness** — When dev-context has `## Previous Task`, brain-consult acknowledges prior work and focuses answer on those files/tests.

### Fixed
- **brain-init Next Steps** — `/brain-task` → `/brain-dev` (brain-dev is the primary entry point since v0.9.0)

### Performance
- Every classification: +50 tokens (read `last_task_id`)
- Debug/fix-investigate only: +100 tokens (task-completion record)
- Every task completion: +130 tokens (self-check + LLM question + display)
- Compared to Reflexion framework (~2-5k tokens): 97% cheaper using existing artifacts

---

## [1.0.0] — 2026-03-29

**ForgeFlow Mini v1.0.0 — Production Release**

This release marks the plugin as production-ready. All architectural changes from v0.9.0 through v0.10.0 are stable, reviewed (dual Claude Opus + Codex GPT-5.4 review), and tested.

### Summary of what v1.0.0 includes

- **brain-dev** — single intelligent entry point for all developer requests (pure classifier, ~500 tokens, zero DB queries, 7 intents including fix-investigate/fix-known split)
- **Associative retrieval** — brain-map uses FTS5 + spreading activation (brain-inspired tag expansion, ~5ms, zero LLM cost) instead of weight-only ranking
- **Auto-episode capture** — brain-task automatically captures failure/struggle episodes; brain-consolidate processes them into approval-gated sinapse `## Lessons Learned` sections
- **No separate lessons** — lessons dissolved into sinapses (episodic → semantic memory consolidation). brain-lesson skill removed, lessons table dropped, 4 lesson directories removed
- **14 skills, 9 hooks** — brain-decision, brain-aside, brain-lesson all removed. Clean, focused architecture
- **brain-consolidate modernized** — 6-step flow with episode proposals, approval gate, Lessons Learned bullet counting for convention promotion
- **brain-plan Phase 0** — interactive Q&A (1-3 questions) + 2 approach proposals before generating TDD plan
- **Sequential subagent dispatch** — brain-dev Phase 3 dispatches fresh brain-task subagents per plan step with spec + quality review

### Changed (since v0.10.0)
- **plugin.json** — updated to 14 skills, removed brain-decision/brain-aside/brain-lesson, added brain-dev

---

## [0.10.0] — 2026-03-28

### Added
- **Auto-episode capture in brain-task** — failures and struggled tasks automatically generate episode files in working-memory. Struggled tasks (2+ strategy rotation attempts) get full episodes with "What Happened" + "What Worked". Simple failures get lightweight drafts. Zero manual intervention.
- **brain-consolidate Step 0: Episode Processing** — reads episode files, cross-references task-completion records, generates approval-gated lesson-update proposals for sinapse `## Lessons Learned` sections. Developer approves before any sinapse is modified.
- **brain-consult episode capture** — consultations that reveal corrections or failure patterns automatically write episode files.
- **brain-document episode capture** — anti-pattern discoveries write episode files instead of routing to /brain-lesson.
- **Episode 30-day TTL sweep** — sessionEnd hook cleans up stale episode files.
- **`scripts/brain-migrate-lessons.js`** — one-time migration script converts existing lesson files into sinapse `## Lessons Learned` sections.
- **`computeLessonTrigger` in brain-post-task.js** — detects struggled (2+ attempts) vs simple failure vs clean success. 4 unit tests.

### Removed
- **brain-lesson** — entire skill deleted. Auto-episode capture + brain-consolidate replaces manual lesson invocation.
- **`lessons` table in brain.db** — dropped (after migration). Knowledge now lives in sinapse content.
- **`lessons_fts` FTS5 table** — dropped. Lesson text is searchable via `sinapses_fts` (embedded in sinapse content).
- **Lesson directories** — `.brain/cortex/<domain>/lessons/`, `.brain/lessons/inbox/`, `.brain/lessons/cross-domain/`, `.brain/lessons/archived/` all removed.
- **All "suggest /brain-lesson" text** — removed from brain-dev, brain-consult, brain-document, hooks.

### Changed
- **brain-consolidate** — modernized 6-step flow: Step 0 (episode proposals) → Step 1 (approval gate) → Step 2 (escalation check via Lessons Learned bullets) → Step 3 (health) → Step 4 (weights + cleanup) → Step 5 (clear). Trust model preserved: all sinapse mutations require developer approval.
- **brain-consult** — writes episode files directly on corrections instead of suggesting /brain-lesson. Lesson queries removed (knowledge embedded in sinapse content).
- **brain-map** — lesson metadata query removed from Tier 1. Lessons load naturally via sinapse content.
- **brain-task** — auto-episode capture as final step before returning status.
- **brain-status** — lesson density metrics removed, episode count added.
- **brain-init** — lesson directories removed from scaffold, migration added to --upgrade.

### Performance
- **Clean success:** -200 tokens (no lesson metadata query)
- **Failures:** +100-500 tokens (episode capture) but lessons ACTUALLY get captured (previously lost)
- **Struggled tasks:** -3.7k tokens vs manual /brain-lesson + lessons are higher quality (captured with fresh context)
- **Consolidation:** ~1-2k per episode (proposal generation), creates real value

## [0.9.1] — 2026-03-28

### Added
- **Associative retrieval in brain-map** — FTS5 + spreading activation (tag expansion). Two-step SQL query (~5ms, zero LLM) replaces weight-only ranking. Loads 3-4 relevant sinapses instead of 5 generic heavy ones. Brain-inspired: direct activation (keyword match) then spreading activation (related tags surface connected sinapses).
- **Keyword extraction in brain-dev** — 2-3 retrieval keywords extracted during classification and passed downstream via dev-context file. Enables associative retrieval without extra LLM cost.
- **Mermaid architecture diagram in README** — full visual flow from developer input through classification, routing, planning, and subagent dispatch.

### Removed
- **brain-decision** — fully absorbed into brain-dev. File deleted. All cross-references updated across 10+ skill files.
- **brain-aside** — fully deleted (was deprecated stub since v0.9.0). Pipeline check lives in brain-consult Pre-Step.
- **codex-invoke.js** — stub script deleted. Codex invocation handled inline in brain-task.
- **brain-task Step 2** — LLM context reformatting pass removed. Context packet from brain-map used directly by the LLM.
- **brain-dev Phase 1e** — sinapse loading removed from brain-dev. brain-dev is now a pure classifier (zero DB queries, ~500-800 tokens).

### Changed
- **brain-dev** — pure classifier: classify intent (7 intents including fix-investigate/fix-known split), calculate score, select model, extract keywords, write slim dev-context, route. No brain.db queries.
- **brain-task** — simplified to 3 steps: Load Context (brain-map) → Implement + Verify → Post-task. CASE handling updated for brain-dev.
- **brain-parse-plan.js** — simplified to extract task + title + fullText only. Removed broken files/steps parsing. 5 tests.
- **brain-plan** — Phase 0 reads slim dev-context (keywords + classification only). Removed brain-decision references. Fixed phantom `type == critical` condition.
- **brain-consult** — updated relationship table: brain-decision removed, brain-aside marked deleted, brain-task suggests brain-dev.

### Performance
- **Context loading:** ~6-9k tokens (3-4 relevant sinapses) instead of ~10-15k (5 generic ones)
- **brain-dev classification:** ~500-800 tokens (was ~2-3k with sinapse loading)
- **brain-task:** one fewer LLM pass per task (Step 2 removed)
- **Reviewer subagents:** read git diff instead of re-pasted spec (saves ~2-8k tokens per review)

## [0.9.0] — 2026-03-27

### Added
- **`/brain-dev`** — New primary developer entry point. Classifies any request (build/fix/debug/review/question/refactor), evaluates against brain sinapses silently, writes a dev-context handoff file, and routes to the appropriate skill. Replaces `/brain-decision` as the command developers call daily.
- **`brain-plan` Phase 0** — Interactive Q&A phase: reads dev-context handoff, asks 1–3 targeted questions one at a time, proposes 2 implementation approaches with trade-offs, waits for approval before generating the TDD plan.
- **`scripts/brain-parse-plan.js`** — Zero-LLM script that parses an implementation plan MD file into a JSON task array. Used by brain-dev Phase 3 to populate TodoWrite without LLM file-reading. 7 unit tests.
- **Subagent dispatch loop in brain-dev** — Sequential fresh-subagent execution (spec review → quality review per task), matching superpowers subagent-driven-development pattern.

### Changed
- **`brain-plan`** — Removed parallel dispatch language. `--dispatch` flag renamed to `--subagents` (sequential fresh subagents, not parallel). Execution model is always sequential.
- **`brain-task`** — CASE B warning updated for brain-dev subagent dispatch context. Step 1 documented as the single owner of context loading.
- **`brain-consult`** — Absorbs brain-aside pipeline-check-and-remind behaviour. Automatically detects active brain-task pipeline and appends resume reminder to consultation responses.
- **`brain-decision`** — Removed stale MetalShopping section. Added PRIORITY OVERRIDE row to model selection table (debug intent always → Opus). Fixed plan mode: brain-map owned by brain-task Step 1, not brain-decision.

### Deprecated
- **`brain-aside`** — Functionality absorbed into brain-consult. Skill file preserved with deprecation notice. Use `/brain-consult` for questions during an active pipeline.

### Performance
- brain-parse-plan.js replaces LLM iteration over plan files during dispatch — saves ~1-2k tokens per multi-step execution
- Phase 0 Q&A in brain-plan prevents wrong-assumption rework cycles (estimated savings: 20-60k tokens per complex task where assumptions would have been wrong)

## [0.8.0] - 2026-03-27

### Added
- **scripts/brain-post-task.js** -- Handles brain-task Steps 4+5+6.2+6.4+6.5 in one call. Writes task-completion record, appends activity log, archives context files, checks consolidation threshold, updates circuit breaker. Saves ~1,500 tokens and 7-11 tool calls per task.
- **scripts/brain-verify.sh** -- 6-phase verification (build, types, lint, tests, security, diff) with JSON output. Auto-detects tooling for Node.js, Python, Go, Rust projects. Saves ~1,500 tokens per verification.
- **scripts/brain-status-report.py** -- Dashboard aggregation from brain.db + state files. Queries sinapse/lesson metrics, circuit breaker state, consultation stats, pending escalations. Saves ~800 tokens per /brain-status.
- **circuitBreakerCheck hook** (Tier 1, PreToolUse) -- Blocks execution when circuit breaker is open. Replaces inline checks in brain-decision and brain-task. Handles closed/open/half-open transitions with cooldown detection.
- **sessionEnd consult cleanup** -- Extended sessionEnd hook with consult-*.json TTL pruning (7-day max age + 50 file cap). Cleanup never blocks session end.
- **29 tests** for brain-post-task.js, **14 tests** for hook extensions.

### Changed
- **brain-task** -- Steps 4, 5, 6.2, 6.4, 6.5 delegated to brain-post-task.js. LLM still owns brain-document (6.1) and /commit (6.3). Legacy steps preserved in collapsed reference blocks.
- **brain-verify** -- All 6 phases delegated to brain-verify.sh. LLM only interprets JSON results. Manual fallback preserved.
- **brain-status** -- Steps 1-3 delegated to brain-status-report.py. LLM shows dashboard + runs visualization.
- **brain-decision** -- Circuit breaker check replaced by circuitBreakerCheck hook enforcement. Manual check preserved as legacy reference.
- **brain-consult** -- Consult cleanup primary path is now sessionEnd hook; brain-consolidate is secondary fallback.
- **Hook count** -- 8 -> 9 hooks (added circuitBreakerCheck).

### Performance
- ~3,000-4,000 tokens saved per task (post-task + verify combined)
- ~15,000-20,000 tokens saved per 5-task session
- Mechanical operations run in 50-200ms instead of 15-25 AI tool calls

## [0.7.0] - 2026-03-27

### Added
- **brain-consult** (new skill) -- Brain-informed consultation for questions, architecture guidance, and debugging advice without full task orchestration. Three modes: Quick (Tier 1A/1B, 3-6k tokens), Research (+ Context7/WebSearch, 12-20k tokens), Consensus (+ Codex multi-model via `--consensus` flag, 15-25k tokens). Fills the gap between brain-aside (no context) and brain-task (full pipeline).
- **Conversation threading** -- brain-consult detects follow-up questions within 10 minutes on the same domain and includes prior Q&A as thread context, saving token re-loading.
- **Consultation audit trail** -- `.brain/working-memory/consult-{timestamp}.json` per consultation with mode, domain, loaded sinapse/lesson IDs, external sources, confidence. 7-day TTL, auto-pruned by brain-consolidate.
- **Separate consultation log** -- `.brain/progress/consult-log.md` keeps consultation history separate from `activity.md` to avoid polluting task analytics.
- **FTS5 full-text search** (system-wide) -- `sinapses_fts` and `lessons_fts` virtual tables for semantic keyword retrieval. Used by brain-consult (Tier 2 scored retrieval), brain-map (hybrid queries), brain-consolidate (semantic lesson grouping), and brain-status (topic relevance). Backward compatible: falls back to LIKE queries if FTS5 unavailable.
- **Skill count** -- 15 -> 16 skills (added brain-consult).

### Changed
- **brain-aside** -- Updated description for trigger disambiguation: pipeline interrupt handler only, brain-consult for knowledge-based consultation.
- **brain-map** -- Added FTS5 hybrid query option alongside existing weight-ordered queries. Falls back to standard queries when FTS5 unavailable or no keywords provided.
- **brain-consolidate** -- Added Step 6.5 (consult-*.json TTL cleanup) and Step 6.6 (FTS5 semantic lesson grouping for escalation detection).
- **brain-status** -- Added consultation activity section showing total consultations by mode, active threads, and audit file count.
- **build_brain_db.py** -- Creates FTS5 virtual tables and rebuilds indexes after data population. Includes FTS5 migration for existing brains.

## [0.6.1] - 2026-03-26

### Fixed
- **MCP config server** — Replace `_readError` string sentinel with `Symbol('readError')` to prevent false errors on configs containing that key
- **MCP config server** — Mark `database.path` and `database.schema_version` as `readonly: true` in validation schema
- **brain-setup** — Add `project_root` and `brain_root` to readonly guard list; mark `database.path`/`schema_version` read-only in section table
- **brain-task** — Remove duplicate `failure_count` increment from half-open circuit breaker probe failure block
- **brain-task** — Add `implementation-plan-{task_id}.md` to Step 6.2 archive list (plan-mode tasks)
- **brain-decision** — Correct `brain-state.json` path to `.brain/working-memory/brain-state.json`
- **brain-plan/brain-task** — Clarify Path E/F routing; expanded plans always route to Path F
- **Tests** — Fix tautological `_template` missing-file assertion; add `finally` cleanup block
- **Tests** — Add positive `Failed to read` assertions to corrupt JSON tests
- **Tests** — Add `brainConfigWrite` corrupt config test (57 tests total)
- **CHANGELOG** — Fix version order: 0.6.0 → 0.5.0 → 0.4.1 → 0.4.0 → 0.3.0

## [0.6.0] - 2026-03-26

### Added
- **brain-setup** (new skill) — Interactive configuration wizard for `brain.config.json`. Menu-driven section navigation, markdown table display of current values, inline change validation, before/after diff preview, and change logging to `activity.md`.
- **MCP config server** (`mcp/brain-config-server.js`) — Pure Node.js, zero npm dependencies. Implements 4 tools: `brain_config_read`, `brain_config_write`, `brain_config_validate`, `brain_config_diff`. Full validation schema for all 50+ configurable fields across 13 sections.
- **Config validation schema** — Type constraints (string, number, integer, boolean, array, enum, nullable_enum), range checks (min/max), enum enforcement, readonly field protection. Covers: database, hooks, linters, resilience, subagents, learning, context_loading, token_budgets, token_optimization, consolidation, lesson_escalation, weight_decay.
- **57 tests** for the MCP config server (`tests/brain-config-server.test.js`) — Covers all 4 tools, validation rules, deep get/set helpers, CLI integration, schema completeness, and error handling.
- **Skill count** — 14 → 15 skills (added brain-setup).
- **brain-plan rewrite** — Cortex-Linked TDD Planner with micro-steps, sinapse linking, file structure design, dispatch metadata, and self-review gates. Replaces the previous simple planner.
- **Path F dispatcher mode** (`brain-task`) — Executes expanded TDD plans one subagent per micro-step with spec reviews after each. Activated by `plan_type: expanded` + `dispatch_ready: true`.
- **`--dispatch` flag** — Forces Path F parallel subagent dispatch for expanded plans regardless of step count threshold.

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
