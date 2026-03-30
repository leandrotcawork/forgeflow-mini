# Brain Access Patterns

Standard patterns for reading `.brain/` efficiently. Use this reference when any skill needs to load brain context.

---

## Quick Reference: What You Need -> Where to Read

| What you need | File to read | Max tokens | Notes |
|---|---|---|---|
| Project architecture overview | `.brain/hippocampus/architecture.md` | 500 chars (~150 tokens) | Condense to first 500 chars verbatim |
| Coding conventions | `.brain/hippocampus/conventions.md` | 500 chars (~150 tokens) | Condense to first 500 chars verbatim |
| Strategic decisions | `.brain/hippocampus/decisions_log.md` | 1k tokens | Read only when architectural tasks |
| Long-term strategy | `.brain/hippocampus/strategy.md` | 1k tokens | Read only during planning phase |
| Domain knowledge (backend) | `.brain/cortex/backend/index.md` | 3k tokens | One region per task — never load all |
| Domain knowledge (frontend) | `.brain/cortex/frontend/index.md` | 3k tokens | One region per task |
| Domain knowledge (database) | `.brain/cortex/database/index.md` | 3k tokens | One region per task |
| Domain knowledge (infra) | `.brain/cortex/infra/index.md` | 3k tokens | One region per task |
| Cortex registry | `.brain/hippocampus/cortex_registry.md` | 500 tokens | Maps domains to cortex paths |
| Current task state | `.brain/working-memory/brain-state.json` | 200 tokens | Always read first |
| Circuit breaker status | `.brain/progress/brain-project-state.json` | 300 tokens | Check before execution |
| Dev context (current task) | `.brain/working-memory/dev-context-{task_id}.md` | 500 tokens | Written by brain-dev |
| Context packet (assembled) | `.brain/working-memory/context-packet-{task_id}.md` | 15-20k tokens | Written by brain-map |
| Implementation plan | `.brain/working-memory/implementation-plan-{task_id}.md` | 8-15k tokens | Written by brain-plan |
| Task completion record | `.brain/working-memory/task-completion-{task_id}.md` | 1k tokens | Written by brain-task post-step |
| Activity log | `.brain/progress/activity.md` | 500 tokens (last 5 entries) | Append-only log |
| Consultation log | `.brain/progress/consult-log.md` | 300 tokens (last 3 entries) | brain-consult audit trail |
| Sinapse details (by FTS5) | `brain.db` via SQL query | 2-3k per sinapse | Use FTS5 query below |
| Episode files | `.brain/working-memory/episode-*.md` | 500 tokens each | Pending lessons for consolidation |

---

## Loading Order

Always load brain context in this order. Earlier files are smaller and inform whether later files are needed.

```
1. State files (mandatory, ~200 tokens)
   └── .brain/working-memory/brain-state.json
   └── .brain/progress/brain-project-state.json (circuit breaker)

2. Hippocampus (foundational, ~300 tokens condensed)
   └── .brain/hippocampus/architecture.md (first 500 chars)
   └── .brain/hippocampus/conventions.md (first 500 chars)

3. Cortex (domain-specific, ~3k tokens — ONE region only)
   └── .brain/cortex/{domain}/index.md
   └── Only load the domain matching the task

4. Sinapses via FTS5 (task-specific, ~2-3k per sinapse)
   └── Query brain.db with task keywords
   └── Max 3-5 sinapses depending on skill budget

5. Working memory (task artifacts, variable size)
   └── dev-context, context-packet, implementation-plan
   └── Only load what the current step needs
```

**Rule:** Never jump to step 4 or 5 without completing steps 1-2. State and hippocampus are always loaded first because they are cheap (~500 tokens total) and determine what else is needed.

---

## Hippocampus vs Cortex

| Aspect | Hippocampus | Cortex |
|---|---|---|
| **Purpose** | Long-term strategic memory | Domain-specific technical knowledge |
| **Content** | Architecture overview, conventions, decisions, strategy | Patterns, examples, anti-patterns per domain |
| **Structure** | Flat — 5 markdown files | Hierarchical — one directory per domain |
| **Mutability** | Protected by hippocampus-guard hook — requires explicit approval | Writable via brain-document proposals + developer approval |
| **Loading** | Always loaded (Tier 1) — every skill reads hippocampus | Selective (Tier 2) — only the relevant domain |
| **Size** | Small (~500 chars each, condensed) | Medium (~3k tokens per region) |
| **Who writes** | brain-health (consolidation) with developer approval | brain-document (proposals) with developer approval |
| **Files** | `architecture.md`, `conventions.md`, `decisions_log.md`, `strategy.md`, `cortex_registry.md` | `{domain}/index.md` per domain (backend, frontend, database, infra) |

**Key insight:** Hippocampus is the "what we decided" layer. Cortex is the "how we do it" layer. A subagent receiving a context packet gets both — hippocampus tells it the rules, cortex tells it the patterns.

---

## FTS5 Search Query Example

When you need to find relevant sinapses by keyword (used by brain-map Tier 2, brain-consult Research mode):

```sql
-- Direct activation: keyword match via FTS5
-- Replace {keywords} with space-separated terms from the task
-- Example: 'auth token refresh'
SELECT s.id, s.title, s.content, s.tags, s.weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{keywords}'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 3
```

**Scoring formula:** 60% sinapse weight (proven patterns rank higher) + 40% FTS5 text relevance (matching content ranks higher). This balances established knowledge with task-specific relevance.

**Spreading activation** (used by brain-map only):

```sql
-- After direct activation, collect tags from results and find connected sinapses
SELECT id, title, content, tags, weight
FROM sinapses
WHERE id NOT IN ({direct_activation_ids})
  AND (tags LIKE '%{tag1}%' OR tags LIKE '%{tag2}%' OR tags LIKE '%{tag3}%')
  AND region LIKE '%{domain}%'
ORDER BY weight DESC
LIMIT 2
```

**Fallback** (when FTS5 returns < 2 results or FTS5 tables do not exist):

```sql
SELECT id, title, content, tags, weight
FROM sinapses
WHERE region LIKE '%{domain}%'
ORDER BY weight DESC
LIMIT 5
```

**Hebbian tracking** (after loading sinapses — maintains usage statistics):

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({loaded_sinapse_ids});
```

Exclude hippocampus sinapses from tracking (they are always loaded, tracking adds noise).

---

## Working Memory File Locations

All transient task artifacts live in `.brain/working-memory/`. These files are created during pipeline execution and archived or cleaned up after task completion.

| File pattern | Created by | Consumed by | Lifecycle |
|---|---|---|---|
| `brain-state.json` | All skills | All skills | Persistent — updated at every checkpoint |
| `dev-context-{task_id}.md` | brain-dev | brain-plan, brain-map, brain-consult | Archived to `progress/completed-contexts/` after task |
| `context-packet-{task_id}.md` | brain-map | brain-task, brain-plan | Archived after task |
| `implementation-plan-{task_id}.md` | brain-plan | brain-task | Archived after task |
| `task-completion-{task_id}.md` | brain-task | brain-document, brain-health | Persists until consolidation |
| `sinapse-updates-{task_id}.md` | brain-document | brain-health, developer | Persists until approved/rejected |
| `sinapse-review-{task_id}.md` | brain-document | Developer | Persists until review complete |
| `episode-*.md` | brain-task, brain-consult, brain-document | brain-health | Processed during consolidation |
| `consult-{timestamp}.json` | brain-consult | Thread continuation, brain-health | 10 min TTL for threads, 50 max cap |
| `lesson-update-PROPOSAL-*.md` | brain-health | Developer | Persists until approved/rejected |

**Archive location:** `.brain/progress/completed-contexts/` — context packets and implementation plans move here after task completion.

**Cleanup rules:**
- `consult-*.json` files: auto-pruned when count exceeds 50 (oldest first)
- `episode-*.md` files: processed and removed during consolidation
- `dev-context-*.md`, `context-packet-*.md`, `implementation-plan-*.md`: archived by brain-task post-step
