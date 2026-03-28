---
name: brain-plan
description: Planner — Convert context packet to Cortex-Linked TDD implementation plan with micro-steps, file structure design, sinapse linking, and self-review gates
metadata:
  plan_type: expanded
---

# brain-plan Skill — Cortex-Linked TDD Planner

## Pipeline Position

brain-plan is invoked by brain-dev when plan_mode is true (complexity >= 50 or `--plan` flag). It runs between brain-map (context loading) and brain-task Step 3 (implementation). Not on the default pipeline path — only activated for complex tasks requiring architectural planning.

```
brain-dev → brain-plan → brain-task (brain-map called within brain-task Step 1)
                              ↑ you are here
```

**Purpose:** Take a context packet (from brain-map) and task description, then produce a detailed, step-by-step implementation plan with TDD micro-steps, file structure design, sinapse-linked conventions, self-review gates, and acceptance criteria. Every micro-step is a test-first unit of work that a subagent can execute independently.

**Token Budget:** 15k in / 8k out

---

## Core Principles

1. **Test-First:** Every implementation micro-step starts with a failing test. No code without a spec.
2. **No Placeholders:** Every file path, function name, and type signature in the plan must be concrete. If you cannot determine the exact path, read the codebase until you can. `// TODO` and `fill in later` are plan failures.
3. **Sinapse-Linked:** Every convention reference must link to a specific sinapse ID or lesson ID from the context packet. Unlinked conventions are invisible to subagents.
4. **Self-Contained Micro-Steps:** Each micro-step includes everything a subagent needs: the spec to write, the file to create, the pattern to follow, and the acceptance gate. No ambient context assumed.

---

## Workflow

---

## Phase 0: Interactive Planning (runs BEFORE Stage 1)

This phase runs when brain-plan is called by brain-dev. It reads the dev-context handoff file, asks targeted questions, proposes approaches, and waits for developer approval before generating the plan. Skip to Stage 1 if called directly without a dev-context file.

### Step 0a: Read dev-context handoff file

Read `.brain/working-memory/dev-context-{task_id}.md` (written by brain-dev Phase 1).

Extract from frontmatter:
- `intent`, `domain`, `complexity_score`, `model`

Read prose sections:
- `## Brain Evaluation` section — contains brain-dev's concerns (conflicts, missing deps, alternative patterns)
- `## Relevant Sinapses` section — sinapses already loaded by brain-dev (do NOT re-query these from brain.db)

If the file does NOT exist (brain-plan called standalone without brain-dev):
→ Load context yourself: query brain.db for domain sinapses (Tier 1, max 5). Continue to Step 0b.

### Step 0b: Ask clarifying questions (1–3, one at a time)

Rules:
- **One question per message.** Wait for the answer before asking the next.
- **Maximum 3 questions.** Stop after 3 even if more would be useful.
- **Skip questions** whose answers are obvious from the task description.
- **Prioritise concerns** from brain-dev: if a concern was flagged, ask about it first.

Question priority order:
1. Any concern from dev-context (e.g., "brain-dev flagged a potential conflict with the auth sinapse — is this change meant to replace or extend the current auth flow?")
2. Implementation approach (if multiple valid approaches exist): "Should this be event-driven or synchronous?"
3. Constraints: "Does this need to be backwards compatible?" / "Is zero-downtime deployment required?"

Domain-specific example questions:
- **backend:** "Should this endpoint be versioned (v2) or replace v1?"
- **frontend:** "Is this replacing the existing component or adding a new variant alongside it?"
- **database:** "Can we schedule a migration window, or must this be zero-downtime?"
- **cross-domain:** "Which domain is the source of truth — backend or analytics?"

### Step 0c: Propose 2 implementation approaches

Based on task + answers + brain context, present exactly 2 options:

```
**Option A (Recommended): {short title}**
Approach: {1–2 sentences describing the technical approach}
Pros: {2–3 bullets}
Cons: {1–2 bullets}
Sinapse link: [[sinapse-id]] if applicable

**Option B: {short title}**
Approach: {1–2 sentences}
Pros: {2–3 bullets}
Cons: {1–2 bullets}

**My recommendation: Option A** — {1 sentence reason, referencing a sinapse or lesson if one applies}
```

Wait for developer's choice before proceeding to Stage 1.

### Step 0d: Confirm approach and proceed

After developer selects or approves an approach:
- Note the chosen approach
- Proceed to Stage 1 (Analyse Context Packet) — all micro-steps must reflect the chosen approach
- If dev-context was present: skip re-loading sinapses already listed in dev-context.relevant_sinapses

---

### Input

- Context packet (from `.brain/working-memory/context-packet-{task_id}.md`)
- Task description
- Optional: stakeholder constraints, deadline
- Optional: `--subagents` flag (signals brain-task to use Path F dispatcher mode)

### Process

#### Stage 1: Analyze Context Packet

Read `.brain/working-memory/context-packet-{task_id}.md` and extract:

- Domain classification (backend, frontend, database, etc.)
- Loaded sinapses (review all Tier 1 + Tier 2) — record each sinapse ID
- Conventions relevant to domain — map each to its sinapse ID
- Related lessons (especially failures to avoid) — record each lesson ID
- Architecture constraints from ADRs
- Existing file patterns in the codebase (read 2-3 files in the target domain to understand naming, structure, imports)

**Sinapse Index:** Build a lookup table for use in later stages:

```
sinapse_index:
  - id: sinapse-backend-outbox
    title: "Outbox Pattern"
    region: cortex/backend
    applies_to: [event emission, transaction boundaries]

  - id: lesson-0003
    title: "Outbox must be atomic"
    severity: critical
    applies_to: [event emission within transactions]

  - id: sinapse-frontend-component
    title: "Component Structure"
    region: cortex/frontend
    applies_to: [new components, UI patterns]
```

This index is referenced by `[[sinapse-id]]` notation in every micro-step.

---

#### Stage 2: File Structure Design

Before decomposing into micro-steps, design the complete file structure. This prevents micro-steps from creating files that conflict or duplicate.

**Process:**

1. List ALL files that will be created or modified
2. For each file, specify:
   - Full path from project root
   - Action: `create` or `modify`
   - Purpose: one-line description
   - Depends on: which other files must exist first
3. Verify no path collisions
4. Verify naming follows conventions from sinapse index

**Output format:**

```markdown
## File Structure

| # | Action | Path | Purpose | Depends On |
|---|--------|------|---------|------------|
| F1 | create | src/modules/pricing/pricing.service.ts | Core pricing calculation logic | — |
| F2 | create | src/modules/pricing/pricing.service.spec.ts | Unit tests for pricing service | F1 |
| F3 | modify | src/modules/pricing/pricing.module.ts | Register pricing service | F1 |
| F4 | create | src/modules/pricing/dto/margin-request.dto.ts | Input DTO for margin calculation | — |
| F5 | create | src/events/product-margin-calculated.event.ts | Event schema for margin result | — |
| F6 | create | src/modules/analytics/handlers/margin.handler.ts | Event handler for analytics | F5 |
| F7 | create | src/modules/analytics/handlers/margin.handler.spec.ts | Tests for margin handler | F6, F5 |
| F8 | modify | src/modules/analytics/analytics.module.ts | Register margin handler | F6 |
```

**Validation gate:** Every file referenced in any micro-step MUST appear in this table. If a micro-step references a file not in the table, the plan is invalid.

---

#### Stage 3: Decompose into TDD Micro-Steps

Each micro-step is a single test-first unit of work. The pattern is always:

```
1. Write the failing spec (test file)
2. Write the minimal implementation to pass the spec
3. Verify: run the spec, confirm green
```

**Micro-step decomposition rules:**

- For backend: spec → implementation → wire into module → integration spec
- For frontend: component spec → component → hook into parent → visual spec
- For database: migration spec → migration → index → query spec
- For multi-domain: explicit dependency order across domains, specs first in each domain

**Micro-step format (MANDATORY for every step):**

```markdown
### Micro-Step M{N}: {Short Title}

**Domain:** {backend | frontend | database | infra | cross-domain}
**Files:** {F-numbers from File Structure table}
**Estimated tokens:** {N}k

#### Spec (write first)

**File:** {exact path to spec file}
**What to test:**
- {Concrete test case 1 — e.g., "calculateMargin(100, 30) returns 0.30"}
- {Concrete test case 2 — e.g., "calculateMargin with negative cost throws InvalidInputError"}
- {Edge case — e.g., "calculateMargin(0, 0) returns 0, not NaN"}

**Conventions:**
- [[sinapse-id]]: {How this sinapse applies to the spec}
- [[lesson-id]]: {What failure to avoid}

#### Implementation (write after spec)

**File:** {exact path to implementation file}
**Pattern:** {Describe the exact pattern to follow — reference a sinapse or existing file}
**Key decisions:**
- {Decision 1 — e.g., "Use BigDecimal for margin, not float — see [[lesson-0012]]"}
- {Decision 2 — e.g., "Emit event via outbox in same transaction — see [[sinapse-backend-outbox]]"}

#### Acceptance Gate

- [ ] Spec file exists and contains all test cases listed above
- [ ] Implementation file exists
- [ ] All specs pass: `{exact test command}`
- [ ] No linting errors: `{exact lint command}`
- [ ] {Domain-specific check — e.g., "Event schema validates against JSON Schema"}

#### Dependencies

- Requires: {M-numbers of prerequisite micro-steps, or "None"}
- Unlocks: {M-numbers of steps that depend on this one}
```

---

#### Stage 4: Detect Conflicts

Cross-reference each micro-step against the sinapse index:

- **ADRs** — Does any micro-step contradict an architectural decision?
- **Conventions** — Does any micro-step violate absolute rules from a linked sinapse?
- **Lessons** — Is there a known pitfall that a micro-step might hit?

**Output format for conflicts:**

```markdown
## Conflict Check

### Conflict 1: {Micro-Step M{N}} vs [[sinapse-id]]

**Issue:** {Description of the conflict}
**Resolution:** {Concrete fix — what the micro-step must do differently}
**Applied:** {Yes — the micro-step above already incorporates this fix}
```

If no conflicts: output `## Conflict Check\n\nNo conflicts detected. All micro-steps align with sinapse index.`

---

#### Stage 5: Self-Review Checklist

Before finalizing the plan, run this checklist. Every item must pass. If any fails, fix the plan before writing the output file.

```markdown
## Self-Review Checklist

- [ ] Every micro-step has a Spec section with concrete test cases (no "test that it works")
- [ ] Every micro-step has an Implementation section with a named pattern or file reference
- [ ] Every file referenced in micro-steps appears in the File Structure table
- [ ] Every convention reference uses [[sinapse-id]] notation linking to the sinapse index
- [ ] No placeholders: zero instances of "TODO", "TBD", "fill in", "as needed", or "etc."
- [ ] Acceptance gates include exact commands (not "run tests" but "npm test -- --filter=pricing")
- [ ] Dependencies form a valid DAG (no circular dependencies)
- [ ] Token estimates sum to a reasonable total (warn if > 80k)
- [ ] At least one lesson is referenced (we always have something to avoid)
- [ ] Multi-domain tasks have explicit cross-domain integration micro-steps
```

**If any checkbox fails:** Fix the issue in the plan. Do not output a plan with unchecked items. Re-run the checklist after fixes until all pass.

---

#### Stage 6: Estimate Token Budget

Per-micro-step estimate based on:
- File count (spec + implementation)
- Complexity (simple, moderate, complex)
- Testing needs

| Complexity | Estimate |
|-----------|----------|
| Simple (1 spec + 1 file) | 3-5k |
| Moderate (1 spec + 2-3 files, wiring) | 8-12k |
| Complex (2+ specs, integration, multi-file) | 15-25k |

**Total budget check:**
```
Sum all micro-step estimates. If total > 80k, warn:
"This plan will consume ~{N}k tokens. Consider splitting into multiple sessions
or using --subagents flag for sequential subagent execution."
```

---

### Output

Create `.brain/working-memory/implementation-plan-{task_id}.md`:

```markdown
---
task_id: YYYY-MM-DD-<slug>
plan_type: expanded
task: [user description]
domain: [backend | frontend | database | infra | cross-cutting]
timestamp: [ISO 8601]
status: planned
dispatch_ready: true
micro_steps: [N]
estimated_tokens: [total]k
---

# Implementation Plan — [Task Title]

## Task Summary

[1-2 sentence summary of what and why]

## Sinapse Index

[Table of all sinapses/lessons referenced in this plan, built in Stage 1]

| ID | Title | Region | Applies To |
|----|-------|--------|------------|
| [[sinapse-id]] | [Title] | [region] | [where used in plan] |
| [[lesson-id]] | [Title] | [domain] | [what to avoid] |

## File Structure

[Table from Stage 2 — every file that will be created or modified]

| # | Action | Path | Purpose | Depends On |
|---|--------|------|---------|------------|
| F1 | create | [path] | [purpose] | — |
| F2 | create | [path] | [purpose] | F1 |

## Micro-Steps

### Micro-Step M1: [Title]

**Domain:** [domain]
**Files:** F1, F2
**Estimated tokens:** [N]k

#### Spec (write first)

**File:** [exact spec path]
**What to test:**
- [Concrete test case 1]
- [Concrete test case 2]

**Conventions:**
- [[sinapse-id]]: [how it applies]

#### Implementation (write after spec)

**File:** [exact implementation path]
**Pattern:** [pattern reference]
**Key decisions:**
- [Decision with sinapse/lesson link]

#### Acceptance Gate

- [ ] Spec exists with all test cases
- [ ] Implementation passes all specs
- [ ] `[exact test command]`
- [ ] `[exact lint command]`

#### Dependencies

- Requires: None
- Unlocks: M2, M3

### Micro-Step M2: [Title]

[Same format as M1...]

## Implementation Order

[Topological sort of micro-steps based on dependencies]

1. M1 (0 deps) -> [N]k tokens
2. M2 (depends on M1) -> [N]k tokens
3. M3 (depends on M1) -> [N]k tokens [sequential after M2]
4. M4 (depends on M2, M3) -> [N]k tokens

**Execution groups (sequential — fresh subagent per step):**
- Group 1: M1 (independent)
- Group 2: M2, then M3 (both depend on M1, run sequentially)
- Group 3: M4 (runs after Group 2 completes)

## Total Token Budget

- Micro-step estimates: [N]k
- Testing buffer: [N]k
- Documentation: [N]k
- **Estimated total: [N]k tokens**

## Conflict Check

[Output from Stage 4]

## Self-Review

[All checkboxes from Stage 5 — must all be checked]

- [x] Every micro-step has a Spec section with concrete test cases
- [x] Every micro-step has an Implementation section with a named pattern
- [x] Every file referenced in micro-steps appears in the File Structure table
- [x] Every convention reference uses [[sinapse-id]] notation
- [x] No placeholders: zero instances of TODO, TBD, fill in, as needed, etc.
- [x] Acceptance gates include exact commands
- [x] Dependencies form a valid DAG
- [x] Token estimates sum to a reasonable total
- [x] At least one lesson is referenced
- [x] Multi-domain tasks have explicit cross-domain integration micro-steps

## Dispatch Metadata

**Dispatch ready:** true
**Recommended mode:** [inline | dispatch]
- inline: Execute micro-steps sequentially in current session (< 5 steps or < 40k tokens)
- subagents: Use brain-dev Phase 3 to dispatch fresh subagents per micro-step (>= 5 steps or >= 40k tokens)

**Subagent model per step:**
| Step | Model | Reason |
|------|-------|--------|
| M1 | sonnet | Standard spec + implementation |
| M2 | sonnet | Standard spec + implementation |
| M3 | haiku | Simple wiring, no logic |
| M4 | sonnet | Integration test, moderate complexity |

## Next Steps

1. Run Readiness Gate (verify all specs can be created)
2. If --subagents OR (step_count >= 5 OR estimated_tokens >= 40k): brain-task Path F dispatches subagents per micro-step (sequential — fresh context per step)
3. If inline (step_count < 5 AND no --subagents): brain-task Path F executes micro-steps sequentially without parallel dispatch
Note: Expanded plans (plan_type: expanded) ALWAYS route to Path F. Path E handles only legacy standard plans.
4. Update status after each micro-step
5. Run /brain-document on completion
```

---

## Example: Full Plan for "Add product margin to analytics dashboard"

```markdown
---
task_id: 2026-03-26-product-margin-analytics
plan_type: expanded
task: Add product margin to analytics dashboard
domain: cross-domain
timestamp: 2026-03-26T10:00:00Z
status: planned
dispatch_ready: true
micro_steps: 7
estimated_tokens: 52k
---

# Implementation Plan — Product Margin Analytics

## Task Summary

Add margin percentage calculation to the product service and surface the result
in the analytics dashboard via an event-driven pipeline. Uses the outbox pattern
for reliable event delivery.

## Sinapse Index

| ID | Title | Region | Applies To |
|----|-------|--------|------------|
| [[sinapse-backend-outbox]] | Outbox Pattern | cortex/backend | M2, M3 — event emission |
| [[sinapse-event-contracts]] | Event Schema Rules | cortex/backend | M1 — schema design |
| [[sinapse-frontend-component]] | Component Structure | cortex/frontend | M6 — dashboard widget |
| [[lesson-0003]] | Outbox must be atomic | cortex/backend | M3 — transaction boundary |
| [[lesson-0017]] | Float precision in money | cortex/backend | M2 — use Decimal |

## File Structure

| # | Action | Path | Purpose | Depends On |
|---|--------|------|---------|------------|
| F0 | create | `tests/contracts/ProductMarginCalculated.spec.ts` | Contract spec — written at M1 spec phase | — |
| F1 | create | contracts/events/v1/ProductMarginCalculated.yaml | Event schema | — |
| F2 | create | src/modules/product/margin.service.ts | Margin calculation logic | — |
| F3 | create | src/modules/product/margin.service.spec.ts | Unit tests for margin calc | F2 |
| F4 | modify | src/modules/product/product.service.ts | Wire margin + emit event | F2, F1 |
| F5 | create | src/modules/product/product.service.spec.ts | Test margin emission | F4 |
| F6 | create | src/modules/analytics/handlers/margin.handler.ts | Event consumer | F1 |
| F7 | create | src/modules/analytics/handlers/margin.handler.spec.ts | Tests for handler | F6 |
| F8 | modify | src/modules/analytics/analytics.module.ts | Register handler | F6 |
| F9 | create | src/components/analytics/MarginMetric.tsx | Dashboard widget | — |
| F10 | create | src/components/analytics/MarginMetric.spec.tsx | Widget tests | F9 |
| F11 | create | tests/integration/margin-pipeline.spec.ts | End-to-end test | F4, F6, F9 |

## Micro-Steps

### Micro-Step M1: Define ProductMarginCalculated Event Schema

**Domain:** backend
**Files:** F1
**Estimated tokens:** 3k

#### Spec (write first)

**File:** tests/contracts/ProductMarginCalculated.spec.ts
**What to test:**
- Schema validates a well-formed event with product_id, tenant_id, margin_pct, timestamp
- Schema rejects event missing required field tenant_id
- Schema rejects margin_pct outside range [0, 1]
- Schema rejects non-UUID product_id

**Conventions:**
- [[sinapse-event-contracts]]: All events must include tenant_id, timestamp, and a version field

#### Implementation (write after spec)

**File:** contracts/events/v1/ProductMarginCalculated.yaml
**Pattern:** Copy structure from contracts/events/v1/OrderPlaced.yaml (existing event)
**Key decisions:**
- margin_pct is a decimal [0, 1], not a percentage [0, 100] — see [[lesson-0017]]
- Include schema version: "1.0.0"

#### Acceptance Gate

- [ ] Schema file exists at contracts/events/v1/ProductMarginCalculated.yaml
- [ ] Contract spec passes: `npm test -- --filter=ProductMarginCalculated`
- [ ] Schema validates: `./scripts/validate_contracts.sh`
- [ ] Includes: product_id (UUID), tenant_id (UUID), margin_pct (decimal), timestamp (ISO8601)

#### Dependencies

- Requires: None
- Unlocks: M3, M5 (not shown in this abbreviated example)

### Micro-Step M2: Implement Margin Calculation Service

**Domain:** backend
**Files:** F2, F3
**Estimated tokens:** 5k

#### Spec (write first)

**File:** src/modules/product/margin.service.spec.ts
**What to test:**
- calculateMargin(revenue: 100, cost: 30) returns Decimal("0.70")
- calculateMargin(revenue: 100, cost: 100) returns Decimal("0.00")
- calculateMargin(revenue: 0, cost: 0) returns Decimal("0.00") — not NaN
- calculateMargin with negative revenue throws InvalidInputError
- calculateMargin with cost > revenue returns negative margin (valid business case)

**Conventions:**
- [[lesson-0017]]: Use Decimal type for all money/percentage calculations, never float

#### Implementation (write after spec)

**File:** src/modules/product/margin.service.ts
**Pattern:** Follow src/modules/product/pricing.service.ts structure (existing service)
**Key decisions:**
- Use Decimal library for arithmetic — see [[lesson-0017]]
- Pure function, no side effects, no database access
- Export as injectable service for DI

#### Acceptance Gate

- [ ] Spec file exists with all 5 test cases
- [ ] Service file exists with calculateMargin method
- [ ] All specs pass: `npm test -- --filter=margin.service`
- [ ] No linting errors: `npm run lint -- src/modules/product/margin.service.ts`

#### Dependencies

- Requires: None
- Unlocks: M3

### Micro-Step M3: Wire Margin Calculation + Event Emission in Product Service

**Domain:** backend
**Files:** F4, F5
**Estimated tokens:** 8k

#### Spec (write first)

**File:** src/modules/product/product.service.spec.ts
**What to test:**
- updateProduct calls marginService.calculateMargin with correct args
- updateProduct emits ProductMarginCalculated event via outbox
- Event emission is in SAME transaction as product update (not after commit)
- If margin calculation throws, product update is rolled back

**Conventions:**
- [[sinapse-backend-outbox]]: Events must be written to outbox table in same transaction
- [[lesson-0003]]: CRITICAL — outbox write must be atomic with business operation

#### Implementation (write after spec)

**File:** src/modules/product/product.service.ts (modify)
**Pattern:** Follow existing outbox emission in src/modules/order/order.service.ts
**Key decisions:**
- Inject MarginService via constructor
- Call outbox.publish() INSIDE the transaction block, not after — see [[lesson-0003]]
- Event payload matches ProductMarginCalculated.yaml schema exactly

#### Acceptance Gate

- [ ] Product service spec covers margin + event emission
- [ ] outbox.publish() is inside transaction block (verify by reading the code)
- [ ] All specs pass: `npm test -- --filter=product.service`
- [ ] No linting errors: `npm run lint -- src/modules/product/`

#### Dependencies

- Requires: M1, M2
- Unlocks: M5, M7 (not shown in this abbreviated example)

[...remaining micro-steps M4-M7 follow the same format as M1-M3...]
Note: M5 and M7 referenced as unlock targets above are defined in the complete plan. Only M1-M3 shown for brevity.
```

---

## Conflict Detection Logic

Cross-reference each micro-step against:

1. **Sinapse rules:** For each `[[sinapse-id]]` in the micro-step, verify the implementation decisions do not violate the sinapse's documented pattern
2. **Lesson warnings:** For each `[[lesson-id]]`, verify the micro-step explicitly avoids the documented failure mode
3. **ADR constraints:** If any ADR in the context packet constrains the approach, verify compliance
4. **File collisions:** Verify no two micro-steps create the same file path
5. **Import cycles:** Verify the dependency DAG does not create circular imports between modules

---

## Token Budget Reference

| Complexity | Micro-Step Pattern | Estimate |
|-----------|-------------------|----------|
| Simple (1 spec + 1 file, no wiring) | Schema, DTO, pure function | 3-5k |
| Moderate (1 spec + 2-3 files, module wiring) | Service + injection + event | 8-12k |
| Complex (2+ specs, integration, cross-module) | E2E test + multi-service coordination | 15-25k |

**Budget warning threshold:** If total > 80k tokens:
```
WARNING: This plan estimates ~{N}k tokens.
Recommendation: Use --subagents flag for sequential subagent execution,
or split into 2 sessions at micro-step M{breakpoint}.
```

---

## Integration with brain-task

- **Path F (dispatch):** brain-task reads the plan, dispatches one subagent per micro-step. Used when:
  - `plan_type: expanded` AND `dispatch_ready: true` AND (`step_count >= 5` OR `estimated_tokens >= 40k`), OR
  - `--subagents` flag is passed (overrides dispatch_ready threshold check)
- **Path F inline:** micro-steps execute sequentially when `dispatch_ready: true` but `step_count < 5` and `tokens < 40k`, and `--subagents` was not passed.
- **Legacy plans (`plan_type: standard` or missing):** brain-task Path E executes as before — no micro-step dispatch.

---

**Created:** 2026-03-24 | **Updated:** 2026-03-26 | **Agent Type:** Planner | **Plan Format:** Cortex-Linked TDD (expanded)
