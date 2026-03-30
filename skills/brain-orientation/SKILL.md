---
name: brain-orientation
description: Session GPS — injected at every session start by the session-start hook. NOT user-invocable. Provides the LLM with brain system awareness so it can route itself without always needing brain-dev.
---

# brain-orientation — Session GPS

This context is auto-injected at session start. You now know the brain system.

## What is the Brain?

The `.brain/` directory is persistent project memory:

- **hippocampus/** — Immutable knowledge (sinapses, conventions, architecture). NEVER write here.
- **cortex/** — Domain-specific context (API specs, schemas, integrations). Grows with the project.
- **working-memory/** — Current task state (brain-state.json, dev-context). Ephemeral per-task.

## Available Skills

### Development Pipeline

| Skill | Role |
|-------|------|
| `/brain-dev` | Smart router — classifies request, scores complexity, routes |
| `/brain-map` | Context loader — retrieves brain files by keywords |
| `/brain-plan` | Planner — creates step-by-step implementation plan |
| `/brain-task` | Implementer — executes plan, writes code |
| `/brain-verify` | Verifier — runs tests, checks quality |
| `/brain-document` | Documenter — updates brain files with learnings |

Token budgets are defined in `shared/context-budget-guide.md`.

### Off-Pipeline

| Skill | Role |
|-------|------|
| `/brain-consult` | Q&A with brain context (quick, research, or consensus mode) |
| `/brain-config` | Project init + configuration |
| `/brain-health` | Dashboard, consolidation, brain maintenance |

## Standard Pipeline Flow

```
brain-dev → brain-map → brain-plan → brain-task → brain-verify → brain-document
```

brain-dev classifies and routes. Each skill invokes the next in the chain.
For trivial tasks (complexity < 20), brain-dev skips directly to brain-task.

## Shortcuts (Skip brain-dev)

When you already know which skill you need, call it directly:

- **Quick question?** → `/brain-consult "how does auth work?"`
- **Know the plan, just implement?** → `/brain-task "add retry to API client"`
- **Already implemented, verify?** → `/brain-verify`
- **Need context loaded first?** → `/brain-map "auth, tenants"`

brain-dev is the safest default, but skipping it saves ~500 tokens when intent is clear.

## Rules (Non-Negotiable)

1. **Never write to hippocampus/** — it is immutable. Only brain-document with explicit user approval can update it.
2. **Check circuit breaker** — read `.brain/brain-project-state.json` before starting work. If `circuit_breaker.status` is `"OPEN"`, STOP and report.
3. **Respect token budgets** — each skill has a budget (see table above). Do not let any phase balloon.
4. **Subagent isolation** — subagents must NOT call other brain skills. Only the orchestrating skill chains the pipeline.
5. **State hygiene** — always update `brain-state.json` phase field when transitioning between pipeline stages.
6. **No parallel pipelines** — one task at a time. Complete or abandon before starting another.
