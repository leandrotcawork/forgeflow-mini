---
name: brain-map
description: ContextMapper — Assembles project context from .brain/ using tiered loading
---

# brain-map — ContextMapper

## Pipeline Position

```
brain-dev → brain-map → brain-plan → brain-task
                 ↑ you are here
```

**Trigger:** Called by brain-dev after scoring. Not typically user-invoked.
**Budget:** Max 4k tokens read, 2k tokens output.

---

## RED FLAGS — Stop and re-read if you think any of these

| Thought | Reality |
|---------|---------|
| "I know the context, I'll skip reading the files" | NEVER compose from memory. Read from disk verbatim. |
| "FTS5 found nothing, I'll skip Tier 2" | Run the fallback query instead. Never skip Tier 2 entirely. |
| "I'll load all cortex regions for more context" | No. Fallback MUST filter by domain. Over-loading wastes budget. |
| "Tier 3 isn't needed for this task" | Only skip if score < 75 AND no Tier 2 sinapse flags a prerequisite. |
| "I'll sanitize keywords by removing hyphens" | No. Wrap each term in double quotes. Removing hyphens changes meaning. |

---

## Step 1: Read dev-context

Read `.brain/working-memory/dev-context-{task_id}.md`.
Extract: `task_id`, `keywords` (array), `domain`, `score`, `intent`.

**STOP if file missing:**
> Output: "brain-map: dev-context not found for {task_id}. Run brain-dev first." Then stop.

---

## Step 2: Load Tier 1 (always)

Read these files verbatim — never compose from memory:

- `.brain/hippocampus/architecture.md` — first 500 chars. Hard-cut at 500, append `[...truncated]` if longer.
- `.brain/hippocampus/conventions.md` — first 500 chars. Same rule.
- `.brain/working-memory/brain-state.json` — full file.

**Max tokens:** ~2k total for Tier 1.

---

## Step 3: Load Tier 2 (if score >= 20)

### Keyword Sanitization — REQUIRED before any SQL

FTS5 treats `-`, `*`, `:`, `^`, `(`, `)` as operators. Passing raw keywords causes SQL errors (e.g., `"health-check"` → `no such column: check`).

**Rule: wrap every keyword in double quotes. Strip any existing double quotes first. Join terms with OR.**

```python
# Python
def sanitize_fts5(keywords):
    terms = ['"' + k.replace('"', '') + '"' for k in keywords]
    return ' OR '.join(dict.fromkeys(terms))  # dedup, preserve order

# Example:
# Input:  ["health-check", "endpoint", "brain-version"]
# Output: '"health-check" OR "endpoint" OR "brain-version"'
```

```js
// JavaScript
function sanitizeFts5Keywords(keywords) {
  return keywords
    .map(k => '"' + k.replace(/"/g, '') + '"')
    .filter((k, i, arr) => arr.indexOf(k) === i)
    .join(' OR ');
}
```

### Primary FTS5 Query

```sql
SELECT s.id, s.title, s.content, s.tags, s.weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{sanitized_keywords}'
  AND s.region LIKE '%{domain}%'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 5
```

### Fallback Query (use when FTS5 returns < 2 results OR throws an error)

**MUST include the domain filter — do NOT load all regions.**

```sql
SELECT id, title, content, tags, weight
FROM sinapses
WHERE region LIKE '%{domain}%'
ORDER BY weight DESC
LIMIT 5
```

**Per-result limit:** 800 tokens each. Hard-cut content at 800 tokens, append `[...truncated]`.

---

## Step 4: Load Tier 3 (if score >= 75 OR any Tier 2 sinapse flags a prerequisite)

Follow `sinapse_links` from Tier 2 results. Single hop only — do not recurse.

```sql
SELECT DISTINCT target_id FROM sinapse_links
WHERE source_id IN ({tier2_ids_comma_separated})
  AND target_id NOT IN ({already_loaded_ids_comma_separated})
LIMIT 3
```

**Max 3 additional sinapses at 800 tokens each.**

---

## Step 5: Assemble context-packet

Write `.brain/working-memory/context-packet-{task_id}.md`:

```markdown
---
task_id: {task_id}
domain: {domain}
score: {score}
sinapses_loaded: {N}
generated_at: {ISO8601}
---

## Tier 1: Hippocampus Context
**Architecture:** {verbatim first 500 chars}
**Conventions:** {verbatim first 500 chars}
**brain-state:** {key fields: current_skill, context_pressure, consecutive_failures}

### Task Summary
- task_id: {task_id}
- domain: {domain}
- intent: {intent}
- score: {score}
- request: "{verbatim request}"

## Tier 2: Domain-Specific Sinapses
{for each sinapse: ### {title} (weight: {w}, region: {r})\n{content truncated to 800 tokens}}

## Tier 3: Spreading Activation (if loaded)
{same format as Tier 2}
```

---

## Step 6: Update Hebbian Weights

Run after Tier 2 and Tier 3 loading. **Skip Tier 1 hippocampus files** (always-loaded, tracking adds noise).

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count   = usage_count + 1,
    weight        = weight + 0.1 * (1.0 - weight)
WHERE id IN ({loaded_sinapse_ids_comma_separated});
```

Formula: `weight_new = weight_old + 0.1 * (1 - weight_old)` — asymptotic to 1.0, never exceeds it.

**On DB failure:** log the error and continue. Never block context assembly for a weight update failure.

---

## Output

**File written:** `.brain/working-memory/context-packet-{task_id}.md`
**Next step:** Invoke brain-plan.

---

**Refactored:** 2026-03-30 | **Agent Type:** ContextMapper
