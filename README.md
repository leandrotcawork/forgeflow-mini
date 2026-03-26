# ForgeFlow Mini

Brain-driven development plugin for Claude Code -- persistent knowledge that learns from every task, dispatches subagents for speed, and protects quality with hooks and circuit breakers.

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.6.1-blue" alt="Version 0.6.1">
  <img src="https://img.shields.io/badge/Claude_Code-Compatible-blueviolet" alt="Requires Claude Code">
  <img src="https://img.shields.io/badge/Skills-15-orange" alt="15 Skills">
  <img src="https://img.shields.io/badge/Hooks-8-yellow" alt="8 Hooks">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

**Every task builds the brain.** ForgeFlow maintains a persistent knowledge system that remembers architecture patterns, learns from failures, and routes tasks to the right model. Knowledge compounds across sessions -- the 50th task runs smarter than the first.

**Intelligent routing with subagent dispatch.** Describe what you need. brain-decision classifies complexity (0-100), selects the optimal model (Haiku/Sonnet/Codex/Opus), and dispatches to subagents for speed and token efficiency. Sonnet tasks run as isolated subagents (76% main context savings). Complex tasks run inline with full context.

**Self-contained pipeline. Hooks enhance, never drive.** The pipeline works for any user, first time, with zero hooks configured. Eight optional hooks add guardrails (hippocampus guard, config protection), resilience (strategy rotation, circuit breaker), and lifecycle management (session state persistence).

**Failure becomes knowledge with confidence scoring.** When something breaks, brain-lesson captures it at confidence 0.3. Evidence accumulates. At 0.7+ with 3 occurrences, brain-consolidate proposes it as a convention. Mistakes stop repeating.

---

## Quickstart

```bash
# Terminal (not inside a Claude Code session):
claude plugin marketplace add https://github.com/leandrotcawork/forgeflow-mini.git
claude plugin install brain-mini@forgeflow-plugins

# Then inside Claude Code:
/brain-init
/brain-task "Add dark mode toggle"
```

brain-init scans your project, generates hippocampus (architecture + conventions) and cortex (domain knowledge), optionally installs hooks (tiered: minimal/standard/strict), builds the SQLite index, and initializes state files.

<details>
<summary>Troubleshooting: skills don't show up</summary>

- Use **forward slashes** in settings.json paths (even on Windows)
- Verify files exist: `ls ~/.claude/plugins/forgeflow-mini/skills/`
- Restart Claude Code completely (not just reload)
- Check that `auto_load: true` is set

</details>

---

## Which Skill?

| I want to... | Use | What happens |
|---|---|---|
| Build a feature | `/brain-task "description"` | Routes, loads context, dispatches subagent or implements inline, reviews |
| Debug something stuck | `/brain-task --debug "description"` | Routes to Opus for root cause analysis |
| Plan before building | `/brain-task --plan "description"` | Architecture plan with developer approval gate |
| Quick trivial fix | `/brain-task "fix typo in header"` | Auto-routes to Haiku (lightweight, inline) |
| Verify implementation | `/brain-verify` | 6-phase check: build, types, lint, tests, security, diff |
| Define success criteria | `/brain-eval` | Write capability + regression evals before coding |
| Check brain health | `/brain-status` | Staleness, coverage gaps, circuit breaker, subagent stats |
| Review completed work | `/brain-consolidate` | Batch-review sinapses, surface escalations, update weights |
| Record a failure | `/brain-lesson "what failed"` | Captures lesson with confidence scoring |
| Strategic decision | `/brain-mckinsey "monolith vs microservices"` | Parallel research subagents + scoring framework |
| Quick side question | `/brain-aside` | Answer question without losing pipeline context |
| Initialize new project | `/brain-init` | Scans project, generates brain, installs hooks |
| Upgrade from v0.2 | `/brain-init --upgrade` | Adds v0.6.1 features without full re-init |
| Configure Brain settings | `/brain-setup [section]` | Interactive wizard — browse, edit, validate, and diff brain.config.json sections |

---

## How It Works

### The Pipeline

Every task flows through a self-contained pipeline. No hooks required -- hooks enhance when present.

```
brain-decision -> brain-task (Steps 1-6, all inline or subagent) -> brain-document -> brain-consolidate
   classify       Step 1: Load context (brain-map)
   route          Step 2: Generate execution context
   model select   Step 3: Implement (inline OR subagent dispatch)
                  Step 3.5: Verify (brain-verify + brain-codex-review)
                  Step 4: Task-completion record
                  Step 5: Activity log
                  Step 6: Archive + brain-document + commit
```

### Subagent Dispatch

brain-task dispatches work to model-appropriate subagents when it saves tokens:

| Score | Model | Execution | Why |
|---|---|---|---|
| 0-19 | Haiku | Inline | Too small for subagent overhead |
| 20-39 | Sonnet | **Subagent** | 76% main context savings, isolated execution |
| 40-74 | Codex | Inline + parallel review/doc subagents | Complex tasks need full context |
| 75+ | Codex + Plan | Inline + parallel research subagents | Architecture needs maximum context |
| Debugging | Opus | Inline | Debugging requires full codebase access |

Subagents get full context inlined in their prompt (not file references). Every subagent path has an inline fallback.

### Intelligent Routing

brain-decision scores every task on a 0-100 complexity scale:

- **Domain**: cross-domain +30, backend +10
- **Risk**: critical +35, high +20, medium +5
- **Type**: architectural +20, debugging +15, unknown_pattern +10
- **Base**: 15

### Three-Tier Context Loading

| Tier | Tokens | Content | When |
|---|---|---|---|
| Tier 1 | ~4k | Hippocampus (condensed) + top 3 lessons + task | Always |
| Tier 2 | ~10-15k | Domain sinapses (top 5) + cross-cutting + backlinks | Standard + Codex + Opus |
| Tier 3 | ~5k | Deep linked sinapses | Only if complexity >= 75 |
| Lightweight | ~4k | Tier 1 only | Haiku tasks |

### Resilience

| Feature | How It Works |
|---|---|
| **Circuit Breaker** | 3 failures in 10 min -> OPEN (5-min cooldown) -> HALF-OPEN (probe) -> CLOSED |
| **Strategy Rotation** | After 2 failures: default -> alternative -> minimal -> escalate -> human |
| **State Persistence** | brain-state.json (session) + brain-project-state.json (project), survives compaction |
| **Context Pressure** | Tracks usage: <50% low, 65% moderate, 75% high (skip optional steps), 80% critical |

### Hooks (Optional, 3 Tiers)

Hooks never drive workflow -- they add guardrails, observation, and lifecycle management.

| Tier | Profile | Hooks |
|---|---|---|
| 1 | `minimal` | Session briefing, hippocampus guard, config protection, session end |
| 2 | `standard` | + Strategy rotation, quality gate, task safety net |
| 3 | `strict` | + Activity observer |

Set via `BRAIN_HOOK_PROFILE` env var or `brain.config.json`. Disable individual hooks via `BRAIN_DISABLED_HOOKS`.

### Learning Loop

```
Task fails -> brain-lesson captures it (confidence 0.3)
                    |
              Same pattern seen again -> confidence grows (+0.1 per occurrence)
                    |
              Confidence 0.7+ with 3+ occurrences
                    |
              brain-consolidate generates escalation proposal
                    |
              Developer approves -> hippocampus/conventions.md (confidence 1.0)
```

---

## Architecture

### Brain Directory Structure

```
.brain/
+-- hippocampus/           Constitution -- architecture, conventions, strategy
+-- cortex/                Domain knowledge -- sinapses + domain-local lessons
|   +-- backend/
|   +-- frontend/
|   +-- database/
|   +-- infra/
+-- sinapses/              Cross-cutting knowledge flows
+-- lessons/               cross-domain/ + inbox/ + archived/
+-- working-memory/        Ephemeral task artifacts + brain-state.json
+-- progress/              activity.md + brain-health.md + brain-project-state.json
+-- brain.db               SQLite index (sinapses + lessons + links + state)
```

### Skill Map (15 Skills)

| Skill | Type | Purpose |
|---|---|---|
| `brain-decision` | Router | Classifies, scores, routes, circuit breaker check |
| `brain-map` | Context | Loads 3-tier weighted sinapses from brain.db |
| `brain-task` | Orchestrator | Dispatches subagents or implements inline, manages pipeline |
| `brain-plan` | Planner | Cortex-Linked TDD planner — micro-steps, sinapse linking, file design, self-review gates |
| `brain-codex-review` | Reviewer | Quality gate (runs as Sonnet subagent for Codex tasks) |
| `brain-document` | Documenter | Proposes sinapse updates (Haiku subagent for simple tasks) |
| `brain-lesson` | Learner | Captures failures with confidence scoring |
| `brain-consolidate` | Curator | Batch review, escalation proposals, weight updates |
| `brain-mckinsey` | Strategist | Parallel research subagents + scoring framework |
| `brain-status` | Dashboard | Health metrics (runs as Haiku subagent) |
| `brain-init` | Initializer | Scans project, generates brain, installs hooks |
| `brain-verify` | Verifier | 6-phase verification: build, types, lint, tests, security, diff |
| `brain-eval` | Evaluator | Define success criteria before implementation |
| `brain-aside` | Context Saver | Quick question without losing pipeline state |
| `brain-setup` | Configurator | Interactive wizard for brain.config.json — browse, edit, validate, diff |

### Hook Architecture (8 Hooks)

All hooks run through `hooks/brain-hooks.js` -- a pure Node.js runner with profile gating.

| Hook | Event | Tier | Purpose |
|---|---|---|---|
| stateRestore | SessionStart | 1 | Restore brain state into session |
| hippocampusGuard | PreToolUse:Write | 1 | Block writes to hippocampus/ |
| configProtection | PreToolUse:Write | 1 | Block weakening linter/formatter configs |
| sessionEnd | Stop | 1 | Persist brain-state.json |
| strategyRotation | PostToolUse:Bash | 2 | Inject rotation advice after failures |
| qualityGate | PostToolUse:Write | 2 | Check for associated linter command |
| taskSafetyNet | TaskCompleted | 2 | Verify post-task steps completed |
| activityObserver | PostToolUse:Write | 3 | Track modified files |

---

## Configuration

### brain.config.json

Located in `.brain/` root after initialization. Key sections:

| Section | Purpose |
|---|---|
| `hooks.profile` | Hook tier: minimal / standard / strict |
| `resilience.circuit_breaker` | Failure threshold, cooldown, window |
| `resilience.strategy_rotation` | Failure threshold, strategies list |
| `subagents` | Enable/disable, dispatch threshold, model overrides |
| `learning` | Confidence initial/promotion thresholds, scope |
| `token_budgets` | Per-skill token allocations |
| `token_optimization` | Compact suggestion threshold, context pressure levels |
| `context_loading` | Tier token limits, always-loaded items |
| `weight_decay` | Rate, min weight, max stale days |

### Token Budgets

| Task Type | Main Context | Subagent Context | Total |
|---|---|---|---|
| Simple fix (Haiku) | ~25k | 0 | ~25k |
| Standard feature (Sonnet subagent) | ~21k | ~49k | ~70k |
| Complex feature (Codex inline) | ~120k | ~15k review | ~135k |
| Debugging (Opus inline) | ~130k | 0 | ~130k |
| Consolidation cycle | ~20k | 0 | ~20k |

---

## Trust and Safety

- **Namespace isolation** -- Brain artifacts live in `.brain/`. Plugin skills live in `~/.claude/plugins/forgeflow-mini/`.
- **No auto-writes to constitution** -- Hippocampus is immutable without developer approval via brain-consolidate.
- **Hippocampus guard hook** -- Blocks writes to `.brain/hippocampus/` at the tool level.
- **Config protection hook** -- Blocks weakening linter/formatter configs.
- **Circuit breaker** -- Prevents cascading failures after 3 consecutive errors.
- **Ephemeral by default** -- Task artifacts auto-archived. No stale context accumulates.
- **No telemetry** -- Fully local. brain.db is a SQLite file in your project.
- **Graceful degradation** -- Works without Python (file-based context), without hooks (inline pipeline), without Node.js (no hooks, still functional).

---

## Documentation

| Document | Purpose |
|---|---|
| [brain-db-schema.sql](docs/brain-db-schema.sql) | Canonical SQLite schema (source of truth) |
| [brain-db-schema.md](docs/brain-db-schema.md) | Human explanation of tables, columns, relationships |
| [CHANGELOG.md](CHANGELOG.md) | Version history with all changes |
| Each `skills/*/SKILL.md` | Detailed skill documentation with workflow, examples, anti-patterns |

---

## FAQ

**Do I need to configure hooks?**
No. The pipeline is fully self-contained. Hooks are optional enhancements installed during brain-init. You can skip them entirely.

**Do I need Codex MCP?**
No. Claude handles everything without it. Codex MCP is optional -- when configured, brain-task delegates implementation through it.

**Will this break my existing Claude Code setup?**
No. Skills activate only via `/brain-*` commands. Hooks are safely merged into existing settings.json via matcher-based idempotent installation.

**How does subagent dispatch work?**
brain-task dispatches Sonnet tasks (score 20-39) as isolated subagents with full context inlined. The subagent runs in a separate context window, returns a report. If it fails, brain-task falls back to inline execution.

**What if brain.db gets corrupted?**
Run `python scripts/build_brain_db.py --brain-path .brain` to rebuild. The markdown files are the source of truth.

**How do I upgrade from v0.2.0?**
Run `/brain-init --upgrade`. It adds missing config keys, state files, and database tables without touching existing brain content.

**How much does it cost in tokens?**
A typical 3-task Sonnet session uses ~210k tokens (vs ~260k without subagents). The 76% main context savings means more tasks per session before compaction.

---

## Contributing

1. [Report issues](https://github.com/leandrotcawork/forgeflow-mini/issues)
2. Submit PRs following existing skill structure
3. `git clone https://github.com/leandrotcawork/forgeflow-mini.git`

---

## License

MIT -- see [LICENSE](LICENSE)
