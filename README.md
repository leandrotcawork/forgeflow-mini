# ForgeFlow Mini — Intelligent Brain for Claude Code

A general-purpose knowledge system plugin for Claude Code.

**Status:** Phase 5 Complete (Multi-Model Intelligence + Code Review)

---

## CRITICAL: How to Register Skills (If `/brain-task` Doesn't Show)

### Problem
You type `/` and don't see `/brain-task`, `/brain-status`, etc.

### Solution

**Step 1: Edit ~/.claude/settings.json**

Add this section:

```json
{
  "features": {
    "skills": {
      "auto_load": true,
      "directories": [
        "~/.claude/plugins/forgeflow-mini/skills",
        "./.claude/skills"
      ]
    }
  }
}
```

**Step 2: Restart Claude Code**

Close the application completely and reopen it.

**Step 3: Verify Skills Load**

Type `/` and look for:
- /brain-task
- /brain-status
- /brain-consolidate
- /brain-codex-review
- /brain-lesson
- /brain-decision

If still missing:
- Check that forgeflow-mini/skills/*.md files exist
- Use FORWARD SLASHES in settings.json (not backslashes)
- Make sure ~/.claude/ directory exists
- Restart once more

---

## Quick Start

### 1. Install Plugin

```bash
cp -r forgeflow-mini ~/.claude/plugins/
# OR git clone your repo into ~/.claude/plugins/
```

### 2. Register Skills (See Above)

Edit ~/.claude/settings.json with the code above.

### 3. Initialize Brain

```bash
node forgeflow-mini/scripts/init.js --project-path .
```

### 4. Use It

```
/brain-task "Add dark mode toggle"
/brain-status
/brain-consolidate
```

---

## What It Does

ForgeFlow maintains a persistent Brain that:

- **Remembers patterns** — Sinapses store architecture knowledge weighted by usage
- **Learns from failures** — Lessons capture errors that became knowledge  
- **Routes intelligently** — Selects Haiku/Codex/Opus based on complexity
- **Reviews code** — Automatic Codex validation after implementation (NEW)
- **Tracks health** — Staleness warnings, coverage gaps, escalations
- **Updates continuously** — Weights tuned per usage

---

## Model Selection (Automatic)

Brain-task automatically routes to:

- **Haiku:** Trivial fixes (typos, colors) — <10 min, 12k tokens, 5% of tasks
- **Codex:** Standard features (filters, CRUD, refactors) — 30-45 min, 90k tokens, 80% of tasks, **includes code review**
- **Opus:** Debugging only (stuck, root cause) — 20-30 min, 130k tokens, 10% of tasks
- **Plan Mode:** Auto at complexity >= 50 or architectural tasks — 1-4 hours, 150-200k tokens, 5% of tasks

---

## Commands

```bash
# Main entry point - intelligent routing
/brain-task "Your task description"

# Debug flag - routes to Opus
/brain-task --debug "Why is this failing?"

# Force plan mode - shows architecture before implementing
/brain-task --plan "Should we migrate to gRPC?"

# Health check
/brain-status

# Batch-review sinapses (every 5 tasks)
/brain-consolidate

# Create failure lesson
/brain-lesson "What failed and why"
```

---

## How It Works (7 Steps)

1. **brain-decision** — Classify task, score complexity (0-100), select model
2. **brain-map** — Load relevant sinapses from brain.db  
3. **implement** — Haiku/Codex/Opus executes code
4. **brain-codex-review** — Automatic code validation + quality check (NEW)
5. **brain-document** — Propose sinapses updates
6. **Developer approval** — Accept/reject/modify proposals
7. **brain-consolidate** — Every 5 tasks, batch-review and update weights

---

## Token Budget (Typical)

- Simple fix (Haiku): 12k tokens, <10 min
- Standard feature (Codex): 90k tokens, 35-45 min
- Complex work (Codex + plan): 150k tokens, 60-90 min
- Debug (Opus): 130k tokens, 20-30 min
- **Typical session (3 tasks): 340k tokens, 1.5 hours, ~$0.80**

---

## Code Review (NEW in Phase 5)

After Codex implements, automatic review runs:

**Checks:**
- Conventions followed
- Tests passing
- No obvious bugs
- Input validation present
- Tenant isolation (if applicable)
- Performance (no N+1 queries)

**Auto-fixes:** Lint errors, missing tests  
**Blocks on:** Security issues, logic errors  
**Output:** Quality score (0-10) + detailed report

---

## Configuration

### brain.config.json (.brain/ root)

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
    "auto_fix": true,
    "checks": ["syntax", "conventions", "tests", "security", "performance"]
  }
}
```

### Integrate with CLAUDE.md

Add to your project's CLAUDE.md:

```markdown
## ForgeFlow Mini Brain

All tasks route through intelligent brain-task:

- /brain-task "description" — intelligent routing to Haiku/Codex/Opus
- /brain-status — health check
- /brain-consolidate — batch-review (every 5 tasks)

Model selection is automatic:
- Haiku: trivial (< 20 complexity)
- Codex: standard (20-75) — 80% of work, includes code review
- Opus: debugging (stuck, root cause)
- Plan mode: auto at complexity >= 50

See forgeflow-mini/README.md for full documentation.
```

---

## Parallel with $ms (Recommended Start)

Use brain-task for:
- Learning new patterns
- Debugging stuck problems
- Architectural decisions
- Exploration

Keep $ms for:
- Standard T1-T7 features
- Established patterns
- Rigorous contract-driven work

**After 2 weeks:** Compare ROI (tokens, time, quality), then optimize.

---

## Troubleshooting

### Skills Won't Show

```
1. Edit ~/.claude/settings.json
2. Add skills.auto_load: true
3. Add directory path (forward slashes!)
4. Restart Claude Code
5. Verify: ls forgeflow-mini/skills/ | grep brain
```

### No Sinapses Found

```bash
/brain-status
```

### Context Packet Wrong Size

Edit brain.config.json, adjust context_loading settings.

---

## Architecture

```
.brain/
├── hippocampus/     (architecture, conventions, decisions — immutable)
├── cortex/          (domain knowledge — grows with tasks)
├── sinapses/        (cross-cutting flows)
├── lessons/         (failure patterns)
├── working-memory/  (temporary task state)
├── progress/        (activity log, health)
└── brain.db         (SQLite index)
```

---

## Phase Status

Phase 5 Complete ✅
- Multi-model routing (Haiku/Codex/Opus)
- Code review integration (automatic post-implement)
- Plan mode auto-triggering
- Codex as code reviewer

---

## Full Documentation

- Architecture: forgeflow-mini/docs/PHASE_5_ARCHITECTURE.md
- Implementation: forgeflow-mini/docs/PHASE_5_IMPLEMENTATION.md
- Quick start: forgeflow-mini/PHASE_5_QUICK_START.md

---

**Start now:** `/brain-task "your first task"`

Brain will handle context, routing, review, and updates. 🧠
