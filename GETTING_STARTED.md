# ForgeFlow Mini — Getting Started Guide

**TL;DR:** Copy plugin → Register skills in settings.json → Initialize brain → Start using /brain-task

---

## Step 1: Install ForgeFlow Plugin

Copy the forgeflow-mini directory to your Claude Code plugins directory:

```bash
# Option A: Copy to global plugins
cp -r forgeflow-mini ~/.claude/plugins/

# Option B: Use as submodule in project
git submodule add https://github.com/leandrotcawork/forgeflow-mini.git forgeflow-mini
```

---

## Step 2: Register Skills (IMPORTANT!)

**Edit ~/.claude/settings.json and add:**

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

**Then restart Claude Code.**

Now when you type `/`, you should see:
- /brain-init
- /brain-decision
- /brain-task
- /brain-plan
- /brain-mckinsey
- /brain-map
- /brain-document
- /brain-status
- /brain-consolidate
- /brain-codex-review
- /brain-lesson

---

## Step 3: Initialize Brain for Your Project

From inside a Claude Code session in your project root:

```
/brain-init
```

This creates:
- `.brain/hippocampus/` — architecture, conventions, strategy, decisions
- `.brain/cortex/<domain>/` — domain knowledge sinapses + domain-local lessons
- `.brain/lessons/` — cross-domain, inbox, archived lesson directories
- `.brain/working-memory/` — ephemeral task artifacts
- `.brain/progress/` — activity log, health reports, completed context archives
- `.brain/brain.db` — SQLite index (built by `python scripts/build_brain_db.py`)

---

## Step 4: Start Your First Task

```bash
# Simple task
/brain-task "Add dark mode toggle to settings page"
```

Brain automatically:
1. Routes to optimal model (Haiku/Codex/Opus)
2. Loads relevant patterns (sinapses)
3. Implements code
4. Reviews code (if Codex)
5. Proposes sinapses updates
6. Shows results

---

## Common Commands

```bash
# Main entry point - routes intelligently
/brain-task "Your task description"

# Check brain health
/brain-status

# Batch-review sinapses updates (every 5 tasks)
/brain-consolidate
```

---

## How to Use Each Task Type

### Simple Fix (Haiku)
```
/brain-task "Change button color from blue to green"
→ Haiku routes
→ 5-10 minutes, 12k tokens
→ No review needed (trivial)
```

### Standard Feature (Codex)
```
/brain-task "Implement product filtering by price range"
→ Codex routes
→ 30-45 minutes, 90k tokens
→ Code review runs automatically
→ Brain proposes 2-3 sinapses updates
```

### Complex Work (Codex + Plan)
```
/brain-task "Refactor tenant isolation in analytics"
→ Complexity >= 50
→ Plan mode ACTIVATES (auto)
→ Shows architecture, risks, sinapses
→ You approve
→ Codex implements with code review
→ 60-90 minutes, 150k tokens
```

### Debug Stuck Problem (Opus)
```
/brain-task --debug "Why are tests failing on tenant queries?"
→ Opus routes (debugging)
→ Analyzes root cause
→ Proposes fix + tests
→ 20-30 minutes, 130k tokens
```

### Big Decision (Codex + Plan + McKinsey)
```
/brain-task --plan "Should we migrate to gRPC for internal services?"
→ Plan mode activated (forced with --plan)
→ Shows evaluation framework
→ McKinsey layer runs (external research, benchmarks)
→ 3 alternatives with ROI scores
→ 1-4 hours, 180k tokens
```

---

## After 5 Tasks: Consolidation

Brain will suggest:

```
/brain-consolidate
```

This batch-reviews all sinapses updates:

1. Shows each proposed change (A = approve, R = reject, M = modify)
2. Generates brain-health.md report
3. Updates weights in brain.db
4. Clears working-memory
5. Archives to progress/activity.md

---

## Parallel with Existing Workflow

### Use brain-task for:
- Unknown patterns (learning)
- Debugging (stuck, root cause)
- Architectural decisions
- Exploration

### Keep using $ms (or existing workflow) for:
- Standard features (you've done before)
- Established patterns
- T1-T7 pipeline

**Recommended:** Run both in parallel for 2 weeks, measure ROI, then decide.

---

## Token Budget Estimate

- Trivial fix: 12k tokens
- Simple feature: 50k tokens
- Standard feature: 90k tokens
- Complex feature: 150k tokens
- Typical session (3 features): 340k tokens (~$0.80)

---

## Troubleshooting

### Skills Don't Show

1. Edit ~/.claude/settings.json
2. Verify features.skills.auto_load: true
3. Check directory path (use forward slashes!)
4. Restart Claude Code
5. Verify files exist: ls forgeflow-mini/skills/*.md

### Brain Not Loading Sinapses

```bash
python ~/.claude/plugins/forgeflow-mini/scripts/build_brain_db.py --brain-path .brain
```

This rebuilds brain.db from .md files in `.brain/`. Schema source of truth: `docs/brain-db-schema.sql`.

### Help

See README.md for full documentation, or check individual SKILL.md files in forgeflow-mini/skills/

---

## What Gets Created

After tasks, you'll have:

```
.brain/
├── cortex/           (updated with new patterns)
├── lessons/          (failure patterns, if any)
├── working-memory/   (cleared after consolidation)
├── progress/         
│   ├── activity.md   (running log)
│   └── brain-health.md (health report)
└── brain.db          (weights updated)
```

---

## Next: Configure for Your Project

Edit `.brain/brain.config.json` to customize:

```json
{
  "project_name": "YourProjectName",
  "model_strategy": {
    "primary": "codex",
    "debugging": "opus",
    "trivial": "haiku"
  },
  "codex_review": {
    "auto_post_implement": true,
    "auto_fix": true
  }
}
```

---

## Ready?

```
1. Clone/copy forgeflow-mini to ~/.claude/plugins/
2. Edit ~/.claude/settings.json (register skills)
3. Restart Claude Code
4. /brain-init  (inside a Claude Code session)
5. /brain-task "Your first task"
```

Done. Brain learns as you work. 🧠
