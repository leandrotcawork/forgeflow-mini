---
name: brain-status
description: Health dashboard — display Brain stats and regenerate 3D visualization
---

# brain-status Skill — Health Dashboard

**Purpose:** Display Brain health status and regenerate the 3D brain-graph.html visualization. Shows staleness per region, lesson density, pending actions, and overall Brain fitness.

**Token Budget:** 5k in / 3k out (minimal)

## Execution Mode

brain-status is a pure read-only operation — it can safely run as a Haiku subagent:

```
Agent(model: "haiku", description: "Brain health dashboard")
```

The subagent:
1. Reads `.brain/brain.db` (sinapse counts, weights, staleness)
2. Reads `.brain/progress/activity.md` (task count since consolidation)
3. Reads `.brain/progress/brain-project-state.json` (circuit breaker, model usage)
4. Formats dashboard output

Fallback: if subagent dispatch fails or is unavailable, runs inline.

## Trigger

Developer invokes: `/brain-status`

## Workflow

### Step 1: Query brain.db and Project State

From `.brain/brain.db`:
- Count sinapses per region
- Calculate average weight per region
- Count lessons per region
- Find latest `updated_at` per region
- Detect staleness (>30 days, >60 days)
- Count pending escalations in `.brain/lessons/inbox/escalation-*.md`

From `.brain/progress/brain-project-state.json`:
- Circuit breaker status (closed/open/half-open), consecutive failures, last reset
- Subagent dispatch counts by model (haiku, sonnet) with success/fallback rates
- Token savings from subagent delegation

### Step 2: Assess Health Status

Metric | Healthy | Stale | Very Stale
---|---|---|---
Last updated | < 7 days | 7–30 days | > 30 days
Region badge | ✅ healthy | ⚠️ stale | 🔴 very stale

### Step 3: Display Health Dashboard

Output to terminal (formatted table):

```
🧠 Brain Status — [project name]

Region           │ Sinapses │ Lessons │ Avg Weight │ Last Updated │ Status
─────────────────┼──────────┼─────────┼────────────┼──────────────┼───────────
hippocampus      │ 5        │ 0       │ 0.87       │ 2026-03-24   │ ✅ healthy
cortex/backend   │ 3        │ 5       │ 0.78       │ 2026-03-24   │ ✅ healthy
cortex/frontend  │ 2        │ 5       │ 0.71       │ 2026-03-24   │ ✅ healthy
cortex/database  │ 2        │ 0       │ 0.62       │ 2026-03-22   │ ⚠️ stale (2d)
cortex/infra     │ 1        │ 0       │ 0.45       │ 2026-02-10   │ 🔴 very stale (43d)
sinapses         │ 4        │ 0       │ 0.83       │ 2026-03-24   │ ✅ healthy
lessons/cross-d  │ 0        │ 3       │ 0.60       │ 2026-03-23   │ ✅ healthy

────────────────────────────────────────────────────────────────────────────
Total: 17 sinapses · 13 lessons · 7 regions

Circuit Breaker:
  Status: ✅ closed (normal operation)
  Consecutive failures: 0
  Last reset: 2026-03-24

Subagent Usage (last 24h):
  Haiku dispatches:  12 (11 success, 1 fallback-to-inline)
  Sonnet dispatches: 3  (3 success, 0 fallback-to-inline)
  Tokens saved:      ~45k (via Haiku delegation)

Pending actions:
  ⚠️  2 stale sinapses (>30 days)
  ⚠️  0 pending escalations
```

### Step 4: Regenerate Visualization

Run command:
```bash
python scripts/generate_viz.py .brain
```

Output:
```
✅ Brain graph updated: .brain/brain-graph.html
   Open in browser: file://.brain/brain-graph.html
```

## Integration with Workflow

`/brain-status` is typically run:
1. After `/brain-consolidate` to see updated Brain state
2. When developer wants to inspect overall Brain health
3. Before major architectural decisions
4. As part of team standup

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Running status without regenerating visualization | Always regenerate HTML |
| Ignoring stale regions for >60 days | Escalate: "This domain needs attention" |

---

**Activated by:** `/brain-status` command
**Prerequisite:** `build_brain_db.py` must have been run
**Updates:** Regenerates `.brain/brain-graph.html` on each run
**Non-destructive:** Reading only, no state changes
