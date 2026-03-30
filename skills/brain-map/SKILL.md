---
name: brain-map
description: ContextMapper — Load 3-tier weighted sinapses for task context
---

# brain-map Skill — ContextMapper

## Pipeline Position

```
brain-dev → brain-map → brain-task (Steps 1-3) → brain-document → brain-consolidate
                  ↑ you are here
```

**Purpose:** Load task-relevant sinapses from brain.db using 3-tier weighted loading. Assembles the context packet that brain-task uses.

**Token Budget:** 4-5k tokens (context assembly only, no heavy computation)

**Trigger:** Called by brain-task Step 1. Not user-facing — never called directly.

**Lightweight mode:** When brain-task passes `--lightweight`, load Tier 1 only (~4k tokens). Skip Tier 2 and Tier 3. Used for Haiku-scored tasks (complexity < 20).

---

## Workflow

### Step 1: Parse Task Classification

Input from brain-dev (via dev-context file):
- Task description
- Domain: `backend | frontend | database | infra | analytics | cross-domain`
- Risk level: `low | medium | high | critical`
- Task type: `feature | bugfix | refactor | debugging | architectural | unknown_pattern`

### Keyword Source

- **Via brain-dev path:** Read `keywords` field from `.brain/working-memory/dev-context-{task_id}.md`
- **Direct invocation (no dev-context):** Extract 2-3 keywords from the task description inline (simple text extraction — pick nouns and domain terms)

---

### Step 2: Load Tier 1 Context (~4k tokens)

**Always loaded, foundational context:**

```sql
-- Query 1: Hippocampus summaries (condensed)
SELECT content FROM sinapses
WHERE region = 'hippocampus'
  AND id IN ('hippocampus-architecture', 'hippocampus-conventions')
ORDER BY weight DESC

-- Note: Lessons are now embedded in sinapse content (## Lessons Learned sections).
-- They are loaded naturally when sinapses are retrieved via FTS5 + spreading activation.
-- No separate lesson query needed.

-- Query 2: Task description (from user input)
[from dev-context file or task description]
```

**Tier 1 Output (~4k tokens):**
```markdown
### Hippocampus Context

**Architecture:** [condensed architecture.md — 500 chars]

**Conventions:** [condensed conventions.md — 500 chars]
  - Naming rules
  - Absolute rules for this language
  - Process rules

### Task Summary

[User description, domain, risk level, type]
```

---

### Step 3: Load Tier 2 Context (~10-15k tokens)

**Domain-specific sinapses, weighted by relevance:**

```sql
-- Step 1: Direct activation (FTS5 keyword match, ~2ms)
-- Keywords come from dev-context file (brain-dev) or task description (direct invocation)
SELECT id, title, content, tags, weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{keywords}'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 2

-- Step 2: Spreading activation (tag expansion, ~3ms)
-- Collect tags from Step 1 results, query for sinapses sharing those tags
SELECT id, title, content, tags, weight
FROM sinapses
WHERE id NOT IN ({step1_ids})
  AND (tags LIKE '%{tag1}%' OR tags LIKE '%{tag2}%' OR tags LIKE '%{tag3}%')
  AND region LIKE '%{domain}%'
ORDER BY weight DESC
LIMIT 2
```

**Associative retrieval (brain-inspired):**
- Step 1 = direct activation: keywords from the task trigger matching sinapses via FTS5
- Step 2 = spreading activation: tags from Step 1 results surface connected sinapses (like neurons firing along synaptic connections)
- Total: 3-4 sinapses, all relevant to the actual task
- Zero LLM cost — pure SQL (~5ms total)

**Step 2.5: Track sinapse usage (Hebbian learning, NEW in v1.2.0)**

After Tier 2 sinapses are loaded, update their access tracking in brain.db:

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({tier_2_sinapse_ids});
```

**Also run after Step 4 (Tier 3) if Tier 3 was loaded:**

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({tier_3_sinapse_ids});
```

**Excluded:** Tier 1 hippocampus sinapses (`hippocampus-architecture`, `hippocampus-conventions`) are NOT tracked — they are always loaded, so tracking them would add noise without signal.

**Cost:** One SQL UPDATE per context load, ~1ms, zero tokens.

**Fallback:** If FTS5 returns < 2 results (sparse brain, new project), fall back to weight-based query:

```sql
SELECT id, title, content, tags, weight
FROM sinapses
WHERE region LIKE '%{domain}%'
ORDER BY weight DESC
LIMIT 5
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
complexity_score: [0-100 from brain-dev]
sinapses_loaded: [N]
tokens_estimated: [4k + 10-15k + optional tier3]
generated_at: [ISO8601]
---

# Context Packet — [Task Description]

## Tier 1: Foundational (~4k tokens)

[Condensed hippocampus content]
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

This context packet is read directly by brain-task for implementation. No reformatting pass — the LLM reads the packet as-is.
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

Tier 2 (domain-specific):
  - 5 sinapses from cortex/backend (avg weight: 0.82)
  - 2 sinapses from sinapses/ (cross-cutting)
  - Links: 3 backlinks found

Tier 3 (on-demand):
  - Not loaded (complexity < 75)
  - Available: 2 additional sinapses if needed (--deep flag)

Tokens: ~4k (Tier 1) + ~12k (Tier 2) = ~16k used
Ready for: brain-task Step 2 (implement + verify)

Output: .brain/working-memory/context-packet-{task_id}.md
```

---

## FTS5 Hybrid Queries (v0.7.0)

When task keywords are available (from brain-dev via dev-context), Tier 2 can use FTS5 to boost relevance:

```sql
-- Hybrid: domain filter + FTS5 keyword boost
SELECT s.id, s.title, s.region, s.tags, s.links, s.weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{task_keywords}'
  AND s.region LIKE '%{domain}%'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 5
```

**Fallback:** If FTS5 tables don't exist (pre-v0.7.0 brain) or FTS5 returns < 2 results, use the standard weight-ordered query from Step 3 above.

**When to use FTS5 vs standard:**
- FTS5 hybrid: when brain-dev provides a task description with searchable keywords
- Standard (weight-only): when `--lightweight` flag is passed (Haiku tasks) or no keywords available

---

## Lessons Integration

Lessons are embedded in sinapse `## Lessons Learned` sections and loaded naturally when sinapses are retrieved via FTS5 + spreading activation. No separate lesson query is needed.

---

## Token Budget Per Tier

| Tier | Model | Retrieval | Sinapse Count |
|------|-------|-----------|---------------|
| Tier 1 | Haiku | FTS5 only (no spreading) | 2 |
| Tier 1+2 | Sonnet/Codex | FTS5 + spreading activation | 2 + 2 = 4 |
| Tier 1+2+3 | Architectural | FTS5 + spreading + on-demand deep | 4 + N |

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Fix |
|---|---|---|
| Load all sinapses (no tiers) | Wastes tokens, dilutes context | Always use 3-tier loading |
| Skip Tier 3 for architectural tasks | Miss critical dependencies | Load Tier 3 if complexity >= 75 |
| Don't include backlinks | Sinapses appear isolated | Always query and include sinapse_links |
| Load Tier 2 without checking weight | Wrong sinapses loaded | Always ORDER BY weight DESC |
| Skip condensing hippocampus | Context bloat, token waste | Always condense to ~500 chars per file |

---

## Testing Checklist

brain-map is working when:

- [ ] Task domain correctly identified (backend/frontend/database/infra/cross-domain)
- [ ] Tier 1 includes: architecture + conventions (condensed)
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
3. brain-task reads context-packet-{task_id}.md directly for implementation
4. At completion: context files archived by brain-task post-task step

---

**Created:** 2026-03-25 | **Agent Type:** ContextMapper
