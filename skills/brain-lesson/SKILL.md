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

- **Domain-specific lessons** → `cortex/<domain>/lessons/lesson-XXXXX.md`
  - Backend: `cortex/backend/lessons/`
  - Frontend: `cortex/frontend/lessons/`
  - Database: `cortex/database/lessons/`
  - Infra: `cortex/infra/lessons/`

- **Cross-domain lessons** → `lessons/cross-domain/lesson-XXXXX.md`
  - Lessons that span multiple domains (auth, events, process rules)

- **Inbox (temporary)** → `lessons/inbox/lesson-XXXXX.md`
  - Unclassified lessons awaiting categorization

**Lesson format** (all regions):

```markdown
---
id: lesson-XXXXX
title: [Brief lesson title]
region: [cortex/backend | cortex/frontend | cortex/database | cortex/infra | lessons/cross-domain]
tags: [domain, layer, trigger]
links:
  - [related sinapse]
  - [related sinapse]
severity: [critical | high | medium | low]
occurrence_count: 1
escalated: false
created_at: [ISO timestamp]
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

**Curation rule:** A lesson survives only if it satisfies ALL three criteria:
1. **Cross-domain applicability** — applies to multiple features, not just one
2. **Prevents repeated mistakes** — captures a pattern that causes failures if violated
3. **Architectural, not cosmetic** — describes structure/boundaries, not styling/implementation

### Step 4: Check for Escalation

Query brain.db for escalation candidates:

```sql
SELECT domain, array_agg(tags) as tag_array, COUNT(*) as lesson_count
FROM lessons
WHERE escalated = 0
GROUP BY domain, tag
HAVING COUNT(*) >= 3
ORDER BY lesson_count DESC
```

For each escalation candidate (3+ lessons with same domain + tag):

**Step 4a: Extract Common Pattern**
1. Read all 3+ matching lesson files from disk
2. Identify the common rule/pattern they all illustrate
3. Write pattern statement (1–2 sentences)

**Step 4b: Draft Convention**
Create convention text in the style of `hippocampus/conventions.md`:

```markdown
## [Pattern Name]

**Applies to:** [domain/layer]

**Rule:** [Generalized rule from 3+ lessons]

**Why:** [Impact of violation, e.g., "Prevents data leaks / test flakes / performance regressions"]

**Examples:**
- [[lesson-XXXX]] — [scenario]
- [[lesson-YYYY]] — [scenario]
- [[lesson-ZZZZ]] — [scenario]

**Checklist:**
- [ ] [Check 1]
- [ ] [Check 2]
- [ ] [Check 3]
```

**Step 4c: Create Escalation Proposal File**

Write to: `lessons/inbox/escalation-PROPOSAL-[timestamp].md`

```markdown
---
type: escalation-proposal
domain: [backend | frontend | database | infra | process]
source_lessons: [lesson-XXXX, lesson-YYYY, lesson-ZZZZ]
proposed_section: hippocampus/conventions.md
status: pending
created_at: [ISO 8601]
---

# Escalation Proposal: [Pattern Name]

## Evidence: 3+ Lessons on Same Pattern
[List the 3+ source lessons with brief scenario for each]

## Proposed Convention
[Draft convention text from Step 4b above]

## Approval Required
To approve this escalation:
1. Review the proposed convention
2. Edit if needed, or accept as-is
3. Add to `hippocampus/conventions.md` under the appropriate section
4. Mark all source lessons as escalated=1 in brain.db
5. Delete this proposal file (escalation-PROPOSAL-*.md)

## If Rejected
If you decide this pattern is NOT a convention (one-off or too specific):
1. Delete this proposal file
2. Keep the lessons as-is
3. Mark lessons as escalated=0 (remains unescalated)
```

**Step 4d: Output to Developer**

Message:
```
⚠️  ESCALATION DETECTED

Domain: [backend/frontend/database/infra/process]
Pattern: [pattern name]
Count: [N] lessons (lesson-XXXX, lesson-YYYY, lesson-ZZZZ)
Status: ⏳ Awaiting approval

Review proposal: .brain/lessons/inbox/escalation-PROPOSAL-[timestamp].md

Actions:
- [ ] Approve → move convention to hippocampus/conventions.md
- [ ] Reject → delete proposal, keep lessons as individual records
- [ ] Modify → edit proposal and re-submit
```

**Step 4e: Do NOT Auto-Update Hippocampus**
- Never write to `hippocampus/conventions.md` automatically
- Always wait for explicit developer approval
- Escalation proposals sit in `lessons/inbox/` until reviewed
- The consolidation cycle (`/brain-consolidate`) will surface pending escalations

### Step 5: Update brain.db

Insert new lesson:
```sql
INSERT INTO lessons (id, file_path, domain, severity, occurrence_count)
VALUES ('lesson-XXXXX', 'lessons/lesson-XXXXX.md', 'backend', 'critical', 1)
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
4. Escalation triggered!
5. Propose adding to hippocampus/conventions.md:

   New rule:
   "Every new query must pass tenant isolation checklist:
    - [ ] BeginTenantTx used
    - [ ] current_tenant_id() in WHERE
    - [ ] RLS policy active
    - [ ] Test with cross-tenant data"

6. Developer reviews and approves
7. Write to hippocampus (immutable layer)
8. All 3 lessons link to the new convention
```

## Example Lessons

### Lesson A: Tenant Safety (Correction)

```markdown
---
id: lesson-0037
title: Query without tenant filter leaks data
region: lessons
tags: [tenant-isolation, adapter, bug]
links:
  - sinapses/tenant-isolation-flow
  - cortex/database/index
severity: critical
occurrence_count: 1
escalated: false
created_at: 2026-03-24T15:30:00Z
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
region: lessons
tags: [testing, process]
severity: medium
occurrence_count: 2
escalated: false
created_at: 2026-03-24T16:00:00Z
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
| Same lesson exists | Increment occurrence_count, don't create duplicate |
| Escalation triggered | Create escalation-proposal.md, halt until approved |
| Related sinapses outdated | Mark for update in working-memory/sinapse-updates.md |
| No clear solution found | Mark severity=critical, flag for team discussion |

---

**Created:** 2026-03-24 | **Phase:** 2 | **Agent Type:** Learner
