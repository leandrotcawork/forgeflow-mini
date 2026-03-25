---
name: brain-task
description: Full task orchestration — context assembly → implementation → documentation → consolidation
---

# brain-task Skill — Task Orchestration Engine

**Purpose:** Execute complete task lifecycle with intelligent context loading, implementation by selected model, sinapses documentation, and optional consolidation.

**Token Budget:** Varies by model (see below)

**Trigger:** Called by `brain-decision` with model selection + context file

---

## Workflow Overview

\`\`\`
brain-decision routes task
         ↓
brain-task invoked with:
  - --model [haiku | codex | opus]
  - --context working-memory/[context-type].md (if applicable)
  - --task "[description]"
  - --plan (if plan mode active)
         ↓
Step 1: brain-map (context assembly) → 5k tokens
Step 2: implement ([selected model] executes) → 60-150k tokens
Step 3: brain-document (propose sinapses) → 5k tokens
Step 4: consolidate? (every 5 tasks) → 15k tokens
         ↓
Result: feature complete + brain updated
\`\`\`

---

## Step 1: brain-map — Context Assembly (5k tokens)

Load weighted sinapses relevant to task:

1. Query brain.db: match by domain, sort by weight, return top 10
2. Build 3-tier context packet (Tier 1: 4k, Tier 2: 10k, Tier 3: 5k on-demand)
3. Generate: working-memory/context-packet.md
4. Output: sinapses loaded, tokens used, risks

---

## Step 2: implement — Model Execution (60-150k tokens)

Execute by selected model (Haiku/Codex/Opus):

### Codex Path (Primary — 80% of work)
- Input: context file from brain-decision + sinapses + examples
- Process: understand patterns, implement feature, run tests
- Output: working-memory/implementation-summary.md
- Quality gates: compile ✓, tests ✓, conventions ✓, linting ✓

### Opus Path (Debugging only)
- Input: error trace + context + similar lessons
- Process: root cause analysis, propose fix, test
- Output: working-memory/debug-analysis.md

### Haiku Path (Trivial only)
- Input: simple description
- Process: quick change (typo, color, comment)
- Output: modified file, no tests needed

---

## Step 3: brain-document — Propose Sinapses Updates (5k tokens)

After implementation:

1. Identify touched regions (from git diff)
2. Assess knowledge changes per domain
3. Generate: working-memory/sinapse-updates.md (diffs, rationale)
4. Create: working-memory/sinapse-review.md (A/R/M checklist)
5. **Key rule:** If anti-pattern discovered → route to `/brain-lesson`, NOT cortex sinapses

---

## Step 4: Auto-Consolidate? (15k tokens, every 5 tasks)

Batch-process completed tasks:

```
Trigger: IF completed_tasks >= 5 THEN suggest consolidation

On Consolidation:
1. Inventory completed tasks
2. Review all sinapse proposals (A/R/M)
3. Surface escalation candidates (3+ same lessons → convention)
4. Generate: progress/brain-health.md (staleness, coverage, weights)
5. Update brain.db weights (+0.02 approved, -0.005/day unused)
6. Clear working-memory, preserve current-task.md
7. Move records to progress/activity.md
```

---

## Token Budgets by Scenario

### Simple Feature (Codex, No Plan)
- brain-map: 5k
- Codex implement: 80k
- brain-document: 5k
- **Total: 90k (20 min)**

### Complex Feature (Codex + Plan Mode)
- plan design: 20k
- brain-map: 5k
- Codex implement: 120k
- brain-document: 5k
- **Total: 150k (45 min)**

### Debugging (Opus)
- brain-map: 5k
- Opus debug: 120k
- brain-document (lesson): 5k
- **Total: 130k (30 min)**

### Consolidation (Every 5 Tasks)
- brain-consolidate: 15k
- **Total: 15k (10 min)**

---

## Critical Integration Points

### Receives From:
- brain-decision: model + context-file path + plan flag
- Codex/Opus: implementation code + test results

### Sends To:
- brain-document: diff + domains → sinapses proposals
- brain-lesson: anti-patterns detected → escalate if pattern
- brain-consolidate: (every 5 tasks) task records + proposals

### Files Written:
- working-memory/current-task.md (plan if planning)
- working-memory/context-packet.md (loaded sinapses)
- working-memory/implementation-summary.md (what built)
- working-memory/sinapse-updates.md (proposed changes)
- (Codex context file created by brain-decision)

---

## Verification

- [ ] Simple task → Haiku routes, <10 min
- [ ] Complex task → plan mode, approval, Codex executes
- [ ] Codex receives context file + sinapses + examples
- [ ] Opus routes on --debug (root cause analysis)
- [ ] brain-document generates proposals after
- [ ] Weights updated (+0.02 approved, -0.005 unused)
- [ ] After 5 tasks: consolidate suggested
- [ ] One commit per task (no uncommitted changes)
- [ ] Anti-patterns → brain-lesson (not cortex sinapses)

---

**Created:** 2026-03-25 | **Phase:** 5 | **Status:** Ready for dispatch
