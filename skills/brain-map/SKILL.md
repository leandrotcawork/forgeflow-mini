---
name: brain-map
description: ContextMapper — Load weighted sinapses for task context
---

# brain-map Skill — ContextMapper

**Purpose:** Given a task description, load the most relevant sinapses from the Brain and assemble a context packet for planning and implementation.

**Token Budget:** 4k in / 1k out

## Workflow

### Input
- Task description (1-3 sentences)
- Optional: region filter (backend, frontend, database, infra, lessons)
- Optional: severity filter (critical, high, medium, low)

### Process

#### Step 1: Classify Task
Parse the task description to identify:
- **Primary domain:** backend, frontend, database, infra, analytics, or cross-cutting
- **Keywords:** Extract 3-5 keywords from the task
- **Severity:** Infer urgency (critical, high, medium, low)

Example:
```
Task: "Fix tenant isolation bug in product creation endpoint"
→ Domain: backend
→ Keywords: [tenant, isolation, bug, product, endpoint]
→ Severity: critical
```

#### Step 2: Query brain.db (3-Tier Loading)

**Tier 1 (Always loaded, ~2k tokens):**
- Hippocampus summary (architecture.md, conventions.md, strategy.md)
- Top 3 lessons matching task domain
- cortex_registry.md (which domains exist)

**Tier 2 (Domain-specific, ~10-15k tokens):**
- Top 5 sinapses from primary domain by weight (descending)
- All sinapses from "sinapses/" (cross-cutting flows)
- Example: for backend task, load cortex/backend/* + all sinapses/*

**Tier 3 (On-demand, ~5k tokens):**
- Additional sinapses explicitly linked in Tier 2 content (via [[wikilinks]])
- Load only if flagged as critical

#### Step 3: Rank by Weight + Relevance

For each sinapse, score = (weight × 0.6) + (keyword_match × 0.4)

Where:
- **weight** = stored in brain.db (0.0-1.0, updated after each task)
- **keyword_match** = number of matching keywords / total keywords

Sort descending.

#### Step 4: Assemble Context Packet

Create `working-memory/context-packet.md`:

```markdown
---
task_id: [UUID]
task_description: [user input]
domain: backend
timestamp: [ISO 8601]
---

# Context Packet

## Domain Classification
- **Primary:** backend
- **Secondary:** [if applicable]
- **Keywords:** [tenant, isolation, bug, product, endpoint]

## Loaded Sinapses (Tier 1 + Tier 2)

### Tier 1 — Always Present (Immutable Strategy Layer)
- **hippocampus/architecture.md** (0.95) — Go modular monolith structure
- **hippocampus/conventions.md** (0.95) — Go absolute rules
- **lesson-0001.md** (1.0) — Tenant-safe DB access is mandatory
- **lesson-0002.md** (1.0) — Handlers must fail fast on auth and tenancy

### Tier 2 — Backend Domain (Weighted)
- **cortex/backend/index.md** (0.90) — Backend architecture overview
- **sinapses/tenant-isolation-flow.md** (0.95) — Full tenant isolation walkthrough
- **cortex/database/index.md** (0.88) — Database tenant isolation patterns
- **lesson-0003.md** (1.0) — Outbox must be atomic with writes

## Token Usage
- Tier 1: 4k tokens
- Tier 2: 12k tokens
- **Total context loaded:** 16k tokens
- **Remaining for implementation:** 84k tokens (per stage)

## Next Step
Run `/brain-plan` with this context packet.
```

### Output
1. **Context Packet** (`working-memory/context-packet.md`) — structured input for Planner
2. **Sinapse List** — ordered by relevance score, includes file paths
3. **Domain Summary** — which cortex regions are active
4. **Token Budget Remaining** — for implementation stages

## Tier Selection Logic

```
IF task mentions "bug fix":
  → Load lessons heavily (Tier 1 + domain-specific lessons)
  → Load conventions (Tier 1)
  → Load cortex overview (Tier 2)

IF task mentions "new feature":
  → Load strategy.md (Tier 1)
  → Load cortex region (Tier 2)
  → Load ADRs (Tier 1)

IF task mentions cross-domain (auth, tenancy, events):
  → Load all sinapses/ (Tier 2, always)
  → Load relevant cortex regions (Tier 2)
  → Load all conventions (Tier 1)

IF high-stakes decision (architecture, big refactor):
  → Load Tier 1 + Tier 2 fully
  → Flag for McKinsey Layer (Phase 3)
```

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| brain.db doesn't exist | Error: "Run `python build_brain_db.py` first" |
| Task description is ambiguous | Ask clarifying questions about domain |
| No sinapses match keywords | Load Tier 1 only + advise: "Add task-specific sinapses" |
| Tier 2 loading would exceed budget | Warn and reduce to top 3 instead of top 5 |

## Example Execution

```
User: "Add unit price field to orders"

ContextMapper:
  1. Classify: backend, data model, low-risk
  2. Keywords: [unit, price, orders, field, data]
  3. Load Tier 1: hippocampus (all), lesson-0007 (generated artifacts)
  4. Load Tier 2: cortex/backend, cortex/database
  5. Score sinapses by (weight + keyword match)
  6. Output: context-packet.md with 12 sinapses

Result:
  - context-packet.md written to working-memory/
  - 18k tokens consumed
  - 82k tokens remain for implementation
  - Ready for /brain-plan
```

---

**Created:** 2026-03-24 | **Phase:** 2 | **Agent Type:** ContextMapper
