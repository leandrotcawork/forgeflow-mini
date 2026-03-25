---
title: Phase 5 — Multi-Model Intelligence & Skill Integration
date: 2026-03-25
status: Design (ready for implementation)
---

# Phase 5: Multi-Model Intelligence & Skill Integration

## Executive Summary

Phase 5 builds the **decision layer** — smart routing that decides:
1. **Which Claude model to use** (Haiku / Sonnet / Opus / Codex) based on task complexity
2. **When plan mode activates** automatically vs manually
3. **How private skills integrate** with generic ForgeFlow

This is NOT a single new skill. This is **system-level architecture** that orchestrates all existing skills through intelligent routing.

---

## Part 1: Model Selection Decision Tree

### Decision Logic: Task Complexity Score

Every task gets a **complexity score (0-100)** computed from:

```
Complexity(task) =
  (Domain Count × 15) +           // Single vs multi-domain
  (Risk Level × 20) +              // Architectural risk
  (Required Context × 15) +        // How much sinapses needed
  (External Research × 10) +       // Web search / external tools
  (Iterative Refinement × 10) +   // Multiple passes expected
  (Novel Pattern × 15) +           // Never-before-seen pattern
  (Token Budget Tight × 5)         // Constrained tokens
```

### Model Selection Matrix

| Complexity | Model | When | Cost | Token Budget | Use Case |
|------------|-------|------|------|--------------|----------|
| 0-20 | **Haiku** | Trivial tasks, code fixes, simple refactors | 🟢 Low | 8k-15k | "Add a button", "Fix typo", "Small utility" |
| 20-50 | **Sonnet** | Standard implementation, single domain, familiar patterns | 🟡 Medium | 60-80k | "Build new module", "Add API endpoint", "Implement feature" |
| 50-75 | **Opus** | Complex multi-domain work, unfamiliar patterns, architectural decisions | 🔴 High | 120-150k | "Refactor auth system", "New microservice", "Integration work" |
| 75+ | **Codex + Consensus** | Strategic decisions, novel architecture, company-wide impact | 🔴🔴 Very High | 200k+ | "New platform direction", "Tech stack change", "Org structure shift" |

### Complexity Scoring Examples

**Example 1: "Add product filter to frontend"**
- Domain Count: 1 (frontend only) → 15
- Risk: Low (known pattern) → 0
- Context: Existing sinapses available → 5
- External Research: None → 0
- Iterative: Single pass → 0
- Novel: No → 0
- Token Tight: No → 0
- **Score: 20 → HAIKU**

**Example 2: "Implement multi-tenant isolation for analytics"**
- Domain Count: 3 (frontend, backend, database) → 45
- Risk: High (affects all tenants) → 20
- Context: Must load all sinapses in analytics + security + DB layers → 15
- External Research: Need benchmarks from competitors → 10
- Iterative: Multiple rounds of testing → 10
- Novel: New pattern for this project → 15
- Token Tight: Yes, need efficiency → 5
- **Score: 120 → OPUS**

**Example 3: "Should we migrate from REST to gRPC for internal services?"**
- Domain Count: 4 (backend, frontend, infra, contracts) → 60
- Risk: Critical (affects service mesh) → 20
- Context: Deep history needed (decisions_log, ADRs) → 15
- External Research: Yes (Google, Stripe patterns) → 10
- Iterative: Very high (multiple alternatives, feedback) → 10
- Novel: Yes (new architecture) → 15
- Token Tight: Very (need to be thoughtful) → 5
- **Score: 135 → CODEX + CONSENSUS GATE**

---

## Part 2: Plan Mode Auto-Triggering Rules

Plan mode activates **automatically** in these conditions:

### Automatic Activation (No User Action Needed)

```
IF complexity_score >= 50 AND NOT already_in_plan_mode THEN
  → EnterPlanMode (automatic)
  → Output: "High complexity detected. Entering plan mode for architecture review."

IF task_classification == "architectural" THEN
  → EnterPlanMode (automatic)
  → Invoke brain-mckinsey for external research

IF risk_flags.contains("breaking_change" OR "data_migration" OR "security") THEN
  → EnterPlanMode (automatic)
  → Required: developer approval before implementation

IF sinapses_needed > 40k tokens THEN
  → EnterPlanMode (automatic, memory intensive)
  → Prepare working-memory/context-packet.md
  → Use Tier 3 context loading (selective sinapses only)
```

### Manual Activation (Developer Can Request Anytime)

```
User: "/brain-task --plan [description]"
  → Force EnterPlanMode regardless of complexity
  → Useful for uncertain tasks or learning purposes
```

### Plan Mode Workflow

```
1. EnterPlanMode activated (auto or manual)
2. Announce: "🔵 Plan Mode: Designing [task description]"
3. Load sinapses (Tier 1 + Tier 2 based on classification)
4. Design phase:
   - Context exploration (read key files)
   - Architecture decision
   - Risk assessment
   - Token budgeting
5. Present plan to developer for approval
6. On approval: ExitPlanMode → dispatch to implementation
```

**Plan mode exit options:**
- ✅ **Approve**: Proceed with implementation using the designed plan
- 📝 **Modify**: Return to design phase with feedback
- ❌ **Reject**: Cancel task, preserve plan in working-memory for later

---

## Part 3: Skill Integration Architecture

### How ForgeFlow Fits Into MetalShopping Workflow

MetalShopping has two parallel workflows that must coexist:

#### **Workflow A: T1-T7 Pipeline** (Existing MetalShopping)
```
$ms invoke
  ├─ T1: Contract (OpenAPI / Event / Governance)
  ├─ T2: Backend (Go module implementation)
  ├─ T3: Worker (Python compute)
  ├─ T4: SDK (Generate types from contracts)
  ├─ T5: Frontend (React component)
  ├─ T6: Tests (Vitest + Go tests)
  └─ T7: Docs (PROGRESS.md + PROJECT_SOT.md)
```
**Use when:** Following established domain patterns, sequential pipeline, all stages needed

#### **Workflow B: Brain-Driven Workflow** (ForgeFlow Mini)
```
/brain-task invoke
  ├─ brain-map (context assembly)
  ├─ [auto-plan? complexity check]
  ├─ implement (any model)
  ├─ brain-document (propose updates)
  └─ [auto-consolidate? every 5 tasks]
```
**Use when:** Unknown complexity, learning mode, multi-domain exploration, need intelligent context

### Integration Pattern: Best Practices

#### **Option A: Parallel (Recommended for Learning Phase)**

Use both workflows independently:

```
Session 1: /brain-task "Add product filter to frontend"
  → Haiku solo (simple feature)
  → brain-document proposes frontend sinapses updates
  → 30 minutes, 15k tokens

Session 2: $ms "Add analytics export endpoint"
  → T1 OpenAPI contract (existing workflow)
  → T2-T7 standard pipeline
  → 2 hours, 80k tokens

Session 3: /brain-task "Should we add Redis caching?"
  → Complexity: 65 → Opus + plan mode
  → brain-mckinsey research + scoring
  → developer approves plan
  → Opus implements
  → brain-document + consolidate
  → 1.5 hours, 120k tokens
```

**Advantages:**
- Learn ForgeFlow without disrupting $ms
- Measure ROI independently (cost, speed, quality)
- Easy to revert if brain system doesn't click
- Both workflows can coexist indefinitely

**Disadvantages:**
- Context duplication (both systems learn separately)
- No synergy between T1-T7 contracts and brain sinapses
- Manual routing decision every task

---

#### **Option B: Unified (After 2-3 Weeks ROI Validation)**

Route ALL tasks through intelligent dispatcher:

```
Developer: "Add product filter to frontend"

  Dispatcher checks:
    - Complexity: 20 → use Haiku
    - Domain: 1 → skip plan mode
    - Risk: low → no McKinsey
    - Familiar pattern: yes → use existing sinapses

  Routes to: brain-task (Haiku)
  Runs 2-stage pipeline:
    1. brain-map (context assembly)
    2. implement + document
  Result: feature + brain updated

Developer: "Add analytics export to API"

  Dispatcher checks:
    - Complexity: 60 → use Opus
    - Domains: 3 (API, analytics, contracts)
    - Risk: medium
    - Contracts needed: yes

  Routes to: hybrid pipeline
    1. $ms T1 (contract generation)
    2. brain-task for complex logic (Opus)
    3. $ms T4-T7 (standard pipeline)
  Result: contracts + implementation + docs
```

**Advantages:**
- Unified context (brain knows about contracts, tests, docs)
- True synergy (McKinsey findings inform T1 contracts)
- Optimal model selection per task
- One mental model (brain-first)

**Disadvantages:**
- Higher integration complexity
- Requires 2-3 weeks of parallel ROI data
- Harder to debug when systems interact

---

### Recommended Path Forward

**Week 1-2: Parallel Phase**
- Run `/brain-task` on 5-10 small tasks
- Keep `$ms` workflow unchanged
- Collect metrics: tokens/task, time, quality scores
- Goal: Prove brain system works and saves cost

**Week 3: Decision Point**
- Review ROI data:
  - Is brain faster? (avg time per task)
  - Is brain cheaper? (tokens per task)
  - Is brain quality ≥ $ms? (code review scores)
- If YES to 2+ → move to unified
- If NO → use brain for high-complexity tasks only

**Week 4+: Unified Phase** (if ROI validated)
- Build unified dispatcher
- Brain sinapses live alongside $ms templates
- Every task gets complexity score → optimal routing

---

## Part 4: Decision Layer Implementation

### Architecture Diagram

```
Developer Request
    │
    ├─→ brain-task dispatch endpoint
    │     │
    │     ├─→ Classify (domain, risk, patterns)
    │     ├─→ Score complexity (0-100)
    │     ├─→ Decide model (Haiku/Sonnet/Opus/Codex)
    │     ├─→ Check: auto-plan? (complexity >= 50?)
    │     │
    │     ├─ YES ──→ EnterPlanMode
    │     │         ├─ Explore sinapses
    │     │         ├─ Design + risk assess
    │     │         ├─ [await developer approval]
    │     │         └─→ ExitPlanMode
    │     │
    │     └─ NO ──→ Dispatch directly to [Model]
    │         ├─→ brain-map (context assembly)
    │         ├─→ Implement (brain-task Step 2)
    │         └─→ brain-document + auto-consolidate
    │
    └─→ $ms dispatch endpoint (T1-T7 pipeline)
        └─→ [unchanged, parallel workflow]
```

### Classification Rules (brain-task Step 0)

Before scoring complexity, classify the task:

```python
def classify_task(description: str) -> {classification, domains, risk_flags}:

  classification = detect(description):
    if "Should we" or "architecture" or "tech stack":
      → "architectural"
    elif any contract domain mentioned:
      → "contract"
    elif db schema or migration:
      → "database"
    elif security, tenant, compliance:
      → "security"
    else:
      → "standard"

  domains = extract_domains(description):
    # Parse: "frontend", "backend", "database", "infra", "analytics"
    # Count unique domains

  risk_flags = detect_risks(description):
    - breaking_change? (touching public API)
    - data_migration? (schema changes, backfill)
    - security? (auth, tenant, encryption)
    - cross_tenant? (affects multiple tenants)
    - irreversible? (no rollback)
```

### Complexity Score Function (brain-task Step 1)

```python
def score_complexity(task) -> 0..100:

  base_score = 20  # minimum

  # Domain multiplier
  if task.domains <= 1:
    base_score += 0
  elif task.domains == 2:
    base_score += 15
  else:
    base_score += 30

  # Risk escalation
  if "security" in task.risk_flags:
    base_score += 20
  elif "breaking_change" in task.risk_flags:
    base_score += 15
  elif "data_migration" in task.risk_flags:
    base_score += 10

  # Context density
  required_sinapses = brain_map.estimate_sinapses(task)
  if required_sinapses > 40k:
    base_score += 15
  elif required_sinapses > 20k:
    base_score += 10

  # External research
  if task.classification == "architectural":
    base_score += 10

  # Iterative work
  if "should we" in task.description:
    base_score += 10

  # Token budget constraint
  if TOTAL_SESSION_TOKENS > 80% * BUDGET:
    base_score -= 5  # prefer cheaper models when tight

  return min(base_score, 100)
```

### Model Dispatch Logic

```python
def route_to_model(complexity_score: int) -> str:

  if complexity_score < 20:
    return "haiku"  # 8-15k tokens, instant
  elif complexity_score < 50:
    return "sonnet"  # 60-80k tokens, balanced
  elif complexity_score < 75:
    return "opus"    # 120-150k tokens, deep reasoning
  else:
    return "codex"   # 200k+ tokens, strategic + consensus
```

### Plan Mode Auto-Trigger Logic

```python
def should_enter_plan_mode(task) -> bool:

  return (
    # Automatic cases
    task.complexity_score >= 50
    or task.classification == "architectural"
    or any(flag in task.risk_flags for flag in
           ["breaking_change", "data_migration", "security"])
    or brain_map.estimate_context_size() > 40k
    # Manual case (checked at invocation)
    or "--plan" in task.invocation_args
  )
```

---

## Part 5: Integration with MetalShopping Private Skills

### How $ms and brain-task Coexist

MetalShopping's private skills (`$ms`, `$metalshopping-openapi-contracts`, etc.) are **incompatible by design** with brain-task:

**Why incompatible:**
1. `$ms` enforces T1-T7 sequential stages
2. `brain-task` is opt-in fluid flow
3. Both work fine independently
4. Unified integration requires custom dispatcher (Phase 5b, future work)

### Current Best Practice: Parallel Workflows

**For standard features** → use `$ms`:
```bash
# Good for: features following T1-T7 pipeline
# Example: new product filtering feature
$ms "Add product filter to frontend"
  → T1 OpenAPI contract
  → T2 backend handler
  → T4 SDK generation
  → T5 React component
  → T6 tests
  → T7 docs
```

**For exploratory/architectural work** → use `brain-task`:
```bash
# Good for: decisions, learning, multi-domain
# Example: evaluating new tech
/brain-task "Should we adopt gRPC for internal services?"
  → brain-map (context)
  → plan mode (architecture review)
  → brain-mckinsey (external research)
  → implementation (if approved)
  → brain-document (update sinapses)
```

### Private Skills Available to brain-task

When brain-task runs, it has **READ** access to MetalShopping-specific skills for context:

```javascript
// brain-map can read but NOT invoke:
- $metalshopping-openapi-contracts (context only: learn contract patterns)
- $metalshopping-adr (context only: read existing ADRs)
- $metalshopping-design-system (context only: learn token usage)

// brain-task CANNOT invoke:
- $ms (would create circular routing)
- $metalshopping-implement (conflicts with brain-task Step 2)
- $metalshopping-review (separate review gate after task)
```

### Future Unified Integration (Phase 5b)

After validating brain-task ROI separately:

```
Unified Dispatcher (new skill: $ms-integrated-brain)
  │
  ├─→ Receive task
  ├─→ Score complexity
  ├─→ If T1 contract needed:
  │   └─→ Call $metalshopping-openapi-contracts (T1)
  │
  ├─→ If Haiku/Sonnet work:
  │   └─→ Call brain-task [model]
  │
  ├─→ If Opus+ work OR complex:
  │   ├─→ brain-task with plan mode
  │   └─→ If approval passed:
  │       └─→ Continue with $ms T4+ if contracts touched
  │
  └─→ Always end with:
      └─→ $metalshopping-review (architecture check)
```

This is **NOT Phase 5** (Phase 5 is just model routing + plan triggering).
This is **Phase 5b or Phase 6** (future work after ROI validation).

---

## Part 6: Implementation Roadmap

### Phase 5 Deliverables

#### Skill: `brain-decision.md` (new, entry point)
**Location:** `forgeflow-mini/skills/brain-decision.md`

Replaces manual `/brain-task` invocation with intelligent routing:

```
Workflow:
  1. Accept task description
  2. Classify (domain, risk, patterns)
  3. Score complexity (0-100)
  4. Decide model (Haiku/Sonnet/Opus/Codex)
  5. Check auto-plan trigger
  6. IF plan needed: EnterPlanMode
  7. IF not planning: dispatch to brain-task [model]

Output:
  - Complexity score (shown to developer)
  - Model selected (shown to developer)
  - Plan mode status (active/skipped)
  - Task forwarded to implementation
```

**Token budget:** 5k in / 2k out (just routing, no heavy work)

#### Skill: `brain-mckinsey.md` (complete, Phase 3 already exists)
Already created. Invoked by brain-decision for complexity >= 75.

#### Update: `brain-task.md`
**Add Step 0:** Classification + complexity scoring
**Add Step 1:** Decision layer integration

---

## Part 7: Decision Tree Visualization

```
User invokes: /brain-task [description]

    ↓ [Skill: brain-decision]

  1️⃣ CLASSIFY
     ├─ Domain count? (1 / 2 / 3+ regions)
     ├─ Risk flags? (security, data_migration, breaking_change, etc.)
     └─ Task type? (standard, architectural, contract, security, database)

    ↓

  2️⃣ SCORE COMPLEXITY (0-100)
     ├─ Domains × 15
     ├─ Risk × 20
     ├─ Context density × 15
     ├─ External research × 10
     ├─ Iterative work × 10
     ├─ Novel pattern × 15
     └─ Token tight × 5

    ↓

  3️⃣ SELECT MODEL
     ├─ 0-20: Haiku (trivial)
     ├─ 20-50: Sonnet (standard)
     ├─ 50-75: Opus (complex)
     └─ 75+: Codex (strategic)

    ↓

  4️⃣ AUTO-PLAN?
     ├─ Complexity >= 50?
     ├─ Classification == "architectural"?
     ├─ Risk flags include breaking_change/security/data_migration?
     ├─ Context > 40k tokens?
     └─ User passed --plan flag?

     IF YES → EnterPlanMode
              ├─ Explore sinapses (Tier 1 + 2)
              ├─ Design architecture
              ├─ Assess risks
              ├─ [await developer approval]
              └─ ExitPlanMode → Step 5

     IF NO → Skip plan, go to Step 5

    ↓

  5️⃣ DISPATCH TO IMPLEMENTATION
     ├─ [Selected Model] executes brain-task
     ├─ Step 1: brain-map (context assembly)
     ├─ Step 2: implement [domain code]
     ├─ Step 3: brain-document (propose sinapses)
     └─ Step 4: auto-consolidate? (every 5 tasks)

    ↓

  6️⃣ OUTCOME
     ├─ ✅ Success: update weights, clear working-memory
     └─ ❌ Failure: capture as brain-lesson, escalate if pattern
```

---

## Part 8: Decision Matrix Reference

### When to Use Each Model

| Model | Complexity | Time | Cost | Best For |
|-------|-----------|------|------|----------|
| **Haiku** | Trivial (0-20) | <15 min | $0.03-0.05 | Small fixes, simple components, code review feedback |
| **Sonnet** | Standard (20-50) | 30-90 min | $0.10-0.20 | Most feature work, new modules, refactoring |
| **Opus** | Complex (50-75) | 1-2 hours | $0.30-0.50 | Multi-domain refactors, unfamiliar patterns, architectural changes |
| **Codex** | Strategic (75+) | 2-4 hours | $0.80-1.50 | Major platform decisions, consensus gate, long-term strategy |

### When Plan Mode Activates

| Trigger | Auto? | When | Action |
|---------|-------|------|--------|
| Complexity >= 50 | ✅ Auto | High-complexity task | Enter plan mode, get approval |
| classification = "architectural" | ✅ Auto | "Should we...", "Would it be better..." | Plan mode + external research |
| Risk flags = breaking/security/migration | ✅ Auto | High-risk work | Plan mode, mandatory approval |
| User passes --plan | ❌ Manual | Uncertain tasks | Explicit plan mode request |

### Integration Decision

| Situation | Recommendation | Why |
|-----------|---|---|
| First 5 tasks with brain-task | **Parallel** | Learn ForgeFlow independently |
| Most features follow T1-T7? | **Keep $ms** | Don't break working pipeline |
| Want to measure ROI? | **Parallel for 2 weeks** | Collect cost/quality/speed data |
| After validation, want unification | **Phase 5b (future)** | Build custom dispatcher |

---

## Summary

**Phase 5 is about intelligent routing:**

1. **Model selection** — complexity score determines Haiku/Sonnet/Opus/Codex
2. **Plan mode triggering** — auto-activate for high-complexity, high-risk, architectural work
3. **Skill integration** — keep $ms and brain-task parallel (for now), measure ROI, plan unified dispatcher later

**No new complex skills needed.** Just `brain-decision.md` routing + existing skills + plan mode integration.

**Next step:** Build `brain-decision.md` skill (5k tokens to route + classify) + integrate with existing brain-task.

