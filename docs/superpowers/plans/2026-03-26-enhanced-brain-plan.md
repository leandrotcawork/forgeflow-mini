# Enhanced brain-plan — Cortex-Linked TDD Planning System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade brain-plan from high-level subtask decomposition to a full TDD micro-step planning engine that loads domain sinapses, generates zero-context executable plans with complete code, and supports subagent-driven execution with two-stage reviews.

**Architecture:** Rewrite brain-plan SKILL.md to produce expanded plans with TDD granularity (test -> implement -> verify -> commit per step). Plans link to cortex sinapses as optional context. brain-task gets a new Path F (dispatcher mode) that reads expanded plans and dispatches subagent implementers + reviewers per task. The existing Path E (inline plan execution) remains as fallback.

**Tech Stack:** Markdown (SKILL.md), SQL (brain.db queries for sinapse context), brain-map integration (3-tier context loading)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `skills/brain-plan/SKILL.md` | Rewritten — produces TDD micro-step plans with sinapse links |
| `skills/brain-task/SKILL.md` | Add Path F (dispatcher mode) for subagent-driven plan execution |
| `skills/brain-decision/SKILL.md` | Update plan-mode to offer expanded planning option |
| `.claude-plugin/plugin.json` | Update brain-plan description |

---

### Task 1: Rewrite brain-plan SKILL.md — Phase 1: Header + File Structure Stage

**Files:**
- Modify: `skills/brain-plan/SKILL.md`

- [ ] **Step 1: Read current brain-plan SKILL.md**

Read the full file to understand the current structure and identify what to preserve vs replace.

- [ ] **Step 2: Rewrite the header and trigger section**

Replace the header through the workflow introduction. Keep the frontmatter format. New description emphasizes TDD micro-steps and sinapse integration.

Key changes:
- Purpose: "Convert context packet into a TDD micro-step implementation plan with domain sinapse links"
- Output format: Same path (`.brain/working-memory/implementation-plan-{task_id}.md`) but new internal structure
- Token budget: 15k in / 8k out (increased output for complete code in steps)

- [ ] **Step 3: Add the File Structure Stage**

Before decomposing into tasks, brain-plan must map out which files will be created/modified. This is the decomposition lock-in point (adopted from superpowers writing-plans).

```markdown
### Stage 1: File Structure Design

Before defining tasks, map ALL files that will be created or modified:

1. Read the context-packet (`.brain/working-memory/context-packet-{task_id}.md`)
2. Identify target files from:
   - Task description (user mentioned files)
   - Sinapse patterns (how similar features are structured in this codebase)
   - Convention requirements (from `.brain/hippocampus/conventions.md`)
3. For each file, define:
   - Path (exact)
   - Responsibility (one sentence)
   - Create or Modify
   - Which task will touch it

Output:
| File | Action | Responsibility | Task |
|------|--------|----------------|------|
| src/services/auth.ts | Modify | Add MFA verification step | Task 2 |
| src/services/auth.test.ts | Create | Unit tests for MFA flow | Task 1, 2 |
| ... | ... | ... | ... |

Rules:
- Each file has ONE clear responsibility
- Files that change together live together
- Follow existing codebase patterns (from sinapses)
- Prefer smaller, focused files
```

- [ ] **Step 4: Commit**

```bash
git add skills/brain-plan/SKILL.md
git commit -m "feat(brain-plan): rewrite header + add File Structure Design stage"
```

---

### Task 2: Rewrite brain-plan — Phase 2: TDD Micro-Step Task Decomposition

**Files:**
- Modify: `skills/brain-plan/SKILL.md`

- [ ] **Step 1: Replace the Subtask section with TDD Task structure**

Replace the current per-subtask format (description, files, conventions, acceptance criteria, token estimate, dependencies) with the TDD micro-step format.

Each task follows this structure:
```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

**Related Sinapses (optional context):**
- [[cortex/backend/api-patterns]] — Follow REST naming conventions
- [[cortex/backend/lessons/lesson-0003]] — Always validate tenant_id

- [ ] **Step 1: Write the failing test**

```typescript
describe('MFA verification', () => {
  it('should reject invalid TOTP codes', () => {
    const result = verifyMFA({ userId: '123', code: '000000' });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --grep "MFA verification"` (or project-specific command)
Expected: FAIL with "verifyMFA is not defined"

- [ ] **Step 3: Write minimal implementation**

```typescript
export function verifyMFA(input: { userId: string; code: string }): { valid: boolean } {
  // Minimal: just validate format
  return { valid: input.code.length === 6 && /^\d+$/.test(input.code) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --grep "MFA verification"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/mfa.ts tests/services/mfa.test.ts
git commit -m "feat(auth): add MFA TOTP verification"
```
```

- [ ] **Step 2: Add the "No Placeholders" rule**

Add explicit instruction that brain-plan must NEVER produce:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code)

Every code step MUST show complete code. Every command step MUST show exact command + expected output.

- [ ] **Step 3: Add the Sinapse Linking mechanism**

```markdown
### How to Link Sinapses to Tasks

For each task, query brain.db for relevant sinapses:

```sql
SELECT id, title, region, tags FROM sinapses
WHERE region LIKE '%{domain}%'
  AND (tags LIKE '%{task_keyword_1}%' OR tags LIKE '%{task_keyword_2}%')
ORDER BY weight DESC
LIMIT 3
```

Include matched sinapses as **Related Sinapses** in the task header.
These are OPTIONAL context — the task instructions must be self-contained
without reading sinapses. But a developer or subagent CAN read them
for deeper understanding.

If a sinapse contains a code example matching the task pattern,
EXTRACT the example and include it in the task as "Codebase Pattern":

```markdown
**Codebase Pattern (from [[cortex/backend/api-patterns]]):**
```go
// From: apps/server_core/internal/modules/products/handler.go
func (h *Handler) CreateProduct(ctx context.Context, req *CreateProductRequest) error {
    // Validate → Execute → Emit event → Return
}
```
```

- [ ] **Step 4: Commit**

```bash
git add skills/brain-plan/SKILL.md
git commit -m "feat(brain-plan): TDD micro-step task format + sinapse linking + no placeholders"
```

---

### Task 3: Rewrite brain-plan — Phase 3: Self-Review + Output Format

**Files:**
- Modify: `skills/brain-plan/SKILL.md`

- [ ] **Step 1: Add the Self-Review checklist**

After generating all tasks, brain-plan must run a self-review:

```markdown
### Stage 4: Self-Review (MANDATORY before presenting to developer)

1. **Spec coverage:** For each requirement in the task description, point to the task that implements it. List gaps.
2. **Placeholder scan:** Search for "TBD", "TODO", "add validation", "similar to". Fix inline.
3. **Type consistency:** Do function names, types, and property names match across all tasks? Fix mismatches.
4. **Sinapse conflicts:** Do any task instructions contradict conventions in .brain/hippocampus/conventions.md? Flag conflicts.
5. **Dependency order:** Can tasks execute in the listed order without unmet dependencies?
```

- [ ] **Step 2: Define the complete output file format**

The implementation-plan file must follow this exact structure:

```markdown
---
task_id: {task_id}
domain: {domain}
complexity_score: {score}
plan_type: expanded  # NEW: distinguishes from old format
sinapse_count: {N}
task_count: {N}
estimated_tokens: {N}k
generated_at: {ISO8601}
status: planned
---

# Implementation Plan: {task description}

## Goal
{One sentence}

## Architecture
{2-3 sentences about approach}

## File Structure
| File | Action | Responsibility | Task |
|------|--------|----------------|------|
{table rows}

## Tasks

### Task 1: {name}
{full TDD micro-step format}

### Task 2: {name}
{full TDD micro-step format}

## Implementation Order
1. Task 1 (0 deps) -> {est tokens}
2. Task 2 (depends on 1) -> {est tokens}

## Conflict Check
- {ADR conflicts or "None"}
- {Convention violations or "All respected"}
- {Lesson warnings or "None"}

## Execution Options
- **Subagent-Driven (recommended):** brain-task Path F dispatches fresh subagent per task
- **Inline:** brain-task Path E executes all tasks sequentially in session
```

- [ ] **Step 3: Commit**

```bash
git add skills/brain-plan/SKILL.md
git commit -m "feat(brain-plan): self-review checklist + expanded output format with plan_type field"
```

---

### Task 4: Add Path F (Dispatcher Mode) to brain-task

**Files:**
- Modify: `skills/brain-task/SKILL.md`

- [ ] **Step 1: Read current Path E section**

Read brain-task lines 489-530 to understand the current plan-mode execution.

- [ ] **Step 2: Add Path F after Path E**

```markdown
### Path F: Dispatcher Mode (expanded plan with plan_type: expanded)

When the implementation plan has `plan_type: expanded` in frontmatter, use dispatcher mode instead of inline execution.

**Dispatcher mode:**
1. Read `.brain/working-memory/implementation-plan-{task_id}.md`
2. Verify `plan_type: expanded` in frontmatter
3. Extract all tasks from the plan
4. Create TodoWrite with one entry per task
5. For each task:

   **5a. Dispatch Implementer Subagent:**
   ```
   Agent(model: "{model}", description: "Implement Task {N}: {name}")
   ```
   Prompt includes:
   - Full task text (all steps, code blocks, commands)
   - Related sinapse content (if any, pre-loaded)
   - File paths to create/modify
   - Do NOT make subagent read the plan file — include task text directly

   **5b. On implementer completion, dispatch Spec Reviewer:**
   ```
   Agent(model: "sonnet", description: "Review Task {N}: spec compliance")
   ```
   Reviewer checks:
   - All acceptance criteria met
   - Code matches the plan's code blocks exactly
   - Tests pass
   - No extra changes beyond spec

   **5c. If reviewer finds issues:**
   - Re-dispatch implementer with reviewer feedback
   - Re-dispatch reviewer after fix
   - Max 2 review loops per task

   **5d. Mark task complete in TodoWrite**

6. After all tasks complete:
   - Run full test suite (Step 3.5 verification gate)
   - Proceed to Step 4 (post-task sequence)

**Fallback:** If any subagent dispatch fails (Agent tool unavailable, timeout), fall back to Path E (inline execution) for remaining tasks. Log: "Dispatcher mode unavailable — falling back to inline."

**Model selection for implementers:**
- Tasks touching 1-2 files with clear spec: haiku
- Tasks touching 3+ files or complex logic: sonnet
- Architecture/integration tasks: session model (from brain-decision)
```

- [ ] **Step 3: Update Path E to check plan_type**

Modify Path E's first line to add the plan_type check:

```markdown
### Path E: Plan Mode Inline (score 75+ OR plan_type: standard)

For plans with `plan_type: standard` (or no plan_type field — legacy format), execute inline.
For plans with `plan_type: expanded`, use Path F (Dispatcher Mode) instead.
```

- [ ] **Step 4: Commit**

```bash
git add skills/brain-task/SKILL.md
git commit -m "feat(brain-task): add Path F dispatcher mode for expanded plans"
```

---

### Task 5: Update brain-decision plan-mode dispatch

**Files:**
- Modify: `skills/brain-decision/SKILL.md`

- [ ] **Step 1: Update plan-mode flow to mention expanded plans**

In the plan-mode section (after the brain-plan invocation), add:

```markdown
brain-plan now generates expanded plans (plan_type: expanded) by default.
These plans include TDD micro-steps with complete code and sinapse links.

When dispatching to brain-task with --plan-mode:
- brain-task will detect plan_type in the plan frontmatter
- expanded plans -> Path F (dispatcher mode with subagents)
- standard plans -> Path E (inline execution)

The developer can request standard (non-expanded) plans by passing --quick-plan
to brain-decision. This produces the legacy format without TDD micro-steps.
```

- [ ] **Step 2: Commit**

```bash
git add skills/brain-decision/SKILL.md
git commit -m "feat(brain-decision): document expanded vs standard plan routing"
```

---

### Task 6: Register updated skill description

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Update brain-plan description**

Change the brain-plan entry from:
```json
"description": "Planner — convert context packet to structured implementation plan"
```
to:
```json
"description": "Planner — generate TDD micro-step plans with cortex sinapse links, subagent dispatch support"
```

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat(brain-plan): update plugin description for expanded planning"
```

---

### Task 7: Final verification

- [ ] **Step 1: Verify no broken cross-references**

```bash
grep -rn "plan_type" skills/brain-plan/SKILL.md skills/brain-task/SKILL.md skills/brain-decision/SKILL.md
```
Expected: Consistent references across all 3 files.

- [ ] **Step 2: Verify plan output path unchanged**

```bash
grep -rn "implementation-plan-" skills/ | head -10
```
Expected: All references use `.brain/working-memory/implementation-plan-{task_id}.md`

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(brain-plan): complete enhanced planning system with TDD micro-steps + dispatcher mode"
```
