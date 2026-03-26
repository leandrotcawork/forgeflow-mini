---
name: brain-map
description: ContextMapper — Load 3-tier weighted sinapses for task context
---

# brain-map Skill — ContextMapper

## Pipeline Position

```
brain-decision → brain-map → brain-task (Steps 1-6, all inline) → brain-document → brain-consolidate
                  ↑ you are here
```

**Purpose:** Load task-relevant sinapses from brain.db using 3-tier weighted loading. Assembles the context packet that brain-task uses.

**Token Budget:** 4-5k tokens (context assembly only, no heavy computation)

**Trigger:** Called by brain-task Step 1. Not user-facing — never called directly.

**Lightweight mode:** When brain-task passes `--lightweight`, load Tier 1 only (~4k tokens). Skip Tier 2 and Tier 3. Used for Haiku-scored tasks (complexity < 20).

---

## Workflow

### Step 1: Parse Task Classification

Input from brain-decision:
- Task description
- Domain: `backend | frontend | database | infra | analytics | cross-domain`
- Risk level: `low | medium | high | critical`
- Task type: `feature | bugfix | refactor | debugging | architectural | unknown_pattern`

---

### Step 2: Load Tier 1 Context (~4k tokens)

**Always loaded, foundational context:**

```sql
-- Query 1: Hippocampus summaries (condensed)
SELECT content FROM sinapses
WHERE region = 'hippocampus'
  AND id IN ('hippocampus-architecture', 'hippocampus-conventions')
ORDER BY weight DESC

-- Query 2: Top lessons for task domain
SELECT id, title, severity, tags FROM lessons
WHERE domain = ?
ORDER BY weight DESC
LIMIT 3

-- Query 3: Task description (from user input)
[passed directly from brain-decision]
```

**Tier 1 Output (~4k tokens):**
```markdown
### Hippocampus Context

**Architecture:** [condensed architecture.md — 500 chars]

**Conventions:** [condensed conventions.md — 500 chars]
  - Naming rules
  - Absolute rules for this language
  - Process rules

### Recent Lessons (Top 3)

- [[lesson-XXXX]] **[Title]** (domain: backend)
  - [Mistake found]: [Description]
  - [Severity]: critical

- [[lesson-YYYY]] **[Title]** (domain: cross-domain)
  - [Pattern]: [Description]
  - [Severity]: high

### Task Summary

[User description, domain, risk level, type]
```

---

### Step 3: Load Tier 2 Context (~10-15k tokens)

**Domain-specific sinapses, weighted by relevance:**

```sql
-- Query 1: Domain sinapses (top 5 by weight)
SELECT id, title, region, tags, links, weight
FROM sinapses
WHERE region LIKE '%{domain}%'
-- Note: For cross-domain tasks, this query expands to:
-- WHERE region LIKE 'cortex/%'
-- This loads sinapses from ALL cortex regions (backend, frontend, database, infra)
-- The ContextMapper must detect domain='cross-domain' and expand the query accordingly
ORDER BY weight DESC
LIMIT 5

-- Query 2: Cross-cutting sinapses (top 2)
SELECT id, title, region, tags, links, weight
FROM sinapses
WHERE region LIKE 'sinapses/%'
ORDER BY weight DESC
LIMIT 2

-- Query 3: Fetch backlinks for Tier 2 sinapses
SELECT source_id, target_id FROM sinapse_links
WHERE source_id IN (...)
```

**Tier 2 Output (~10-15k tokens):**

```markdown
### Architecture Patterns — [Domain]

#### Pattern 1: [Sinapse Title]
**Weight:** 0.87 | **Region:** cortex/backend
**Tags:** [tag1, tag2, tag3]
[Brief 2-3 line summary of pattern]

**When to use:** [One-liner]
**Example:** [[linked-sinapse]] shows this in action

#### Pattern 2: [Another Sinapse Title]
**Weight:** 0.78 | **Region:** cortex/backend
...

### Cross-Cutting Patterns

#### [Sinapse Title] (sinapses/ region)
**Weight:** 0.83
**Applies to:** backend, frontend, database
[Description]

**Related sinapses:** [[pattern-A]], [[pattern-B]]
```

---

### Step 4: Prepare Tier 3 (On-Demand)

**Available but not loaded unless flagged critical:**

```sql
-- Query: Additional sinapses linked from Tier 2
SELECT DISTINCT target_id FROM sinapse_links
WHERE source_id IN (tier2_sinapse_ids)
  AND target_id NOT IN (tier1_sinapse_ids, tier2_sinapse_ids)
LIMIT 3
```

**When to load Tier 3:**
- If task is flagged "architectural" (complexity >= 75)
- If risk level is "critical"
- If Tier 2 sinapses explicitly reference another sinapse as prerequisite
- User passes `--deep` flag

---

### Step 5: Generate Context Packet

Create: `.brain/working-memory/context-packet-{task_id}.md`

```markdown
---
task_id: YYYY-MM-DD-<slug>
domain: [backend | frontend | database | infra | cross-domain]
complexity_score: [0-100 from brain-decision]
sinapses_loaded: [N]
lessons_loaded: [M]
tokens_estimated: [4k + 10-15k + optional tier3]
generated_at: [ISO8601]
---

# Context Packet — [Task Description]

## Tier 1: Foundational (~4k tokens)

[Condensed hippocampus content]
[Top 3 lessons matching domain]
[Task summary]

## Tier 2: Domain-Specific (~10-15k tokens)

[Top 5 domain sinapses with weights]
[Cross-cutting patterns]
[Backlinks showing relationships]

## Tier 3: On-Demand (if loaded)

[Additional sinapses linked from Tier 2]
[Only if complexity >= 75 or critical risk]

---

## Brain Health

- **Region:** cortex/[domain]
- **Sinapses loaded:** [N] (healthy/stale/very stale)
- **Average weight:** [0.XX]
- **Last updated:** [date]
- **Escalation candidates:** [count]

---

## Next: brain-task Step 2

This packet will be used by brain-task to generate the model-specific context file:
- `sonnet-context-{task_id}.md` (for Sonnet — score 20-39)
- `codex-context-{task_id}.md` (for Codex — score 40+)
- `opus-debug-context-{task_id}.md` (for Opus — debugging)
- For Haiku (score < 20): no additional context file — this packet is sufficient.

All model-specific files add real code examples from the codebase.
```

---

### Step 6: Output Status

```
[Brain] ContextMapper loaded sinapses

Domain: backend
Complexity: 65 (moderate-high)
Risk: high

Tier 1 (always):
  - .brain/hippocampus/architecture.md (condensed)
  - .brain/hippocampus/conventions.md (condensed)
  - 3 lessons matching domain

Tier 2 (domain-specific):
  - 5 sinapses from cortex/backend (avg weight: 0.82)
  - 2 sinapses from sinapses/ (cross-cutting)
  - Links: 3 backlinks found

Tier 3 (on-demand):
  - Not loaded (complexity < 75)
  - Available: 2 additional sinapses if needed (--deep flag)

Tokens: ~4k (Tier 1) + ~12k (Tier 2) = ~16k used
Ready for: brain-task Step 2 (generate codex-context.md)

Output: .brain/working-memory/context-packet-{task_id}.md
```

---

## Lessons Integration

Lessons are loaded as part of Tier 1 (top 3 by severity for the task domain). If promotion candidates are detected (3+ same domain+tag), flag in context packet: "⚠ 3+ lessons suggest: [pattern]".

---

## Token Budget Per Tier

| Tier | Tokens | Content | When Loaded |
|------|--------|---------|-------------|
| Tier 1 | ~4k | Hippocampus (condensed) + top 3 lessons + task | Always |
| Tier 2 | ~10-15k | Domain sinapses (top 5) + cross-cutting (top 2) + backlinks | Standard + Codex + Opus |
| Tier 3 | ~5k | Additional linked sinapses | Only if complexity >= 75 or critical |
| **Lightweight** | **~4k** | **Tier 1 only** | **Haiku tasks (complexity < 20)** |
| **Typical total** | **~16-20k** | Tier 1 + 2 | Per task |

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Load all sinapses (no tiers) | Wastes tokens, dilutes context | Always use 3-tier loading |
| Skip Tier 3 for architectural tasks | Miss critical dependencies | Load Tier 3 if complexity >= 75 |
| Don't include backlinks | Sinapses appear isolated | Always query and include sinapse_links |
| Ignore lessons (only use sinapses) | Miss failure patterns | Always load top 3 lessons for domain |
| Load Tier 2 without checking weight | Wrong sinapses loaded | Always ORDER BY weight DESC |
| Skip condensing hippocampus | Context bloat, token waste | Always condense to ~500 chars per file |

---

## Testing Checklist

brain-map is working when:

- [ ] Task domain correctly identified (backend/frontend/database/infra/cross-domain)
- [ ] Tier 1 includes: architecture + conventions (condensed) + 3 lessons
- [ ] Tier 2 includes: 5 domain sinapses + 2 cross-cutting sinapses
- [ ] Sinapses sorted by weight (highest first)
- [ ] Backlinks included in output
- [ ] context-packet-{task_id}.md generated with all 3 tiers documented
- [ ] Brain health status shown (region, avg weight, staleness)
- [ ] Tier 3 marked as "available" if complexity < 75
- [ ] Tier 3 auto-loaded if complexity >= 75 or risk=critical
- [ ] Token count estimates accurate (~4k T1 + ~12k T2 = ~16k)

---

## Integration with brain-task

1. brain-task Step 1 calls brain-map
2. brain-map outputs context-packet-{task_id}.md
3. brain-task Step 2 reads context-packet-{task_id}.md
4. brain-task generates model-specific context file from it (sonnet-context, codex-context, or opus-debug-context)
5. Model implements using its context file (Codex via MCP, Sonnet/Opus via Claude)
6. At completion: all context files archived by brain-task Step 6 (inline)

---

**Created:** 2026-03-25 | **Agent Type:** ContextMapper
