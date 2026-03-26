---
name: brain-lesson
description: Learner — Capture failures as lessons, escalate patterns to conventions
---

# brain-lesson Skill — Learner

**Purpose:** When a task fails, capture the failure as a structured lesson in the Brain. If 3+ similar lessons exist, escalate to proposed convention.

**Token Budget:** 5k in / 2k out

## Trigger

Activated when:
- Task fails (test failure, bug discovered, deployment issue)
- Acceptance criteria not met
- Blocker encountered with known solution

## Workflow

### Step 1: Collect Failure Context

From task execution, extract:
- **What failed:** error message, failing test, unmet criterion
- **Where:** file, line number, function
- **When:** timestamp, which iteration
- **Root cause:** diagnosis from error or debugging
- **Solution applied:** what fixed it (or what should fix it)
- **Lesson learned:** generalized insight

### Step 2: Categorize

Assign:
- **Domain:** backend, frontend, database, infra, process
- **Layer:** handler, adapter, component, query, schema, etc.
- **Severity:** critical, high, medium, low
- **Trigger:** baseline (foundational), correction (we did it wrong), improvement (edge case)

### Step 3: Create Lesson File

Lessons are stored in **distributed domain-specific directories**:

- **Domain-specific lessons** → `.brain/cortex/<domain>/lessons/lesson-XXXXX.md`
  - Backend: `.brain/cortex/backend/lessons/`
  - Frontend: `.brain/cortex/frontend/lessons/`
  - Database: `.brain/cortex/database/lessons/`
  - Infra: `.brain/cortex/infra/lessons/`

- **Cross-domain lessons** → `.brain/lessons/cross-domain/lesson-XXXXX.md`
  - Lessons that span multiple domains (auth, events, process rules)

- **Inbox (temporary)** → `.brain/lessons/inbox/lesson-XXXXX.md`
  - Unclassified lessons awaiting categorization

**Lesson format** (all regions):

```markdown
---
# Required fields
id: lesson-XXXXX
title: [Brief lesson title]
scope: domain-local | cross-domain
domain: backend | frontend | database | infra | analytics
affected_domains: []                     # populated only if scope = cross-domain
status: draft                            # see Lifecycle below
parent_synapse: null                     # sinapse-id if this extends a known pattern
tags: [domain, layer, trigger-type]
severity: critical | high | medium | low
created_from: YYYY-MM-DD-<slug>          # task-id that produced this lesson
source_agent: brain-lesson               # which skill created it
recurrence_count: 1
promotion_candidate: false
related_links: []                        # related lesson or sinapse ids
created_at: [ISO8601]
updated_at: [ISO8601]

# Optional fields
model_used: null                         # haiku | sonnet | codex | opus — which model was active when lesson was created
supersedes: null                         # lesson-id if this replaces an older lesson
superseded_by: null                      # lesson-id if a newer lesson replaced this one
confidence: 0.3-0.9
root_cause_type: misuse | gap | regression | assumption
evidence: null                           # brief evidence description
---

# Lesson XXXXX — [Title]

**Date:** [date] | **Trigger:** [baseline | correction | improvement] | **Layer:** [layer]

## Wrong
[What the wrong approach is]

## Correct
[What the correct approach is]

## Rule
[Generalized rule to remember]

## Impact
**[Severity]:** [Why this matters]

## Example (Optional)
[Code example or scenario showing the issue]
```

## Confidence Scoring (v0.3.0)

Active lesson confidence range: 0.3 (initial instinct) -> 0.9 (high confidence, convention candidate). At 1.0: promoted to convention.

| Event | Confidence Change |
|-------|-------------------|
| Initial creation | 0.3 |
| Same pattern seen again | +0.1 |
| Developer confirms relevance | +0.2 |
| Developer marks as noise | -0.3 (may archive) |
| Promoted to convention | Promoted to convention: lesson confidence set to 1.0 (frozen - conventions are considered validated and no longer decay). |

Developer confirms by either: (a) replying 'confirm lesson [lesson-id]' in the current session, or (b) editing the lesson file to add `confirmed: true` to its frontmatter. brain-lesson applies +0.2 to confidence in brain.db on next invocation when it detects `confirmed: true`.

Evidence is tracked in brain.db `lessons.evidence` field as a JSON array:
```json
[
  {"task_id": "2026-03-26-fix-auth", "event": "created", "timestamp": "..."},
  {"task_id": "2026-03-27-fix-tenant", "event": "reconfirmed", "timestamp": "..."}
]
```

## Promotion Pipeline

Observation → Instinct (confidence 0.3)
  → Active lesson (confidence 0.5+, status: 'active')
    → Convention candidate (confidence 0.7+, 3+ occurrences, status: 'promotion_candidate')
      → Convention (developer approves via /brain-consolidate, status: 'promoted')

## Scope
- Default scope: "project" (lesson applies to this project only)
- If the same pattern is seen in 2+ projects: auto-promote scope to "global"
- Global lessons are loaded by brain-map regardless of project

### Lesson Lifecycle

```
draft → active → promotion_candidate → promoted
  ↓                     ↓
archived            archived
  ↓                     ↓
superseded          superseded
```

| Status | Meaning | Who Sets It |
|--------|---------|-------------|
| `draft` | Just created by brain-lesson, pending review | brain-lesson (auto) |
| `active` | Confirmed lesson, available to brain-map for context loading | Developer (manual) or brain-consolidate |
| `promotion_candidate` | 3+ lessons share same domain+tag pattern, flagged for hippocampus promotion | brain-lesson Step 4 |
| `promoted` | Convention added to hippocampus/conventions.md | brain-consolidate (after approval) |
| `archived` | No longer relevant, kept for history | Developer or brain-consolidate |
| `superseded` | Replaced by a newer lesson — set `superseded_by` field | brain-lesson (when creating replacement) |

**Curation rule:** A lesson survives only if it satisfies ALL three criteria:
1. **Cross-domain applicability** — applies to multiple features, not just one
2. **Prevents repeated mistakes** — captures a pattern that causes failures if violated
3. **Architectural, not cosmetic** — describes structure/boundaries, not styling/implementation

### Step 4: Check for Promotion Candidacy

Query brain.db for recurrence patterns:

```sql
SELECT domain, tags, COUNT(*) as lesson_count, GROUP_CONCAT(id) as lesson_ids
FROM lessons
WHERE status IN ('draft', 'active')
GROUP BY domain, tags
HAVING COUNT(*) >= 3
ORDER BY lesson_count DESC
```

For each group with 3+ lessons sharing the same domain + tag:

**Step 4a: Flag as Promotion Candidate**
1. Read all 3+ matching lesson files from disk
2. Identify the common rule/pattern they all illustrate
3. Set `status: promotion_candidate` and `promotion_candidate: true` on all matching lessons
4. Update `recurrence_count` on each lesson to reflect the actual count

**Step 4b: Output Detection Notice**

```
PROMOTION CANDIDATE DETECTED

Domain: [backend/frontend/database/infra]
Pattern: [common pattern name]
Count: [N] lessons (lesson-XXXX, lesson-YYYY, lesson-ZZZZ)
Status: Flagged for review at next /brain-consolidate cycle
```

**Step 4c: Do NOT Generate Escalation Proposals**

brain-lesson's responsibility ends at detection and flagging. Actual proposal generation, deduplication, convention checking, and approval-facing output are owned exclusively by **brain-consolidate**. brain-lesson must NEVER:
- Create `escalation-PROPOSAL-*.md` files
- Write to `.brain/hippocampus/conventions.md`
- Present approval prompts to the developer for escalation

### Step 5: Update brain.db

Insert new lesson:
```sql
INSERT INTO lessons (id, file_path, title, domain, scope, severity, status, recurrence_count, confidence, created_from, source_agent, created_at, updated_at)
VALUES ('lesson-XXXXX', '.brain/cortex/backend/lessons/lesson-XXXXX.md', 'Tenant isolation failure in adapter layer', 'backend', 'domain-local', 'critical', 'draft', 1, 0.3, 'YYYY-MM-DD-<slug>', 'brain-lesson', datetime('now'), datetime('now'))
```

Update sinapse weights of related sinapses:
- If lesson used while debugging: -0.01 (we should have known this)
- If lesson is new insight: +0.02 (adds value)

## Escalation Example

Scenario: 3rd tenant isolation bug found

```
1. Create lesson-0037.md: "Another tenant isolation failure"
2. Query brain.db: Find lessons with tag 'tenant-safety'
3. Count: lesson-0001, lesson-0002, lesson-0037 = 3
4. All 3 lessons flagged: status → promotion_candidate
5. Output: "⚠ PROMOTION CANDIDATE: 3 lessons match [tenant-safety] in backend"
6. brain-lesson stops here — brain-consolidate owns proposal generation
```

## Example Lessons

### Lesson A: Tenant Safety (Correction)

```markdown
---
id: lesson-0037
title: Query without tenant filter leaks data
scope: cross-domain
domain: backend
affected_domains: [backend, database]
status: active
parent_synapse: .brain/cortex/backend/sinapses/tenant-isolation-flow
tags: [tenant-isolation, adapter, bug]
severity: critical
created_from: 2026-03-24-fix-tenant-leak
source_agent: brain-lesson
recurrence_count: 1
promotion_candidate: false
related_links: [.brain/cortex/backend/sinapses/tenant-isolation-flow, .brain/cortex/database/index]
created_at: 2026-03-24T15:30:00Z
updated_at: 2026-03-24T15:30:00Z
root_cause_type: misuse
---

# Lesson 0037 — Query without tenant filter leaks data

**Date:** 2026-03-24 | **Trigger:** correction | **Layer:** Go adapter

## Wrong
```go
rows, err := db.QueryContext(ctx, "SELECT * FROM products")
```

## Correct
```go
tx := pgdb.BeginTenantTx(ctx)
rows, err := tx.QueryContext(ctx, "SELECT * FROM products WHERE tenant_id = current_tenant_id()")
```

## Rule
Every query must filter by current_tenant_id(). No exceptions.

## Impact
**Critical:** Cross-tenant data leak. Customer data exposed to wrong tenant.
```

### Lesson B: Test Coverage (Improvement)

```markdown
---
id: lesson-0038
title: Port forwarding tests need explicit cleanup
scope: domain-local
domain: infra
status: active
tags: [testing, process, cleanup]
severity: medium
created_from: 2026-03-24-test-flake
source_agent: brain-lesson
recurrence_count: 2
promotion_candidate: false
related_links: []
created_at: 2026-03-24T16:00:00Z
updated_at: 2026-03-24T16:30:00Z
root_cause_type: gap
---

# Lesson 0038 — Port forwarding tests need explicit cleanup

**Trigger:** improvement | **Layer:** Process (tests)

## Wrong
Test creates temporary port forward but doesn't tear down in defer().

## Correct
Use defer() to ensure cleanup happens even if test panics.

## Rule
Any test resource must be cleaned up in defer(). No exceptions.

## Impact
**Medium:** Test leaks cause interference between test runs, flaky results.
```

## Failure Scenarios

| Scenario | Action |
|----------|--------|
| Same lesson exists | Increment recurrence_count, don't create duplicate |
| Promotion candidate detected | Set `status: promotion_candidate` on matching lessons. brain-consolidate handles proposal generation. |
| Related sinapses outdated | Mark for update in .brain/working-memory/sinapse-updates-{task_id}.md |
| No clear solution found | Mark severity=critical, flag for team discussion |

---

**Created:** 2026-03-24 | **Agent Type:** Learner | **Last Updated:** 2026-03-25 (consolidated escalation ownership, strengthened lesson schema)
