# Context Tiers — Reference

## Tier 1: Foundational (Always Loaded)

**What to load:**
- `.brain/hippocampus/architecture.md` — first 500 chars verbatim
- `.brain/hippocampus/conventions.md` — first 500 chars verbatim
- `.brain/working-memory/brain-state.json` — current state snapshot
- Recent activity from `.brain/working-memory/` (last 3 files by mtime)

**Max tokens:** ~2k total for Tier 1.

**Truncation:** If a hippocampus file exceeds 500 chars, hard-cut at 500 and append
`[...truncated]`. Never summarize from memory — always read from disk.

**Output format:**
```markdown
### Hippocampus Context
**Architecture:** [verbatim 500 chars from architecture.md]
**Conventions:** [verbatim 500 chars from conventions.md]
### Task Summary
[task_id, domain, risk, type from dev-context]
```

---

## Tier 2: Domain-Specific (score >= 20)

**FTS5 keyword search:**
```sql
SELECT s.id, s.title, s.content, s.tags, s.weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{keywords}'
  AND s.region LIKE '%{domain}%'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 5
```

**Per-result limit:** 800 tokens each (hard-cut content, append `[...truncated]`).

**Fallback (no DB or < 2 FTS5 results):**
```sql
SELECT id, title, content, tags, weight
FROM sinapses
WHERE region LIKE '%{domain}%'
ORDER BY weight DESC
LIMIT 5
```

**Output:** For each sinapse include: title, weight, region, tags, content (truncated
to 800 tokens), and `related/see_also` links.

---

## Tier 3: Spreading Activation (score >= 75 or critical risk)

**Trigger conditions (any one is sufficient):**
- `complexity_score >= 75`
- `risk_level = 'critical'`
- Tier 2 sinapse explicitly references another as prerequisite
- User passes `--deep` flag

**Query — follow related/see_also references from Tier 2 results:**
```sql
SELECT DISTINCT target_id FROM sinapse_links
WHERE source_id IN ({tier2_sinapse_ids})
  AND target_id NOT IN ({already_loaded_ids})
LIMIT 3
```

**Max additional sinapses:** 3, at 800 tokens each.

**Spreading logic:** Walk one hop from Tier 2 results via `sinapse_links`. Do not
recurse further — single hop only.

---

## Hebbian Weight Update (after Tier 2 and Tier 3 loading)

Run after loading each tier (skip if 0 sinapses loaded for that tier):

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1,
    weight = weight + 0.1 * (1.0 - weight)
WHERE id IN ({loaded_sinapse_ids});
```

**Formula:** `weight_new = weight_old + 0.1 * (1 - weight_old)`

- Asymptotic: weight approaches 1.0 but never exceeds it.
- Excluded: Tier 1 hippocampus files (always loaded, tracking adds noise).
- On failure (DB locked, schema mismatch): log error and continue. Never block
  context assembly for a tracking failure.
