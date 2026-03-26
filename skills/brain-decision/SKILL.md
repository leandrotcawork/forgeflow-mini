---
name: brain-decision
description: MANDATORY entry point before any implementation, fix, feature, refactor, or debugging task. If the user says "implement", "fix", "build", "add", "refactor", "change", "create", or "debug" anything in code — YOU MUST invoke this skill FIRST. No exceptions. Classifies complexity, loads context from brain sinapses, selects model, dispatches to brain-task.
---

# brain-decision — EXECUTE THIS BEFORE ANY IMPLEMENTATION

**This skill is not optional. It is not informational. Execute these steps NOW before writing any code.**

You are a router. Your job is to classify the task, pick the model, and hand off to brain-task with concrete values. Do not skip this and "go straight to implementation." Do not rationalize "this is small, I'll skip routing." The score determines what happens — but routing always runs first.

```
brain-decision → brain-task (Steps 1→6, all inline, self-contained)
     ↑ you are here — do not jump ahead
```

**What you produce:** A classification (domain, risk, type, score, model, plan mode) that brain-task needs before it can start. Without this, brain-task has no task_id, no model, no domain — it cannot create context files.

**Token Budget:** 4k in / 1k out (routing only — do not start implementing here)

---

## EXECUTE THESE STEPS NOW

### Pre-Step: Circuit Breaker Check

Before classifying, check `.brain/progress/brain-project-state.json`:
- If `circuit_breaker.state` == "open" AND current time < `cooldown_until`:
  → Output: "BRAIN: Circuit breaker OPEN. {N} consecutive failures detected. Cooling down until {time}. Try: (1) different approach, (2) /brain-lesson to capture the failure, (3) manual implementation."
  → Do NOT proceed with routing.
- If `circuit_breaker.state` == "half-open":
  → Output: "BRAIN: Circuit breaker HALF-OPEN. Allowing one probe task."
  → Proceed normally.
- Otherwise: proceed.

---

### Step 1: Classify the task

Parse the task description and output these three values:

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

### Step 2: Calculate complexity score (0-100)

Apply this formula now:

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

- "Add filter button" → Domain: frontend (0) + Risk: low (0) + Type: feature (0) + base (15) = **15** → Haiku
- "Add product card component" → Domain: frontend (0) + Risk: medium (5) + Type: feature (0) + base (15) = **20** → Sonnet
- "Implement new pricing adapter" → Domain: backend (10) + Risk: medium (5) + Type: feature (0) + base (15) = **30** → Sonnet
- "Fix tenant data leak" → Domain: backend (10) + Risk: critical (35) + Type: debugging (15) + base (15) = **75** → Opus + Plan
- "Implement multi-tenant analytics" → Domain: cross-domain (30) + Risk: high (20) + Type: refactor (0) + base (15) = **65** → Codex

---

### Step 3: Select model

Use the score from Step 2 to pick the model:

```
Complexity | Type | Model | When | Token Budget | Use Case
-----------|------|-------|------|--------------|----------
any | debugging | Opus | Any debugging task | 120-200k | "Bug", "Stuck", "Why is this failing"
any | debugging + critical risk | Opus (+ plan) | Critical debugging or security | 150-200k | "Data leak", "Integrity error"
0-19 | non-debugging | Haiku | Trivial, simple fixes | 8-15k | "Fix typo", "Change color"
20-39 | non-debugging | Sonnet | Standard single-domain implementation | 30-60k | "Add filter", "New component"
40-74 | non-debugging | Codex | Complex feature, multi-file | 100-150k | "Refactor auth", "Add analytics"
75+ | non-debugging | Codex (+ plan) | Major system decision | 150-200k | "Should we...", "New architecture"
```

> **Note:** Haiku, Sonnet, and Opus are Claude API models dispatched via the `Agent()` tool. **Codex** is the Codex CLI tool dispatched via MCP -- it is not a Claude API model. brain-task Path C invokes Codex via the `codex` or `codex-cli` MCP tool.

**Decision Tree:**

```
Task complexity score calculated

  FIRST: Check debugging (takes priority over all score-based routing)

  IF type == "debugging" AND (score >= 75 OR risk == "critical"):
    → Route to: Opus + Plan Mode
    → ALWAYS enter plan mode for critical debugging
    → Dispatch to brain-task [opus] with plan

  ELSE IF type == "debugging":
    → Route to: Opus
    → ALL debugging goes to Opus regardless of score
    → Opus is better at root cause analysis than Sonnet/Codex
    → Check plan mode trigger (score >= 50)
    → Dispatch to brain-task [opus]

  THEN: Score-based routing for non-debugging tasks

  ELSE IF score < 20:
    → Route to: Haiku
    → Quick fix, no planning
    → Execute immediately

  ELSE IF score < 40:
    → Route to: Sonnet
    → Standard single-domain task
    → Fast, capable, token-efficient
    → Dispatch to brain-task [sonnet]

  ELSE IF score < 75 AND risk != "critical":
    → Route to: Codex
    → Complex feature or multi-file refactor
    → Check plan mode trigger
    → If plan needed: EnterPlanMode
    → Dispatch to brain-task [codex]

  ELSE IF score >= 75 OR risk == "critical":
    → Route to: Codex + Plan Mode
    → ALWAYS enter plan mode for high-complexity
    → Requires developer approval
    → Dispatch to brain-task [codex] with plan
```

---

### Step 4: Check if plan mode should activate

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
2. Invoke /brain-plan to generate .brain/working-memory/implementation-plan-{task_id}.md
   brain-plan loads sinapses, explores files, designs architecture, assesses risks.
3. Present plan to developer
4. ON APPROVAL: ExitPlanMode → Step 5 (dispatch with --plan-mode flag)
5. ON REJECTION: Preserve plan, end session
```

This ensures brain-task always receives a plan file when `plan_mode = true`.

**If no plan mode:**
```
→ Skip planning, go directly to Step 5 (dispatch)
```

---

### Step 5: Hand off to brain-task — DO THIS, DO NOT IMPLEMENT YOURSELF

You are a router. Your job ends here. Invoke `/brain-task` with the classification from Steps 1-4. Do NOT start implementing the feature yourself. brain-task owns implementation.

Dispatch to brain-task with the classification values. brain-decision does NOT create context files — brain-task owns that.

**Dispatch format by model:**

```
Haiku:   /brain-task --lightweight --task "[description]" --task-id "[id]" --domain "[domain]" --score [N]
Sonnet:  /brain-task --sonnet --task "[description]" --task-id "[id]" --domain "[domain]" --score [N]
Codex:   /brain-task --task "[description]" --task-id "[id]" --domain "[domain]" --score [N]
Opus:    /brain-task --debug --task "[description]" --task-id "[id]" --domain "[domain]" --score [N]
+Plan:   Add --plan flag to any of the above
```

**What brain-task will do after dispatch** (not your job — just for reference):
- Step 1: Load context from brain.db → `context-packet-{task_id}.md`
- Step 2: Generate model-specific context file (`sonnet-context`, `codex-context`, or `opus-debug-context`)
- Step 3: Implement using the context file
- Step 3.5: Quality gate via brain-codex-review (Codex path only)
- Steps 4-6: Task-completion record → activity log → brain-document → archival → commit (all inline)

**Escalation Rule:** If Sonnet fails after 2 attempts, brain-task escalates to Codex automatically.

---

### Step 6: Output your routing decision

Output this summary so the developer can see the routing:

```
🧠 brain-decision: Routing task

Task: [user description]
Classification: [domain] | [risk] | [type]
Complexity Score: [0-100] [visualization: ░░░░░░░░░░]
Selected Model: [Haiku | Sonnet | Codex | Opus]

Plan Mode: [ACTIVE | SKIPPED]
├─ Triggered by: [reason if active]
├─ Developer approval: [awaiting | approved | rejected]
└─ Status: [planning | approved | executing]

Dispatching to brain-task...
```

Then invoke `brain-task`. brain-task owns Steps 1-3 (context assembly → execution context → implementation). You do NOT create context files or write code.

### State Persistence

After dispatching, write the classification to `brain-state.json`:

```json
{
  "last_decision": {
    "task_id": "[id]",
    "domain": "[domain]",
    "risk": "[risk]",
    "type": "[type]",
    "score": [N],
    "model": "[model]",
    "plan_mode": true | false,
    "timestamp": "[ISO8601]"
  }
}
```

This enables brain-aside to display pipeline context and brain-task to resume after interruption.

---

## The #1 failure mode

**Skipping brain-decision entirely and going straight to implementation.** The agent reads the task, thinks "I know how to do this", and starts coding. No classification happens, no context files are created, no model is selected, no sinapses are proposed. The entire learning loop breaks.

**If you are about to write code and you haven't output the routing summary above, STOP.** You skipped brain-decision.

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Use Opus for standard features | Wastes tokens (3x cost) | Use Sonnet (20-40) or Codex (40+), save Opus for debugging |
| Use Codex for simple single-domain tasks | Overkill, wastes tokens | Use Sonnet for score 20-40 — fast and capable enough |
| Use Sonnet for complex multi-file work | May produce incomplete implementation | Use Codex for score 40+ — needs full context budget |
| No context file for Codex/Sonnet | Model works blind, lower quality | Always generate context file with sinapses + examples |
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
- [ ] `/brain-task "Add product card component"` → scores 20-40 → routes to Sonnet
- [ ] `/brain-task "Implement new module with 5 files"` → scores 40-60 → routes to Codex (no plan mode)
- [ ] `/brain-task "Should we split the monolith?"` → scores 80+ → routes to Codex + plan mode automatic
- [ ] `/brain-task --plan "Refactor auth"` → forces plan mode even if score < 50
- [ ] Sonnet receives sonnet-context-{task_id}.md with sinapses + 1-2 code examples
- [ ] Codex receives codex-context-{task_id}.md with sinapses + 2-3 code examples
- [ ] Opus receives opus-debug-context-{task_id}.md with error trace + similar lessons
- [ ] Sonnet escalates to Codex after 2 failed attempts
- [ ] Plan mode messages show reason why (score/risk/type)
- [ ] All routes dispatch to brain-task with correct [model] parameter

---

**Created:** 2026-03-25 | **Agent Type:** Router

