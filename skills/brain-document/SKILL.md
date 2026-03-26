---
name: brain-document
description: Documenter — Propose sinapse updates after task completion
---

# brain-document Skill — Documenter

## Pipeline Position

```
brain-decision → brain-map → brain-task → [brain-codex-review] → [TaskCompleted hook] → brain-document → brain-consolidate
                                                                                    ↑ you are here
```

**Purpose:** After a task completes, propose updates to cortex sinapses (never hippocampus) based on what was learned. Propose only — never write without developer approval.

**Token Budget:** 10k in / 5k out

## Trigger

Called by the **TaskCompleted hook** (settings.json) at Step 3 of the post-task sequence. Not user-facing — invoked automatically after each task completes.

Preconditions (guaranteed by hook):
- Task implementation is complete
- Code has been committed
- Tests passing

## Workflow

### Step 1: Identify Touched Cortex Regions

From the task-completion record or working tree diff (brain-document runs BEFORE commit):

```bash
# Option A: Read file list from task-completion artifact (preferred)
# working-memory/task-completion-{task_id}.md contains "files changed" section

# Option B: Diff working tree (uncommitted changes)
git diff --name-only | grep -E 'apps/|packages/' | extract domain
git diff --cached --name-only | grep -E 'apps/|packages/' | extract domain
```

Example:
```
apps/server_core/internal/modules/orders/adapters/postgres.go
  → Domain: backend

apps/web/src/pages/Products.tsx
  → Domain: frontend

migrations/add_product_margin.sql
  → Domain: database
```

### Step 2: Assess Knowledge Changes

For each touched domain, answer:
- What pattern/technique was used?
- Is this documented in cortex/?
- Did this reveal a new anti-pattern?
- Should this change best practices?

**Important:** If a new **anti-pattern** is discovered (e.g., "We made this mistake and it broke things"):
- Do NOT document the anti-pattern in cortex sinapses
- Route to `/brain-lesson` instead
- Lessons live in `cortex/<domain>/lessons/` or `lessons/cross-domain/` (distributed architecture)
- Anti-patterns are failures that became knowledge, not architectural patterns
- brain-lesson will handle escalation if 3+ same anti-pattern lessons exist → propose convention

### Step 3: Propose Sinapse Updates

Never edit directly. Create `working-memory/sinapse-updates-{task_id}.md`:

```markdown
# Proposed Sinapse Updates

## cortex/backend/index.md

### Context
Task: "Fix product duplicate key error"
Files changed: orders/adapters/postgres.go, orders/domain/models.go

### Proposed Addition
Section: Idempotent Insert Patterns

Current text: (section doesn't exist)

Proposed text:
---
## Idempotent Insert Patterns

When inserting records that may be retried, use ON CONFLICT:

```go
INSERT INTO products (id, name, price)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  updated_at = NOW()
WHERE product.tenant_id = current_tenant_id()
```

This ensures the operation is safe to retry. Especially critical
for transactional outbox event handlers (see [[sinapse/outbox-event-flow]]).
---

### Rationale
- Orders module now uses this pattern
- Reduces duplicate key errors on retry
- Aligns with [[lesson-0004]] worker safety requirement
- Example in code: orders/adapters/postgres.go line 87

### Impact
- Sinapse will be marked "stale" until developer approves
- Weight: remains unchanged (pattern already existed, just documented)
- Links: add cortex/database/index.md reference

---

## cortex/database/index.md

### Proposed Addition
Section: Schema Design for Idempotency

Current: No mention of idempotency in schema context

Proposed: New section explaining UNIQUE constraints + ON CONFLICT
```

### Step 4: Create Review Checklist

Generate `working-memory/sinapse-review-{task_id}.md`:

```markdown
# Sinapse Update Review Checklist

## For Each Proposed Update:

- [ ] Pattern is now in use in actual code
- [ ] Documentation improves accuracy without being prescriptive
- [ ] Links are correct (sinapses actually exist)
- [ ] Weight change is justified (if any)
- [ ] Severity tags are appropriate
- [ ] Example code is copy-pasted from actual implementation
- [ ] No conventions are contradicted

## Developer Decision

For each proposed update:

**Option A:** Approve
  → Update sinapse immediately
  → Increment weight by +0.02
  → Record in brain.db

**Option B:** Reject
  → Discard proposal
  → Record reason (if helpful feedback)

**Option C:** Modify
  → Edit proposal
  → Resubmit
```

### Step 5: Format as Diffs (Not Full Rewrites)

Always show changes as unified diff format:

```diff
--- a/.brain/cortex/backend/index.md
+++ b/.brain/cortex/backend/index.md
@@ -45,6 +45,28 @@
 ## Event Publishing (Outbox Pattern)

 All state changes that trigger events must use the transactional outbox...

+## Idempotent Insert Patterns
+
+When inserting records that may be retried, use ON CONFLICT:
+
+\`\`\`go
+INSERT INTO products (id, name, price)
+VALUES ($1, $2, $3)
+ON CONFLICT (id) DO UPDATE SET
+  name = EXCLUDED.name,
+  price = EXCLUDED.price,
+  updated_at = NOW()
+\`\`\`
+
+This ensures the operation is safe to retry, especially critical
+for transactional outbox event handlers.
+
+**Related:**
+- [[lesson-0004]] Worker safety
+- [[cortex/database/index]] Schema design
+- [[sinapses/outbox-event-flow]] Event atomicity
+
```

### Step 6: Wait for Approval

Never proceed without developer sign-off.

Proposal remains in `working-memory/sinapse-updates-{task_id}.md`. Approval and application are handled by `/brain-consolidate` during the next consolidation cycle, or by the developer manually. brain-document is proposal-only — it never writes to cortex sinapses.

## Example: Full Proposal Cycle

**Task:** Add product margin to analytics

**Files changed:**
- contracts/events/v1/ProductMarginCalculated.yaml (new)
- apps/analytics_worker/handlers/product_margin.py (new)
- .brain/cortex/database/index.md (updated schema)

**Proposed updates:**

1. **cortex/backend/index.md**
   - Add section: Event Publishing Examples
   - Include ProductMarginCalculated as concrete example

2. **cortex/frontend/index.md**
   - Add: "Always load + error + empty states"
   - Reference Products surface margin display

3. **sinapses/analytics-routing.md**
   - Add multi-phase task example: margin calculation end-to-end

4. **No changes to hippocampus/** (strategic layer, not touched)

**Review checklist:**
- [x] All patterns now in use
- [x] Examples are from actual code
- [x] Links verified (all sinapses exist)
- [x] No conventions contradicted
- [ ] Developer approval awaited

**Developer approves all 3 updates**

→ All 3 sinapses updated atomically
→ Weights +0.02 each
→ brain.db reindexed

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|-------------|----------|-----|
| Rewriting entire sinapse | Changes too drastic, hard to review | Use diff format (add section, not rewrite) |
| Modifying hippocampus | Strategy/decisions only approved at planning | Document only in cortex/ or sinapses/ |
| Adding subjective opinions | "This is the best way" | Stick to observed patterns in code |
| Linking to non-existent sinapses | Creates broken references | Verify all [[links]] exist first |
| Changing weights without reason | Undermines weight-based ranking | Only adjust if pattern usage changes |
| Documenting anti-patterns in cortex sinapses | Anti-patterns are failures, not patterns | Use `/brain-lesson` for anti-pattern capture |
| Editing cortex/<domain>/lessons/ directly | Lessons have their own lifecycle | Use `/brain-lesson` skill workflow |
| Mixing patterns with failure stories | Confuses architectural advice with debugging notes | Keep sinapses (patterns) and lessons (failures) separate |

---

**Created:** 2026-03-24 | **Agent Type:** Documenter
