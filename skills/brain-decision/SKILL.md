---
name: brain-decision
description: Intelligent task router — classifies complexity, selects model (Codex-first), triggers plan mode, dispatches to brain-task
---

# brain-decision Skill — Intelligent Task Router

**Purpose:** Entry point for all brain-task work. Classifies task complexity, selects optimal model (Codex-first strategy), decides plan mode, and dispatches to implementation.

**Token Budget:** 4k in / 1k out (routing only, no heavy computation)

**Trigger:** `/brain-task [description]` or `/brain-decision [description]`

---

## Workflow

### Step 1: Classify Task

Parse the task description to extract:

```
Domain: (frontend | backend | database | infra | analytics | cross-domain)
Risk Level: (low | medium | high | critical)
Task Type: (feature | bugfix | refactor | debugging | architectural | unknown_pattern)
```

**Examples:**

```
Input: "Add product filter to the products page"
Output:
  Domain: frontend
  Risk: low (existing pattern)
  Type: feature

Input: "Why are tenant queries leaking data across tenants? Tests passing but CI is red"
Output:
  Domain: backend
  Risk: critical (security)
  Type: debugging

Input: "Implement multi-tenant isolation in analytics read models"
Output:
  Domain: cross-domain (backend, analytics, database)
  Risk: high (affects all analytics)
  Type: refactor
```

---

### Step 2: Score Complexity (0-100)

Calculate a complexity score that determines which model to use:

```python
def score_complexity(task_classification) -> int:

  score = 15  # baseline

  # Domain complexity
  if task_classification.domain == "cross-domain":
    score += 30
  elif task_classification.domain == "backend":
    score += 10
  else:
    score += 0

  # Risk escalation
  if task_classification.risk == "critical":
    score += 35
  elif task_classification.risk == "high":
    score += 20
  elif task_classification.risk == "medium":
    score += 5

  # Task type
  if task_classification.type == "debugging":
    score += 15
  elif task_classification.type == "architectural":
    score += 20
  elif task_classification.type == "unknown_pattern":
    score += 10

  return min(score, 100)
```

**Scoring Examples:**

- "Add filter button" → Domain: frontend (0) + Risk: low (0) + Type: feature (0) + base (15) = **15**
- "Fix tenant data leak" → Domain: backend (10) + Risk: critical (35) + Type: debugging (15) + base (15) = **75**
- "Implement multi-tenant analytics" → Domain: cross-domain (30) + Risk: high (20) + Type: refactor (0) + base (15) = **65**

---

### Step 3: Select Model (Codex-First Strategy)

Route based on complexity score and task type:

```
Complexity | Type | Model | When | Token Budget | Use Case
-----------|------|-------|------|--------------|----------
0-20 | any | Haiku | Trivial, simple fixes | 8-15k | "Fix typo", "Change color"
20-40 | feature/refactor | Codex | Standard implementation | 60-100k | "Add new module", "Implement feature"
40-60 | feature/refactor | Codex | Complex feature, multi-file | 100-150k | "Refactor auth", "Add analytics"
60-75 | debugging | Opus | Code failing, unfamiliar error | 120-150k | "Stuck on bug", "Pattern unknown"
75+ | architectural | Codex (+ plan) | Major system decision | 150-200k | "Should we...", "New architecture"
75+ | critical bug | Opus (+ plan) | Critical security/data issue | 150-200k | "Data leak", "Integrity error"
```

**Decision Tree:**

```
Task complexity score calculated

  IF score < 20:
    → Route to: Haiku
    → Quick fix, no planning
    → Execute immediately

  ELSE IF score 20-75 AND type != "debugging" AND type != "critical":
    → Route to: Codex (PRIMARY)
    → Check plan mode trigger
    → If plan needed: EnterPlanMode
    → Dispatch to brain-task [codex]

  ELSE IF score 40-75 AND type == "debugging":
    → Route to: Opus (DEBUGGING)
    → Do NOT use Codex for stuck problems
    → Opus better at root cause analysis
    → Check plan mode trigger
    → Dispatch to brain-task [opus]

  ELSE IF score >= 75:
    → Route to: Codex + Plan Mode
    → ALWAYS enter plan mode for high-complexity
    → Requires developer approval
    → Dispatch to brain-task [codex] with plan
```

---

### Step 4: Check Auto-Plan Trigger

Plan mode activates automatically if ANY condition is true:

```
Trigger Plan Mode If:

✅ Complexity score >= 50
✅ Type == "architectural" or "critical"
✅ Risk level == "critical"
✅ Task involves security, data migration, or breaking changes
✅ User passes --plan flag
```

**If plan mode triggered:**
```
1. Announce: "🔵 PLAN MODE: [task description]"
2. Load sinapses from brain.db (Tier 1 + 2)
3. Explore relevant files
4. Design architecture + assess risks
5. Present plan to developer
6. ON APPROVAL: ExitPlanMode → Step 5
7. ON REJECTION: Preserve plan, end session
```

**If no plan mode:**
```
→ Skip planning, go directly to Step 5 (dispatch)
```

---

### Step 5: Dispatch to Implementation

Generate context and dispatch to selected model:

**For Codex (80% of tasks):**

```
1. Generate context .md file: working-memory/codex-context.md
   - Task description
   - Relevant sinapses (from brain-map, max 10)
   - Acceptance criteria
   - Example code patterns from codebase
   - "Do NOT" list (common mistakes for this domain)

2. Invoke brain-task [codex] with:
   - --context working-memory/codex-context.md
   - --task "[description]"
   - --model "codex"

3. brain-task Step 1: brain-map (load context)
4. brain-task Step 2: implement (codex executes)
5. brain-task Step 3: brain-document (propose sinapses)
6. brain-task Step 4: auto-consolidate (every 5 tasks)
```

**For Opus (debugging only):**

```
1. Generate debugging context: working-memory/opus-debug-context.md
   - Error message (full stack trace)
   - What was attempted
   - Related sinapses (debugging patterns)
   - Similar issues from lessons/ (if any)

2. Invoke brain-task [opus]:
   - --debug
   - --context working-memory/opus-debug-context.md
   - --task "[description]"

3. Opus analyzes root cause, proposes fix, executes
```

**For Haiku:**

```
1. Simple dispatch: brain-task [haiku] --task "[description]"
2. No context file needed (trivial tasks)
3. Execute immediately
```

---

### Step 6: Context File Format (for Codex MCP)

When dispatching to Codex, create `working-memory/codex-context.md`:

```markdown
---
task_id: [uuid]
complexity_score: [0-100]
model: codex
created_at: [ISO8601]
---

# Task

[Task description from user]

## Acceptance Criteria

- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]
- [ ] [Tests passing]
- [ ] [No linting errors]

## Context: Relevant Sinapses

### Architecture Patterns
- [[sinapse-id]] Title: [how to use this pattern]
- [[sinapse-id]] Title: [another pattern]

### Common Mistakes (DO NOT DO)
- ❌ [Mistake pattern 1] → Use [correct pattern] instead
- ❌ [Mistake pattern 2] → See [sinapse-id] for example

## Code Examples from Codebase

### Pattern 1: [Pattern Name]
\`\`\`go
// From apps/server_core/internal/modules/[module]/adapters/[file].go
// CORRECT: This is how we do X
[code snippet]
\`\`\`

### Pattern 2: [Pattern Name]
\`\`\`typescript
// From apps/web/src/[component].tsx
// CORRECT: This is how we do Y
[code snippet]
\`\`\`

## Previous Similar Work

If this task is similar to a completed lesson:
- See: lessons/lesson-0042.md — [same pattern, different domain]

## Brain Health Status

- Current brain region: [backend | frontend | database | analytics]
- Sinapses in this region: [N]
- Average weight: [0.XX]
- Staleness: [healthy | stale | very stale]
- Related escalations: [escalation-XXXXX.md if any]

---
```

---

### Step 7: Output & Handoff

After routing decision is made, output summary:

```
🧠 brain-decision: Routing task

Task: [user description]
Classification: [domain] | [risk] | [type]
Complexity Score: [0-100] [visualization: ░░░░░░░░░░]
Selected Model: [Haiku | Codex | Opus]

Plan Mode: [ACTIVE | SKIPPED]
├─ Triggered by: [reason if active]
├─ Developer approval: [awaiting | approved | rejected]
└─ Status: [planning | approved | executing]

Dispatching to brain-task...
```

Then hand off to `brain-task` with context file + model selection.

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Use Opus for standard features | Wastes tokens (3x Codex cost) | Use Codex for 80% of work, save Opus for debugging |
| No context file for Codex | Codex works blind, lower quality | Always generate codex-context.md with sinapses + examples |
| Plan mode for trivial tasks | Overengineering, slows down | Only plan if score >= 50 or critical |
| Skip plan mode for debugging | Can't assess root cause properly | Always plan for critical bugs (Opus) |
| Mix sinapses with T1 contracts | Conflicting context, confusion | Keep brain-task and $ms workflows separate |

---

## Integration with MetalShopping Workflow

**Parallel Execution (Recommended):**

```
Developer task: "Add product margin calculation to analytics"

Option A: Use $ms (T1-T7 pipeline)
  $ms "Add product margin..."
    → T1: Event contract
    → T2: Backend event handler
    → T3: Analytics worker (Python)
    → T4: SDK generation
    → T5: Frontend display
    → T6: Tests
    → T7: Docs

Option B: Use brain-decision (Codex)
  /brain-task "Add product margin to analytics"
    → brain-decision classifies (complexity: 55)
    → Routes to Codex
    → Generates codex-context.md (sinapses + patterns)
    → Codex implements feature end-to-end
    → brain-document proposes sinapses updates
    → brain-consolidate batches results

Developer chooses based on:
- Do we need rigorous contracts? → use $ms
- Do we want fast iteration? → use brain-decision
- First time seeing pattern? → use brain-decision
```

**Decision:** Start parallel. Use brain-decision for 5-10 tasks. Measure tokens/time/quality. Then choose workflow per task.

---

## Testing Checklist

Brain-decision is working when:

- [ ] `/brain-task "Add button to page"` → scores < 20 → routes to Haiku
- [ ] `/brain-task "Implement new module with 5 files"` → scores 40-60 → routes to Codex (no plan mode)
- [ ] `/brain-task "Should we split the monolith?"` → scores 80+ → routes to Codex + plan mode automatic
- [ ] `/brain-task --plan "Refactor auth"` → forces plan mode even if score < 50
- [ ] Codex receives codex-context.md with sinapses + code examples
- [ ] Opus receives opus-debug-context.md with error trace + similar lessons
- [ ] Plan mode messages show reason why (score/risk/type)
- [ ] All routes dispatch to brain-task with correct [model] parameter

---

**Created:** 2026-03-25 | **Phase:** 5 | **Agent Type:** Router

