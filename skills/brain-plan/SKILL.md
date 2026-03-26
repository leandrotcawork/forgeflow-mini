---
name: brain-plan
description: Planner — Convert context packet to structured implementation plan
---

# brain-plan Skill — Planner

## Pipeline Position

brain-plan is invoked during brain-decision Step 4 when plan mode is triggered (complexity >= 50 or `--plan` flag). It runs between brain-map (context loading) and brain-task Step 3 (implementation). Not on the default pipeline path — only activated for complex tasks requiring architectural planning.

**Purpose:** Take a context packet (from brain-map) and task description, then produce a detailed, step-by-step implementation plan with acceptance criteria, file locations, and estimated token usage.

**Token Budget:** 15k in / 5k out

## Workflow

### Input
- Context packet (from .brain/working-memory/context-packet-{task_id}.md)
- Task description
- Optional: stakeholder constraints, deadline

### Process

#### Step 1: Analyze Context Packet

Read `.brain/working-memory/context-packet-{task_id}.md` and extract:
- Domain classification (backend, frontend, database, etc.)
- Loaded sinapses (review all Tier 1 + Tier 2)
- Conventions relevant to domain
- Related lessons (especially failures to avoid)
- Architecture constraints from ADRs

#### Step 2: Break Task into Subtasks

Decompose the task into logical steps that follow Phase conventions:
- For backend: API contract → service logic → adapter → test → docs
- For frontend: component structure → SDK integration → styling → test
- For database: schema → migration → index → test
- For multi-domain: explicit dependency order

Example:
```
Task: "Add product margin to analytics dashboard"

Subtasks:
  1. [backend] Define ProductMarginCalculated event schema
  2. [backend] Wire margin calculation in product service
  3. [backend] Emit event via outbox pattern
  4. [worker] Create event handler in analytics_worker
  5. [database] Add margin_pct column to products_analytics view
  6. [frontend] Display margin metric in Products analytics surface
  7. [test] Integration test: order placed → event → analytics updated
  8. [docs] Update docs/PROGRESS.md
```

#### Step 3: For Each Subtask, Define

| Field | Content |
|-------|---------|
| **Description** | What and why (1-2 sentences) |
| **Files to create/modify** | Specific paths from codebase |
| **Convention to follow** | Which lesson/sinapse applies |
| **Acceptance criteria** | How to verify done (testable) |
| **Token estimate** | Expected tokens for this subtask |
| **Dependencies** | Which subtasks must complete first |

Example subtask:
```
### Subtask 1: Define ProductMarginCalculated Event Schema

**What:** Create event contract in contracts/events/v1/

**Files:**
  - contracts/events/v1/ProductMarginCalculated.yaml (create)

**Conventions:**
  - [[.brain/cortex/backend/lessons/lesson-0003]] Outbox must be atomic
  - [[metalshopping-event-contracts]] Event schema rules

**Acceptance Criteria:**
  - [ ] Event schema validates against JSON Schema
  - [ ] Event includes: product_id, tenant_id, margin_pct, timestamp
  - [ ] CI passes: `./scripts/validate_contracts.ps1`

**Tokens:** ~3k (read template, write schema, validate)

**Dependencies:** None (can start immediately)
```

#### Step 4: Detect Conflicts

Cross-reference each subtask against:
- **ADRs** — Does this contradict any architectural decision?
- **Conventions** — Does this violate absolute rules?
- **Lessons** — Is there a known pitfall to avoid?

Example:
```
Conflict detected in Subtask 2:
  "Wire margin calculation in product service"

  VIOLATES: .brain/cortex/backend/lessons/lesson-0003 (Outbox must be atomic)

  Action: Must emit ProductMarginCalculated event in SAME transaction
          as product update, not after Commit().
```

#### Step 5: Estimate Token Budget

Per-subtask estimate based on:
- File count (new or modified)
- Complexity (simple, moderate, complex)
- Testing needs

| Complexity | Estimate |
|-----------|----------|
| Simple (1-2 files, no tests) | 3-5k |
| Moderate (3-5 files, unit tests) | 8-12k |
| Complex (6+ files, integration tests) | 15-25k |

**Total budget check:**
```
Sum all subtask estimates. If total > 80k, warn:
"This task will consume ~120k tokens. Consider breaking into 2 sessions."
```

### Output

Create `.brain/working-memory/implementation-plan-{task_id}.md`:

```markdown
---
task_id: YYYY-MM-DD-<slug>
task: [user description]
domain: [backend | frontend | database | infra | cross-cutting]
timestamp: [ISO 8601]
status: planned
---

# Implementation Plan

## Task Summary
[1-2 sentence summary of what and why]

## Subtasks

### Subtask 1: [Description]
- **Files:** [paths]
- **Conventions:** [[lesson-X]], [[sinapse-Y]]
- **Acceptance Criteria:**
  - [ ] Criterion 1
  - [ ] Criterion 2
- **Token Estimate:** 5k
- **Dependencies:** None

### Subtask 2: [Description]
- **Files:** [paths]
- **Conventions:** [[lesson-X]]
- **Acceptance Criteria:** [...]
- **Token Estimate:** 8k
- **Dependencies:** Subtask 1

## Implementation Order
1. Subtask 1 (0 deps) -> 5k tokens
2. Subtask 2 (depends on 1) -> 8k tokens

## Total Token Budget
- Subtask estimates: 37k
- Testing buffer: 15k
- Documentation: 5k
- **Estimated total: 57k tokens**

## Conflict Check
- No ADR conflicts
- All conventions respected
- Lesson references noted

## Next Steps
1. Run Readiness Gate
2. Proceed to implementation
3. Update status after each subtask
4. Run /brain-document on completion
```

---

**Created:** 2026-03-24
