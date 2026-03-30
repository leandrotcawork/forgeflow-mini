---
name: brain-map
description: ContextMapper — Assembles project context from .brain/ using tiered loading
---

# brain-map Skill — ContextMapper

## Pipeline Position

```
brain-dev → brain-map → brain-plan → brain-task
                 ↑ you are here
```

**Trigger:** Called by brain-dev or brain-plan. Not typically user-invoked directly.
**Budget:** Max 4k tokens read, 2k tokens output.

---

## Input

Requires: `.brain/working-memory/dev-context-{task_id}.md`
Fields used: `task_id`, `keywords`, `domain`, `score`, `intent`

---

## Workflow

### Step 1: Read dev-context

Parse `dev-context-{task_id}.md` and extract: task_id, keywords, domain,
score, intent.

### Step 2: Load Tier 1 (always)

Load hippocampus files, brain-state, and recent working-memory activity.
Read files from disk verbatim — never compose from memory.

> See [references/context-tiers.md](references/context-tiers.md) — Tier 1 section.

### Step 3: Load Tier 2 (if score >= 20)

Run FTS5 keyword search against brain.db for domain-specific sinapses.
Limit 5 results at 800 tokens each.

> See [references/context-tiers.md](references/context-tiers.md) — Tier 2 section
> for exact SQL, fallback query, and output format.

### Step 4: Load Tier 3 (if score >= 75)

Spreading activation — follow related/see_also links from Tier 2 results.
Max 3 additional sinapses.

> See [references/context-tiers.md](references/context-tiers.md) — Tier 3 section
> for trigger conditions and query.

### Step 5: Assemble context-packet

Write to `.brain/working-memory/context-packet-{task_id}.md` with frontmatter
(task_id, domain, score, sinapses_loaded, generated_at) followed by
Tier 1/2/3 sections. See shared output-format-standards.md when available.

### Step 6: Update usage weights (Hebbian)

After assembling the packet, update access tracking for all loaded sinapses
(excluding Tier 1 hippocampus files).

> See [references/context-tiers.md](references/context-tiers.md) — Hebbian section
> for formula and SQL.

---

## Output

**File:** `.brain/working-memory/context-packet-{task_id}.md`
**Next step:** Invoke brain-plan.

---

**Created:** 2026-03-25 | **Agent Type:** ContextMapper
