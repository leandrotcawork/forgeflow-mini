# ForgeFlow Mini

Brain-driven development plugin for Claude Code — persistent knowledge that learns from every task. Eleven skills, one evolving brain.

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.1.0-blue" alt="Version 0.1.0">
  <img src="https://img.shields.io/badge/Claude_Code-Compatible-blueviolet" alt="Requires Claude Code">
  <img src="https://img.shields.io/badge/Skills-11-orange" alt="11 Skills">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

**Every task builds the brain.** ForgeFlow maintains a persistent knowledge system that remembers architecture patterns, learns from failures, and routes tasks to the right model. Knowledge compounds across sessions — the 50th task runs smarter than the first.

**Intelligent routing, not manual selection.** Describe what you need. brain-decision classifies complexity, selects the optimal model (Codex/Opus/Haiku), and loads the right context automatically. You don't pick the model — the brain does.

**Failure becomes knowledge.** When something breaks, brain-lesson captures the pattern. After 3 similar failures, brain-consolidate proposes a convention for your project's constitution. Mistakes stop repeating.

**Code review built in.** After every Codex implementation, brain-codex-review validates conventions, tests, security, and performance. Quality gates run automatically — not when you remember to ask.

**Works with just Claude. Scales with Codex MCP.** Zero external providers needed to start. When Codex MCP is configured, the brain delegates implementation through it. Claude handles everything else.

---

## Quickstart

```bash
# 1. Clone into plugins directory
git clone https://github.com/leandrotcawork/forgeflow-mini.git ~/.claude/plugins/forgeflow-mini

# 2. Enable skills in ~/.claude/settings.json
# Add this to your settings:
{
  "features": {
    "skills": {
      "auto_load": true,
      "directories": ["~/.claude/plugins/forgeflow-mini/skills"]
    }
  }
}

# 3. Restart Claude Code, then inside a session:
/brain-init

# 4. Start using it:
/brain-task "Add dark mode toggle"
```

That's it. brain-init scans your project, generates hippocampus (architecture + conventions) and cortex (domain knowledge), builds the SQLite index, and you're ready.

<details>
<summary>Troubleshooting: skills don't show up</summary>

- Use **forward slashes** in settings.json paths (even on Windows)
- Verify files exist: `ls ~/.claude/plugins/forgeflow-mini/skills/`
- Restart Claude Code completely (not just reload)
- Check that `auto_load: true` is set

</details>

---

## Which Skill?

Not sure which command to use? Pick by goal:

| I want to... | Use | What happens |
|---|---|---|
| Build a feature | `/brain-task "description"` | Classifies, loads context, implements, reviews |
| Debug something stuck | `/brain-task --debug "description"` | Routes to Opus for root cause analysis |
| Plan before building | `/brain-task --plan "description"` | Architecture plan with developer approval gate |
| Quick trivial fix | `/brain-task "fix typo in header"` | Auto-routes to lightweight mode (Haiku) |
| Check brain health | `/brain-status` | Staleness, coverage gaps, weight distribution |
| Review completed work | `/brain-consolidate` | Batch-review sinapses, surface escalations |
| Record a failure | `/brain-lesson "what failed"` | Captures lesson, checks for recurring patterns |
| Strategic decision | `/brain-mckinsey "monolith vs microservices"` | Multi-source research + scoring framework |
| Initialize new project | `/brain-init` | Scans project, generates brain structure |

Or just describe what you need — `/brain-task` routes automatically based on complexity scoring.

---

## How It Works

### The Pipeline

Every task flows through a five-stage pipeline with clear ownership at each stage:

```
brain-decision → brain-map → brain-task → [brain-codex-review] → [TaskCompleted hook] → brain-document → brain-consolidate
   classify       context      implement     quality gate           automate              propose           batch review
   route          assemble     execute       conventions/security   archive/commit        sinapse updates   escalation
   model select   Tier 1/2/3                 auto-fix issues        suggest consolidate   (never auto)      health report
```

**Between brain-task and brain-document**, the TaskCompleted hook fires automatically — it creates the completion record, archives context files, appends to the activity log, and commits. You don't run this manually.

### Intelligent Routing

brain-decision scores every task on a 0-100 complexity scale and routes accordingly:

| Complexity | Model | When | Token Budget |
|---|---|---|---|
| 0-20 | Lightweight (Haiku) | Trivial fixes — typos, colors, config | ~8-15k |
| 20-75 | Codex | Standard features, refactors, CRUD | ~60-150k |
| 40-75 + debugging | Opus | Stuck problems, unfamiliar errors | ~120-150k |
| 75+ | Codex + Plan Mode | Architecture, security, breaking changes | ~150-200k |

Scoring factors: domain complexity (cross-domain +30), risk level (critical +35), task type (debugging +15, architectural +20). Plan mode auto-triggers at complexity >= 50 or critical risk.

### Three-Tier Context Loading

brain-map assembles relevant knowledge before every implementation:

| Tier | Tokens | Content | When |
|---|---|---|---|
| Tier 1 | ~4k | Hippocampus (condensed) + top 3 lessons + task | Always |
| Tier 2 | ~10-15k | Domain sinapses (top 5) + cross-cutting (top 2) + backlinks | Standard + Codex + Opus |
| Tier 3 | ~5k | Deep linked sinapses | Only if complexity >= 75 |
| Lightweight | ~4k | Tier 1 only | Haiku tasks |

### Code Review

After every Codex implementation, brain-codex-review runs automatically:

- Conventions followed (from hippocampus/conventions.md)
- Tests passing
- Security (tenant isolation, input validation, auth checks)
- Performance (no N+1, proper indexing)
- Output: quality score + detailed findings

Auto-fixes lint issues. Blocks on security or logic errors.

### Learning Loop

```
Task fails → brain-lesson captures it → lesson stored in cortex/<domain>/lessons/
                                               ↓
                                    3+ similar failures detected
                                               ↓
                              brain-consolidate generates escalation proposal
                                               ↓
                                    Developer approves → hippocampus/conventions.md
```

Lessons have a full lifecycle: `draft → active → promotion_candidate → promoted → archived → superseded`. brain-lesson detects patterns. brain-consolidate proposes conventions. The developer always approves.

---

## Architecture

### Brain Directory Structure

```
.brain/
├── hippocampus/           Constitution — architecture, conventions, strategy
│   ├── architecture.md      Platform architecture snapshot
│   ├── conventions.md       Absolute rules (promoted from lessons)
│   ├── strategy.md          Product goals
│   └── decisions_log.md     ADR log
├── cortex/                Curated domain knowledge — sinapses + domain-local lessons
│   ├── backend/
│   │   ├── index.md           Domain sinapse
│   │   └── lessons/           Domain-specific failure patterns
│   ├── frontend/
│   ├── database/
│   └── infra/
├── sinapses/              Cross-cutting knowledge flows
├── lessons/
│   ├── cross-domain/        Lessons spanning multiple domains
│   ├── inbox/               Unclassified + escalation proposals
│   └── archived/            No longer active, kept for history
├── working-memory/        Ephemeral task artifacts (auto-cleared)
├── progress/
│   ├── activity.md          Running task log (append-only)
│   ├── brain-health.md      Generated health report
│   └── completed-contexts/  Archived context files (permanent)
└── brain.db               SQLite index (sinapses + lessons + links)
```

### Skill Map

| Skill | Type | Purpose |
|---|---|---|
| `brain-decision` | Router | Mandatory entry point — classifies, scores, routes |
| `brain-map` | Context | Loads 3-tier weighted sinapses from brain.db |
| `brain-task` | Orchestrator | Executes implementation (Codex MCP / Opus / Haiku) |
| `brain-plan` | Planner | Decomposes complex tasks into subtasks |
| `brain-codex-review` | Reviewer | Post-implementation quality gate |
| `brain-document` | Documenter | Proposes sinapse updates (never auto-writes) |
| `brain-lesson` | Learner | Captures failures, flags promotion candidates |
| `brain-consolidate` | Curator | Batch review, escalation proposals, weight updates |
| `brain-mckinsey` | Strategist | External research + scoring for high-stakes decisions |
| `brain-status` | Dashboard | Health metrics, staleness, coverage gaps |
| `brain-init` | Initializer | Scans project, generates brain, builds index |

### MCP Integration

brain-task delegates implementation through Codex MCP when available:

| MCP Server | Command | Role |
|---|---|---|
| `codex-cli` | `npx @cexll/codex-mcp-server` | Primary implementation |
| `codex` | `codex mcp-server` | Alternative |

Both registered at user scope via `claude mcp add`. If neither is available, Claude implements directly using the assembled context as a brief.

### Hooks

Two hooks in `settings.json` automate the workflow:

| Hook | When | What It Does |
|---|---|---|
| **SessionStart** | Every session | Reads brain health, todo.md, stale regions. Outputs briefing. |
| **TaskCompleted** | After each task | Creates completion record, invokes brain-document, archives context, appends to activity.md, commits, suggests brain-consolidate after 5 tasks. |

---

## Configuration

### brain.config.json

Located in `.brain/` root after initialization:

```json
{
  "project_name": "YourProject",
  "model_strategy": {
    "primary": "codex",
    "debugging": "opus",
    "trivial": "haiku",
    "codex_share": 0.80,
    "opus_share": 0.15,
    "haiku_share": 0.05
  },
  "plan_mode": {
    "auto_trigger_complexity": 50,
    "auto_trigger_architectural": true,
    "auto_trigger_critical": true
  },
  "codex_review": {
    "enabled": true,
    "auto_post_implement": true,
    "checks": ["syntax", "conventions", "tests", "security", "performance"]
  }
}
```

### Token Budgets

| Task Type | Tokens | Typical Time |
|---|---|---|
| Simple fix (Haiku) | ~12k | < 10 min |
| Standard feature (Codex) | ~90k | 30-45 min |
| Complex feature (Codex + plan) | ~150k | 60-90 min |
| Debugging (Opus) | ~130k | 20-30 min |
| Consolidation cycle | ~20k | 10-15 min |
| **Typical session (3 tasks)** | **~340k** | **~1.5 hours** |

---

## Trust and Safety

**Namespace isolation** — Brain artifacts live in `.brain/`. Plugin skills live in `~/.claude/plugins/forgeflow-mini/`. Neither touches your source code organization.

**No auto-writes to constitution** — Hippocampus (conventions, architecture) is never updated automatically. brain-document proposes, brain-consolidate generates escalation proposals, but the developer always approves before anything enters the constitution.

**Ephemeral by default** — Task artifacts in `working-memory/` are auto-archived after completion. No stale context accumulates.

**No telemetry** — No usage data collected. Fully local. brain.db is a SQLite file in your project.

**Clean uninstall** — Delete `~/.claude/plugins/forgeflow-mini/` and remove the skills directory from `settings.json`. Delete `.brain/` from your project if you want to remove the knowledge base.

---

## Documentation

| Document | Purpose |
|---|---|
| [brain-db-schema.sql](docs/brain-db-schema.sql) | Canonical SQLite schema (source of truth) |
| [brain-db-schema.md](docs/brain-db-schema.md) | Human explanation of tables, columns, relationships |
| Each `skills/*/SKILL.md` | Detailed skill documentation with workflow, examples, anti-patterns |

---

## FAQ

**Do I need Codex MCP?**
No. Claude handles everything without it. Codex MCP is optional — when configured, brain-task delegates implementation through it for parallel execution.

**Will this break my existing Claude Code setup?**
No. Skills activate only via `/brain-*` commands. Brain artifacts are isolated in `.brain/`. Hooks are additive (SessionStart briefing, TaskCompleted automation).

**How does it compare to $ms (MetalShopping orchestrator)?**
Different tools for different jobs. Use `/brain-task` for learning new patterns, debugging, exploration, and architectural decisions. Use `$ms` for rigorous contract-driven T1-T7 feature work. They can run in parallel.

**What if brain.db gets corrupted?**
Run `/brain-init` to rebuild. The markdown files in `.brain/` are the source of truth — brain.db is just an index.

**How much does it cost in tokens?**
A typical 3-task session uses ~340k tokens (~$0.80). brain-decision routing adds only ~5k per task. The main cost is implementation itself, which you'd spend anyway.

---

## Contributing

1. [Report issues](https://github.com/leandrotcawork/forgeflow-mini/issues)
2. Submit PRs following existing skill structure
3. `git clone https://github.com/leandrotcawork/forgeflow-mini.git`

---

## License

MIT — see [LICENSE](LICENSE)
