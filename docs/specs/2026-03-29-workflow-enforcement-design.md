# Workflow Enforcement, Linear Pipeline & Hebbian Learning — v1.2.0

> **Goal:** Enforce that brain-dev ALWAYS follows its routing (never implements directly), eliminate the brain-dev Phase 3 / brain-task Path F orchestration duplication by making the pipeline strictly linear, and complete the Hebbian learning loop so sinapses that help succeed get stronger automatically.

---

## Design Decisions (from brainstorming)

| Decision | Choice | Why |
|----------|--------|-----|
| Track active skill | `current_skill` field in brain-state.json | Simplest, uses existing state infrastructure, unambiguous |
| What to block | Write/Edit to anything outside allowlist | Future-proof — new directories auto-blocked |
| Block Bash? | No — Write/Edit only, HARD-GATE covers edge cases | LLM implements through Write/Edit, not Bash redirects |
| Hook tier | Tier 1 (always on) | Architectural invariant, same class as hippocampus-guard |
| Pipeline flow | Linear, no returns | StateFlow FSM principle — one direction, artifact-based handoffs |
| Who owns orchestration | brain-task Path F (single executor) | Eliminates Phase 3 / Path F duplication |
| Hebbian tracking scope | Tier 2 + Tier 3 only (not hippocampus) | Hippocampus is always loaded — tracking it adds noise |

---

## Research Foundation

| Source | Key Insight | How It Maps |
|--------|------------|-------------|
| [StateFlow (FSM-driven workflows)](https://arxiv.org/html/2403.11322v1) | Model workflows as finite state machines with deterministic transitions | 5-state FSM: CLASSIFY → PLAN → EXECUTE → LEARN → IDLE |
| [Plan-Validate-Execute pattern](https://community.sap.com/t5/security-and-compliance-blog-posts/plan-then-execute-an-architectural-pattern-for-responsible-agentic-ai/ba-p/14239753) | Separate planner from executor; verifier checks before execution | brain-plan (planner) → human approval (validator) → brain-task (executor) |
| [Architecting Resilient LLM Agents](https://arxiv.org/pdf/2509.08646) | Safety logic must move out of prompts into infrastructure | PreToolUse hook enforces routing — code, not prompts |
| [Reflexion: Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366) | Episodic memory + self-reflection improves task completion from 80% to 91% | Episode capture + brain-consolidate learning loop |
| [AriGraph: Knowledge Graph with Episodic Memory](https://arxiv.org/abs/2407.04363) | Structured knowledge with episodic memory enables efficient retrieval and planning | Sinapses (semantic) + episodes (episodic) + FTS5 spreading activation |
| [Hebbian Learning](https://pub.towardsai.net/hebbian-learning-cells-that-fire-together-wire-together-cf197118c478) | "Neurons that fire together, wire together" — usage strengthens connections | Sinapses used in successful tasks gain weight automatically |
| Superpowers plugin | `<HARD-GATE>` tags + mandatory checklists + anti-pattern sections (~80% compliance) | HARD-GATE in brain-dev SKILL.md for soft enforcement |
| [Deep Agent Architecture for AI Coding Assistants](https://dev.to/apssouza22/a-deep-dive-into-deep-agent-architecture-for-ai-coding-assistants-3c8b) | Single-responsibility agents with explicit handoff artifacts | Each skill has ONE job, hands off via artifact files |
| [Agentic Workflows for Software Development (McKinsey)](https://medium.com/quantumblack/agentic-workflows-for-software-development-dc8e64f4a79d) | Deterministic orchestration with bounded agent execution | Hook enforcement = deterministic gate that LLM cannot bypass |

---

## Section 1: Linear Pipeline Architecture (Phase 3 Removal)

### FSM State Model

```
┌──────────────────────────────────────────────────────────────────┐
│                         FSM States                               │
│                                                                  │
│  IDLE ──→ CLASSIFY ──→ PLAN ──→ EXECUTE ──→ LEARN ──→ IDLE     │
│               │                    ↑                             │
│               ├── (trivial) ───────┘                             │
│               │                                                  │
│               └── (question) ──→ CONSULT ──→ IDLE               │
└──────────────────────────────────────────────────────────────────┘
```

Each state maps to one skill. Each skill has ONE job. Linear flow. No returns.

| FSM State | Skill | Single Responsibility | Artifact Produced |
|---|---|---|---|
| CLASSIFY | brain-dev | Classify intent, score, route | `dev-context-{task_id}.md` |
| PLAN | brain-plan | Load context, create plan, get approval, invoke executor | `context-packet-{task_id}.md` + `implementation-plan-{task_id}.md` |
| EXECUTE | brain-task | Execute (single-step or multi-step), verify, review | Source code changes, test results |
| LEARN | (inside brain-task post-task) | Post-task recording, confidence check, episode capture | `task-completion-{task_id}.md`, episodes |
| CONSULT | brain-consult | Load context, answer using brain knowledge | Answer to user |

### Brain Metaphor Alignment

| Brain System | Function | ForgeFlow Component |
|---|---|---|
| Thalamus | Sensory relay — routes input to the right cortex region | brain-dev (classifier/router) |
| Prefrontal Cortex | Planning, decision-making | brain-plan (TDD planner) |
| Motor Cortex | Executes planned actions | brain-task (executor) |
| Hippocampus | Consolidates short-term → long-term memory | brain-consolidate + `.brain/hippocampus/` |
| Cortex (regions) | Long-term specialized knowledge | `.brain/cortex/{domain}/` |
| Working Memory | Temporary storage during active tasks | `.brain/working-memory/` |
| Synapses | Connections between neurons, weighted by use | sinapses (weighted knowledge nodes) |
| Episodic Memory | Memory of specific events/failures | episode files |
| Semantic Memory | General knowledge, facts, patterns | sinapse content (patterns, conventions) |
| Anterior Cingulate Cortex | Detects conditions where errors are likely | brain-self-check.js |
| Basal Ganglia | Habit formation from repetition | Convention escalation (3+ lessons → convention) |
| Amygdala | Threat detection, blocks dangerous actions | Circuit breaker |
| Associative retrieval | Connected neurons fire together | FTS5 + spreading activation in brain-map |

### Current Flow (broken)

```
brain-dev Phase 1 → brain-dev Phase 2 → brain-plan
                                             ↓
                                        returns to brain-dev Phase 3
                                             ↓
                                        brain-dev dispatches brain-task per step
```

**Problems:**
1. brain-dev claims to be "pure classifier (~500-800 tokens)" but Phase 3 is heavy orchestration
2. Control returns to brain-dev after brain-plan — creates a loop
3. brain-task Path F duplicates Phase 3 — both parse plans and dispatch micro-steps
4. brain-plan Stage 1 reads context-packet that doesn't exist yet (chicken-and-egg bug)

### New Flow (linear)

```
brain-dev (classify + route) ──→ brain-plan ──→ brain-task
       │                                         ↑
       ├── (trivial/fix-known) ──────────────────┘
       └── (question/debug) ──→ brain-consult
```

### Changes Per Skill

**brain-dev SKILL.md:**
- Phase 1: unchanged (classify, score, write dev-context)
- Phase 2: unchanged (route)
- Phase 3: **DELETED entirely**
- New: writes `current_skill: "brain-dev"` to brain-state.json at Phase 1 start
- New: writes `current_skill: "brain-plan"` or `"brain-task"` or `"brain-consult"` just before invoking the next skill

**brain-plan SKILL.md:**
- Phase 0: unchanged (Q&A, propose approaches)
- **NEW: Calls brain-map BEFORE Stage 1** to create context-packet (fixes chicken-and-egg bug — planner now has sinapse context to plan with)
- Stages 1-6: unchanged (plan generation), but Stage 1 now reads the context-packet that actually exists
- **NEW: After developer approves plan, brain-plan invokes `/brain-task` directly** (no return to brain-dev)
- Writes `current_skill: "brain-task"` to brain-state.json before invocation
- brain-plan's job ends when it invokes brain-task

**brain-task SKILL.md:**
- Step 1 context loading: if context-packet already exists (from brain-plan path), use it. If not (trivial/fix-known path), call brain-map to create it
- Path F gains Phase 3 logic: 3 reviewer gates per micro-step, post-task per step, confidence display, "fix it" loop
- Path F now owns ALL micro-step orchestration
- Path E removed (legacy standard plans — all plans are now expanded via brain-plan)

**brain-consult SKILL.md:**
- Unchanged — already self-contained with its own lightweight context loading

### Skill Lifecycle in brain-state.json

| Event | `current_skill` set to |
|---|---|
| brain-dev starts classification | `"brain-dev"` |
| brain-dev invokes brain-plan | `"brain-plan"` |
| brain-dev invokes brain-task (trivial) | `"brain-task"` |
| brain-dev invokes brain-consult | `"brain-consult"` |
| brain-plan invokes brain-task | `"brain-task"` |
| brain-post-task.js completes | `null` |
| Session ends | `null` |

### Complete Flow Examples

**Complex build (score >= 20):**
```
User: "Add Redis caching for product catalog"
→ brain-dev: classify=build, score=45, model=codex
   writes dev-context, sets current_skill="brain-plan", invokes /brain-plan
→ brain-plan: calls brain-map → context-packet created
   reads dev-context + context-packet
   Phase 0: Q&A (1-3 questions)
   Stages 1-6: creates plan with sinapse links
   presents plan → human approves
   sets current_skill="brain-task", invokes /brain-task
→ brain-task: reads context-packet + plan (both exist)
   Path F: dispatches subagents per micro-step
   3 reviewer gates per step (implementer → spec → quality)
   Step 2.5: verification gate
   Steps 3-5: post-task, self-check, episode capture
   sets current_skill=null
   DONE
```

**Trivial fix (score < 20):**
```
User: "Fix the null check in auth.js"
→ brain-dev: classify=fix-known, score=10, model=haiku
   writes dev-context, sets current_skill="brain-task", invokes /brain-task
→ brain-task: calls brain-map → context-packet (Tier 1 only)
   Path A: dispatch haiku subagent
   Step 2.5: verification gate
   Steps 3-5: post-task, self-check, episode capture
   sets current_skill=null
   DONE
```

**Question:**
```
User: "How does the auth flow work?"
→ brain-dev: classify=question, score=15
   writes dev-context, sets current_skill="brain-consult", invokes /brain-consult
→ brain-consult: loads context inline (Tier 1 + FTS5 Tier 2)
   answers using sinapses + hippocampus
   writes consult audit JSON
   sets current_skill=null
   DONE
```

---

## Section 2: Workflow Enforcement (HARD-GATE + Hook)

Two layers: soft enforcement in SKILL.md (~80% effective), hard enforcement via PreToolUse hook (100% effective).

### Layer 1: HARD-GATE in brain-dev SKILL.md

Added at the top of brain-dev, after the description and before Phase 1:

```xml
<HARD-GATE>
brain-dev is a ROUTER, not a worker. You MUST NOT:
- Explore the codebase yourself (Read/Grep/Glob for source files)
- Write a plan yourself (route to brain-plan)
- Implement anything (route to brain-task)
- Dispatch subagents for implementation
- Skip brain-plan for score >= 20 build/refactor tasks

Your ONLY job: classify → score → extract keywords → write dev-context → route.
After invoking the next skill, your job is DONE. Do not resume.
</HARD-GATE>
```

Anti-Pattern section added to the existing "What brain-dev Does NOT Do" table:

```markdown
## Anti-Pattern: "This Is Too Simple To Need brain-plan"

Every build/refactor with score >= 20 goes through brain-plan. "It's just a small
refactor" is exactly when shortcuts cause the most damage — no context loaded, no
sinapse consultation, no TDD plan, no reviewer gates. If you're thinking "I can
just do this quickly," you are about to skip the pipeline. ROUTE.
```

### Layer 2: PreToolUse Hook — `brain-routing-guard`

**Tier:** 1 (always on, like hippocampus-guard and circuit-breaker)

**Hook name:** `brain-routing-guard`

**Logic (in brain-hooks.js):**

```
On every Write or Edit tool call:
  1. Read brain-state.json → get current_skill
  2. If current_skill is NOT "brain-dev" and NOT "brain-consult" → ALLOW
  3. If current_skill is "brain-dev" or "brain-consult":
     a. Get the target file path from the tool call
     b. Check against ALLOWLIST:
        - .brain/working-memory/dev-context-*.md
        - .brain/working-memory/brain-state.json
        - .brain/working-memory/consult-*.json
        - .brain/progress/consult-log.md
     c. If target matches allowlist → ALLOW
     d. If target does NOT match → BLOCK with message:
        "⛔ brain-routing-guard: {current_skill} is a router, not a worker.
         Blocked write to: {file_path}
         Route to brain-plan (planning) or brain-task (implementation)."
```

**Fallback:** If brain-state.json doesn't exist or `current_skill` is null/missing, ALLOW (new project, no state yet).

**Direct invocation edge case:** brain-consult can be invoked directly (not via brain-dev). In this case, brain-consult must write `current_skill: "brain-consult"` to brain-state.json at the start of Step 1, and clear it at the end. This ensures the routing guard is active even for direct invocations.

### How the Two Layers Interact

```
LLM reads brain-dev SKILL.md
    ↓
HARD-GATE: "You are a router, do not implement"  (~80% compliance)
    ↓
LLM attempts Write/Edit anyway (20% of the time)
    ↓
Hook fires: brain-routing-guard checks current_skill + allowlist
    ↓
BLOCKED: "brain-dev is a router, not a worker"  (100% enforcement)
    ↓
LLM sees block message → routes to brain-plan/brain-task instead
```

### Changes to hooks.json

```json
{
  "name": "brain-routing-guard",
  "tier": 1,
  "trigger": "PreToolUse",
  "tools": ["Write", "Edit"],
  "description": "Enforce that router skills (brain-dev, brain-consult) cannot write outside their allowlist"
}
```

### Changes to brain-hooks.js

New function `routingGuard(toolCall)` added alongside existing `hippocampusGuard`, `circuitBreakerCheck`, etc. Same pattern — pure Node.js, zero dependencies, reads brain-state.json, checks allowlist, returns allow/block.

---

## Section 3: Hebbian Learning Activation

Complete the learning loop: sinapses that help succeed get stronger automatically, sinapses that sit unused fade away.

### 3A: Track Usage (brain-map + brain-consult)

When brain-map loads sinapses in Step 2 (Tier 2) and Step 4 (Tier 3), after the SELECT queries return results, execute:

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({loaded_sinapse_ids});
```

This fires every time sinapses are loaded for ANY purpose:
- brain-plan calls brain-map → sinapses updated
- brain-task calls brain-map (trivial path) → sinapses updated
- brain-consult loads Tier 2 via FTS5 → sinapses updated (same UPDATE, inline)

**Cost:** One SQL UPDATE per context load. ~1ms. Zero tokens.

**Tier 1 hippocampus sinapses** (`hippocampus-architecture`, `hippocampus-conventions`) are excluded — they're always loaded, tracking them adds noise.

### 3B: Usage-Based Weight Bonus (brain-consolidate)

Current brain-consolidate Step 4a does:
- Approval bonus: `weight += 0.02` per approved update
- Decay: `weight -= 0.005 * days_since_last_access` for unused sinapses

**New step 4a.2 — Usage bonus:**

brain-consolidate reads task-completion records from successful tasks since last consolidation, extracts `sinapses_loaded` arrays, counts how many times each sinapse appears in successful tasks, and applies the bonus:

```
For each sinapse with N successful uses since last consolidation:
  weight = MIN(1.0, weight + (0.01 * N))
```

### Weight Change Rules (complete)

| Trigger | Change | When | Cap |
|---|---|---|---|
| Sinapse loaded into context | `last_accessed = NOW()`, `usage_count += 1` | Every brain-map / brain-consult FTS5 call | — |
| Sinapse used in successful task | `weight += 0.01` per successful use | brain-consolidate Step 4a.2 | max 1.0 |
| Sinapse update approved by developer | `weight += 0.02` per approval | brain-consolidate Step 1 | max 1.0 |
| Sinapse unused for 7+ days | `weight -= 0.005` per day | brain-consolidate Step 4a | min 0.1 |

**Why these values:**
- Usage bonus (+0.01) is smaller than approval bonus (+0.02) — human validation is worth more than automatic tracking
- Decay (-0.005/day) is slow — a sinapse unused for 30 days loses 0.15, still usable
- Floor at 0.1 — even forgotten knowledge can be rediscovered via FTS5 keywords
- Cap at 1.0 — prevents runaway inflation from frequently-used sinapses

### 3C: How It Improves Context Quality Over Time

**Before (current):** brain-map loads sinapses by weight, but weights only change on manual approval (+0.02) or decay. A sinapse loaded 50 times in successful tasks has the same weight as one loaded once and manually approved.

**After (Hebbian):**

```
Week 1: sinapse-backend-api created, weight = 0.50
Week 2: Used in 3 successful tasks → weight = 0.53 (+0.03)
Week 2: Developer approves lesson update → weight = 0.55 (+0.02)
Week 3: Used in 2 more successful tasks → weight = 0.57 (+0.02)
Week 4: Not used, 7 days idle → weight = 0.535 (-0.035)
Week 5: Used in 1 successful task → weight = 0.545 (+0.01)
```

The result: brain-map's `ORDER BY weight DESC` naturally surfaces the most *useful* sinapses, not just the most *recently approved* ones. The brain gets better at picking the right context over time, without any manual intervention.

### 3D: What This Does NOT Change

- brain-consolidate still requires developer approval for content updates — Hebbian learning only affects **weight**, not **content**
- Convention escalation (3+ lessons → convention) still requires developer approval
- No sinapse is ever auto-created or auto-deleted — only auto-weighted
- All existing features (episodes, circuit breaker, strategy rotation, confidence system) remain unchanged

---

## Section 4: Files Affected

### Files to Modify

| # | Action | Path | What Changes |
|---|---|---|---|
| 1 | Modify | `skills/brain-dev/SKILL.md` | Add HARD-GATE + anti-pattern. Delete Phase 3. Add `current_skill` writes. |
| 2 | Modify | `skills/brain-plan/SKILL.md` | Add brain-map call before Stage 1. Forward invocation of brain-task after plan approval. |
| 3 | Modify | `skills/brain-task/SKILL.md` | Move Phase 3 logic into Path F. Step 1 reuses existing context-packet. Remove Path E. |
| 4 | Modify | `skills/brain-map/SKILL.md` | Add `UPDATE last_accessed, usage_count` for Tier 2/3 loads. |
| 5 | Modify | `skills/brain-consult/SKILL.md` | Add `UPDATE last_accessed, usage_count` for FTS5 Tier 2 loads. |
| 6 | Modify | `skills/brain-consolidate/SKILL.md` | Add Step 4a.2: usage-based weight bonus. |
| 7 | Modify | `hooks/hooks.json` | Add `brain-routing-guard` entry (Tier 1). |
| 8 | Modify | `hooks/brain-hooks.js` | Add `routingGuard()` function. |
| 9 | Modify | `.brain/working-memory/brain-state.json` | Add `current_skill` field. |
| 10 | Modify | `docs/brain-db-schema.sql` | Document `last_accessed` and `usage_count` as actively maintained. |
| 11 | Modify | `CHANGELOG.md` | v1.2.0 entry. |
| 12 | Modify | `README.md` | Update architecture diagram, document new features. |

### Files NOT Changed

| Path | Why |
|---|---|
| `scripts/brain-post-task.js` | Already records `sinapses_loaded`. No new responsibility. |
| `scripts/brain-self-check.js` | Independent of pipeline flow. |
| `scripts/brain-parse-plan.js` | Still used by brain-task Path F. |
| `scripts/build_brain_db.py` | Schema already has the columns. |
| `skills/brain-mckinsey/SKILL.md` | Independent — invoked from brain-consult escalation. |
| `skills/brain-document/SKILL.md` | Still called after brain-task completion. |
| `brain.config.json` | Hook profiles managed via hooks.json. |

---

## Success Criteria

### Workflow Enforcement
- [ ] brain-dev SKILL.md has `<HARD-GATE>` and anti-pattern section
- [ ] brain-dev Phase 3 is fully deleted
- [ ] brain-dev writes `current_skill` at Phase 1 start and before each route
- [ ] `brain-routing-guard` hook exists in hooks.json (Tier 1)
- [ ] `routingGuard()` in brain-hooks.js blocks Write/Edit outside allowlist when `current_skill` is `brain-dev` or `brain-consult`
- [ ] Hook allows writes when `current_skill` is null (new project fallback)

### Linear Pipeline
- [ ] brain-plan calls brain-map before Stage 1 (context-packet exists for planning)
- [ ] brain-plan invokes brain-task directly after plan approval (no return to brain-dev)
- [ ] brain-plan writes `current_skill: "brain-task"` before invocation
- [ ] brain-task Step 1 reuses existing context-packet when present
- [ ] brain-task Path F includes: 3 reviewer gates, post-task per step, confidence display, "fix it" loop
- [ ] Path E removed from brain-task
- [ ] No skill ever returns control to a previous skill

### Hebbian Learning
- [ ] brain-map updates `last_accessed` and `usage_count` for Tier 2/3 sinapses on load
- [ ] brain-consult updates `last_accessed` and `usage_count` for FTS5 Tier 2 sinapses on load
- [ ] Tier 1 hippocampus sinapses excluded from tracking
- [ ] brain-consolidate Step 4a.2 applies usage bonus (+0.01 per successful use, cap 1.0)
- [ ] Weight floor 0.1 and cap 1.0 enforced
- [ ] No auto-creation or auto-deletion of sinapses (only weight changes)

### Integration
- [ ] Complete flow works: brain-dev → brain-plan → brain-task (complex path)
- [ ] Complete flow works: brain-dev → brain-task (trivial path)
- [ ] Complete flow works: brain-dev → brain-consult (question path)
- [ ] brain-state.json `current_skill` lifecycle: set at classification, updated at each route, cleared at post-task

---

## Token Impact

| Change | Added Cost | When |
|--------|-----------|------|
| `current_skill` writes to brain-state.json | ~20 tokens (read + write) | Every classification + route |
| brain-map UPDATE query | 0 tokens (SQL only, ~1ms) | Every context load |
| HARD-GATE in brain-dev | ~150 tokens (read by LLM) | Every brain-dev invocation |
| brain-routing-guard hook | 0 tokens (Node.js, ~2ms) | Every Write/Edit tool call |
| brain-consolidate usage bonus | ~200 tokens (read task-completions, compute) | Every consolidation cycle |

**Net impact on typical task:** ~170 extra tokens for the HARD-GATE read + current_skill writes. Negligible compared to existing pipeline (~30-60k tokens per task).
