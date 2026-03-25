# ForgeFlow Mini — Brain Rules for Claude Code

This file contains the rules that every Claude Code session using ForgeFlow Mini must follow. These rules are automatically injected into every project's CLAUDE.md when you run `/brain-init`.

---

## Session Start Ritual

On every session open, Claude reads in this order:
1. `.brain/hippocampus/strategy.md` — Product goals and business context
2. `.brain/progress/board.md` — Current task state (Kanban)
3. `.brain/progress/activity.md` — Recent agent activity and token costs
4. Relevant lessons (if any) matching next task domain

Then outputs a briefing:
```
BRAIN STATUS: [healthy | degraded | uninitialized]
LAST CONSOLIDATION: [date]
NEXT TASK: [from progress/board.md]
RELEVANT LESSONS: [top 3 matching current domain]
```

Session does not proceed until briefing is confirmed.

---

## Before Every Task

1. Invoke `/brain-map` to assemble context packet
   - Input: task description
   - Output: classified domain + ordered sinapse list + loaded context
2. Verify Readiness Gate passes (4 checks in brain.config.json)
3. Load lessons matching task domain into working context
4. Confirm: "Context packet assembled. Ready to plan."

Session does not proceed without context packet.

---

## After Every Task

1. Mark task `[x]` in progress/board.md
2. Invoke `/brain-lesson` if failure occurred (else skip)
3. Invoke `/brain-document` to propose sinapse updates
4. Review and approve proposed updates
5. Run consolidation if 5+ tasks completed since last cycle

`working-memory/` is cleared after every task completes.

---

## Absolute Rules (Enforced by Hooks)

These rules are checked at the platform level, not by prompting:

| Rule | Enforcement | Consequence |
|------|---|---|
| **Hippocampus immutable** | PreToolUse hook | Block writes to `.brain/hippocampus/` without approval |
| **Context before code** | PreToolUse hook | Verify context packet loaded before any implementation |
| **Format validation** | PreToolUse hook | Any new `.md` in `.brain/` must have valid YAML frontmatter |
| **Lesson at escalation** | PostToolUse hook | 3+ same lesson type → propose convention to hippocampus |
| **Working memory clear** | PostToolUse hook | `.brain/working-memory/` cleared after task completion |
| **Weight updates** | PostToolUse hook | brain.db weights updated based on task success/failure |

---

## Sinapses

Every non-hippocampus `.md` in `.brain/` is a **sinapse** — a unit of knowledge with:
- **YAML frontmatter** with id, title, region, tags, links, weight, updated_at
- **Markdown body** with human-readable content and `[[wikilinks]]` to other sinapses
- **Weight** (0.0–1.0) that evolves based on usage (higher weight = load first in context)

Sinapses are organized by region:
- `cortex/backend/` — API patterns, services, models, auth, outbox
- `cortex/frontend/` — Components, routes, state, SDK patterns
- `cortex/database/` — Schema, migrations, query patterns
- `cortex/infra/` — Deployment, CI/CD, environments
- `sinapses/` — Cross-cutting flows (auth, payment, events)
- `lessons/` — Captured failures with pattern analysis

---

## Agent Roles

ForgeFlow Mini activates these roles automatically based on context:

| Role | Trigger | Input | Output |
|------|---------|-------|--------|
| **ContextMapper** | task starts | task description | classified domain + weighted sinapses |
| **Planner** | context loaded | context packet + task | structured plan in working-memory/ |
| **McKinsey Analyst** | high-stakes decision | decision + strategy.md | recommendation card with ROI estimate |
| **Implementer** | plan approved | plan + context packet | code changes |
| **Documenter** | task completes | diff + affected sinapses | proposed updates to cortex/ |
| **Learner** | failure occurs | failure description | lesson-XXXX.md |

---

## Token Optimization

Context is loaded in 3 tiers to minimize waste:

**Tier 1 (~4k tokens, always loaded):**
- `.brain/hippocampus/` condensed summary (~2k)
- Current task description
- Top 3 lessons matching task domain

**Tier 2 (~10-15k tokens, domain-specific):**
- Top 5 sinapses by weight in relevant cortex region
- Cross-cutting sinapses if task spans multiple domains

**Tier 3 (~5k tokens, on-demand only):**
- Additional sinapses explicitly linked in Tier 2
- Loaded only if ContextMapper flags them critical

**Persistent minds** on iterative work:
- First iteration: full context load (~15k)
- Second+ iterations: `git diff` only (~5k) = **87% reduction**

---

## McKinsey Layer

For architectural decisions, tech choices, new modules, or major refactors:

```
Internal analysis (against .brain/hippocampus/strategy.md):
  - Score: Business Impact / Technical Risk / Effort / Strategic Alignment
  - Check: Conflicts with existing ADR?
  - Check: Technical debt to fix first?

External research (parallel agents):
  - Web search: "best practices for [technology] 2025/2026"
  - context7: Latest library docs
  - Web search: "[Stripe/Google] [same decision]"
  - Web search: "[industry benchmark] [similar problem at scale]"

Output: Recommendation card
  - Business impact score
  - External benchmarks from research
  - 3 alternatives with scored trade-offs
  - Recommended choice with reasoning
  - ROI estimate
  - Risk flags
```

---

## Consolidation Cycle

Triggered by `/brain-consolidate` or automatically after 5 completed tasks:

1. Review all `working-memory/` records from completed tasks
2. Identify which cortex sinapses were touched
3. **Propose** updates as diffs (never overwrites) for developer review
4. Extract patterns from lessons: "3+ same type → propose convention?"
5. Update brain.db weights based on task outcomes
6. Clear consolidated working-memory records
7. On developer approval: apply all changes atomically

---

## Critical Files (Do Not Edit Manually)

These files are managed by ForgeFlow Mini and should only be edited after careful review:

- `.brain/brain.db` — auto-generated index, always derived from `.md` files
- `.brain/working-memory/*` — volatile per-task context, cleared after completion
- `progress/activity.md` — agent activity log, auto-appended

---

## Critical Files (Developer Owns)

Edit these directly:

- `.brain/hippocampus/*` — your constitutional knowledge (immutable to agents)
- `.brain/progress/board.md` — your Kanban state
- CLAUDE.md — your project rules (this file is your copy, modify as needed)

---

## When Something Goes Wrong

1. Check `.brain/progress/activity.md` for recent agent actions and token costs
2. Check `.brain/progress/board.md` for task state
3. Check `.brain/lessons/` for relevant error patterns
4. Run `/brain-status` to see Brain health and visualization

If an agent produces incorrect code:
- Run `/brain-lesson` to capture the failure pattern
- After 3 same lessons, a convention will be proposed to hippocampus
- All future tasks load that lesson by default

---

## Success Metrics

Track these to measure ForgeFlow Mini effectiveness on your project:

- **Token efficiency** — tokens/completed-task (target: <100k for standard tasks)
- **Error rate** — percentage of tasks requiring fix (target: <5%)
- **Brain freshness** — days since last consolidation (target: <7 days)
- **Pattern escalation** — lessons → conventions (target: 3–5 per month)
- **Cost per task** — actual vs budget (target: within 10% of budget)

---

**ForgeFlow Mini v0.1 — March 2026**

These rules are the "constitution" that makes ForgeFlow Mini work. They exist at the platform level (enforced by hooks), not as prompts. This ensures consistency across sessions and projects.
