---
name: brain-document
description: Documenter -- Propose sinapse updates after task completion
---

# brain-document Skill -- Documenter

## Pipeline Position

```
brain-dev -> brain-map -> brain-task (Steps 1-3) -> brain-codex-review (Codex only) -> brain-document -> brain-consolidate
                                                                                          ^ you are here
```

**Purpose:** After a task completes, propose updates to cortex sinapses (never hippocampus) based on what was learned. Propose only -- never write without developer approval.

**Token Budget:** 10k in / 5k out

## Trigger

Called by brain-task at Step 6 (inline or as subagent), or manually via `/brain-document`. This skill is self-contained -- it does NOT depend on any hook to be invoked.

For tasks with score < 40 (Haiku/Sonnet tier), brain-task may dispatch this as a Haiku subagent. For tasks with score >= 40 (Codex tier), it always runs inline to preserve full context for complex proposals.

Preconditions (verified by brain-task before invoking):
- Task implementation is complete (Step 3 done)
- `.brain/working-memory/task-completion-{task_id}.md` exists (Step 4 done)
- Tests passing

## Workflow

### Step 1: Identify Touched Cortex Regions

From the task-completion record (`.brain/working-memory/task-completion-{task_id}.md`) or working tree diff:

```bash
# Option A: Read file list from task-completion artifact (preferred)
# .brain/working-memory/task-completion-{task_id}.md contains "files changed" section

# Option B: Diff working tree (uncommitted changes)
git diff --name-only | grep -E 'apps/|packages/' | extract domain
git diff --cached --name-only | grep -E 'apps/|packages/' | extract domain
```

Example:
```
apps/server_core/internal/modules/orders/adapters/postgres.go
  -> Domain: backend

apps/web/src/pages/Products.tsx
  -> Domain: frontend

migrations/add_product_margin.sql
  -> Domain: database
```

### Step 2: Assess Knowledge Changes

For each touched domain, answer:
- What pattern/technique was used?
- Is this documented in .brain/cortex/?
- Did this reveal a new anti-pattern?
- Should this change best practices?

**Important:** If a new **anti-pattern** is discovered (e.g., "We made this mistake and it broke things"):
- Do NOT document the anti-pattern as a regular sinapse
- Write an episode file to `.brain/working-memory/episode-document-{task_id}.md` with `trigger: anti-pattern`
- brain-consolidate will process the episode and propose a sinapse update with the anti-pattern as a `## Lessons Learned` entry
- Anti-patterns are failures that became knowledge — they belong in the relevant sinapse's lessons section, not as standalone files

### Step 3: Propose Sinapse Updates

Never edit directly. Create `.brain/working-memory/sinapse-updates-{task_id}.md`:

```markdown
# Proposed Sinapse Updates

## .brain/cortex/backend/index.md

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
- Links: add .brain/cortex/database/index.md reference

---

## .brain/cortex/database/index.md

### Proposed Addition
Section: Schema Design for Idempotency

Current: No mention of idempotency in schema context

Proposed: New section explaining UNIQUE constraints + ON CONFLICT
```

### Step 4: Create Review Checklist

Generate `.brain/working-memory/sinapse-review-{task_id}.md`:

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
  -> Update sinapse immediately
  -> Increment weight by +0.02
  -> Record in brain.db

**Option B:** Reject
  -> Discard proposal
  -> Record reason (if helpful feedback)

**Option C:** Modify
  -> Edit proposal
  -> Resubmit
```

**Present each proposal using `AskUserQuestion`:**

```
AskUserQuestion(
  questions: [{
    question: "Sinapse update for {sinapse_path}: {brief diff summary}",
    header: "Update",
    options: [
      { label: "Approve", description: "Apply the proposed changes to this sinapse" },
      { label: "Reject", description: "Discard this update" },
      { label: "Modify", description: "Edit the proposal before applying" }
    ],
    multiSelect: false
  }]
)
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
+- [[.brain/cortex/database/index]] Schema design
+- [[.brain/sinapses/outbox-event-flow]] Event atomicity
+
```

### Step 6: Wait for Approval

Never proceed without developer sign-off.

Proposal remains in `.brain/working-memory/sinapse-updates-{task_id}.md`. Approval and application are handled by `/brain-consolidate` during the next consolidation cycle, or by the developer manually. brain-document is proposal-only -- it never writes to cortex sinapses.

## Example: Full Proposal Cycle

**Task:** Add product margin to analytics

**Files changed:**
- contracts/events/v1/ProductMarginCalculated.yaml (new)
- apps/analytics_worker/handlers/product_margin.py (new)
- .brain/cortex/database/index.md (updated schema)

**Proposed updates:**

1. **.brain/cortex/backend/index.md**
   - Add section: Event Publishing Examples
   - Include ProductMarginCalculated as concrete example

2. **.brain/cortex/frontend/index.md**
   - Add: "Always load + error + empty states"
   - Reference Products surface margin display

3. **.brain/sinapses/analytics-routing.md**
   - Add multi-phase task example: margin calculation end-to-end

4. **No changes to .brain/hippocampus/** (strategic layer, not touched)

**Review checklist:**
- [x] All patterns now in use
- [x] Examples are from actual code
- [x] Links verified (all sinapses exist)
- [x] No conventions contradicted
- [ ] Developer approval awaited

**Developer approves all 3 updates**

-> All 3 sinapses updated atomically
-> Weights +0.02 each
-> brain.db reindexed

---

## Subagent Dispatch Mode

For lightweight documentation tasks (score < 40), brain-task dispatches brain-document as a Haiku subagent:

```
Agent(model: "haiku", description: "Propose sinapse updates after task completion")
```

**What the subagent receives:**
- Task-completion record contents (`.brain/working-memory/task-completion-{task_id}.md`)
- Current sinapses for the touched domain(s), condensed to key sections
- List of files changed and their domains

**What the subagent returns:**
- Sinapse update proposals in unified diff format
- Each proposal includes: section, current text, proposed text, rationale
- Anti-pattern discoveries captured as episode files in working-memory

**When subagent is used (score < 40):**
- Simpler tasks produce straightforward documentation updates
- Haiku is sufficient for pattern extraction and diff generation
- Reduces token cost for routine documentation

**When inline is required (score >= 40):**
- Complex implementations need full context to propose accurate updates
- Cross-domain changes require reading multiple sinapses simultaneously
- Codex-path tasks may produce architectural patterns that need careful documentation

**Fallback:** If subagent dispatch fails, brain-task runs brain-document inline. The output format (unified diffs + review checklist) is identical in both modes.

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|-------------|----------|-----|
| Rewriting entire sinapse | Changes too drastic, hard to review | Use diff format (add section, not rewrite) |
| Modifying hippocampus | Strategy/decisions only approved at planning | Document only in .brain/cortex/ or .brain/sinapses/ |
| Adding subjective opinions | "This is the best way" | Stick to observed patterns in code |
| Linking to non-existent sinapses | Creates broken references | Verify all [[links]] exist first |
| Changing weights without reason | Undermines weight-based ranking | Only adjust if pattern usage changes |
| Documenting anti-patterns as standalone sinapses | Anti-patterns are failure knowledge | Write episode file, brain-consolidate adds to relevant sinapse |
| Writing lesson files directly | Lessons are now episode-based | Write episode file to working-memory, brain-consolidate processes it |
| Ignoring anti-patterns | Loses failure knowledge | Capture as episode, brain-consolidate merges into sinapse ## Lessons Learned |

---

**Created:** 2026-03-24 | **Agent Type:** Documenter
