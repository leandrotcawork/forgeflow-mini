# brain.db Schema Reference

Canonical schema: [`brain-db-schema.sql`](brain-db-schema.sql)

## Tables

### `sinapses` - Curated domain knowledge nodes

Each row is a markdown file from `.brain/` indexed at init time. Represents architectural patterns, conventions, cross-cutting knowledge.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | Unique identifier, derived from file path (e.g., `hippocampus-architecture`) |
| `file_path` | TEXT | Relative path from `.brain/` root |
| `title` | TEXT | Human-readable title from frontmatter |
| `region` | TEXT | Directory-based grouping: `hippocampus`, `cortex/backend`, `cortex/frontend`, `cortex/database`, `cortex/infra`, `sinapses/` |
| `tags` | TEXT (JSON) | Array of string tags for search/filtering |
| `links` | TEXT (JSON) | Array of related sinapse IDs (from frontmatter `links:` field) |
| `content` | TEXT | Full markdown content for search and condensing |
| `weight` | REAL | 0.0-1.0 relevance score. Higher = loaded first by brain-map. Adjusted by brain-consolidate (+0.02 on approval, -0.005/day decay, min 0.1) |
| `last_accessed` | TEXT | ISO8601, updated each time brain-map loads this sinapse |
| `usage_count` | INTEGER | Incremented on each load into a context packet |
| `created_at` | TEXT | ISO8601 |
| `updated_at` | TEXT | ISO8601 |

**Key queries:**
- brain-map Tier 1: `WHERE region = 'hippocampus'`
- brain-map Tier 2: `WHERE region LIKE '%{domain}%' ORDER BY weight DESC LIMIT 5`
- brain-map cross-cutting: `WHERE region LIKE 'sinapses/%' ORDER BY weight DESC LIMIT 2`

---

### `sinapse_links` - Directed edges between sinapses

Represents references between knowledge nodes. brain-map uses these for backlink enrichment (Tier 2) and on-demand expansion (Tier 3).

| Column | Type | Purpose |
|--------|------|---------|
| `source_id` | TEXT FK | The sinapse containing the reference |
| `target_id` | TEXT FK | The sinapse being referenced |

**Composite PK:** `(source_id, target_id)`

**Key queries:**
- brain-map Tier 2 backlinks: `WHERE source_id IN (tier2_ids)`
- brain-map Tier 3 expansion: `WHERE source_id IN (tier2_ids) AND target_id NOT IN (already_loaded)`

---

### `lessons` / `lessons_fts` - Dropped in v0.10.0

Lessons table dropped in v0.10.0 - lesson knowledge is embedded in sinapse `## Lessons Learned` sections.
Search and retrieval now happen through `sinapses.content` and `sinapses_fts`.

---

### `sinapses_fts` - Full-text search index for sinapses (v0.7.0)

FTS5 virtual table mirroring `sinapses` for semantic keyword retrieval. Used by brain-consult (Tier 2 scored retrieval), brain-map (hybrid queries), brain-consolidate (semantic pattern grouping across embedded `## Lessons Learned` content), and brain-status (topic relevance).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT (UNINDEXED) | Sinapse ID, not searchable but returned in results |
| `title` | TEXT | Searchable sinapse title |
| `content` | TEXT | Searchable full markdown content |
| `tags` | TEXT | Searchable tags JSON |

**Content-sync table:** mirrors data from `sinapses`. Must be rebuilt after INSERT/UPDATE:
```sql
INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild');
```

**Key queries:**
- brain-consult Tier 2: `JOIN sinapses s ON s.rowid = sinapses_fts.rowid WHERE sinapses_fts MATCH '{keywords}' ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC`
- brain-map hybrid: `JOIN sinapses s ON s.rowid = sinapses_fts.rowid WHERE sinapses_fts MATCH '{keywords}' AND s.region LIKE '%{domain}%' ORDER BY ... DESC`

**Backward compatible:** If FTS5 is unavailable, skills fall back to LIKE queries on structured fields.

---

### `consolidation_log` - Tracks brain-consolidate runs

One row per consolidation cycle. Used to determine task count "since last consolidate" for the auto-suggest threshold.

| Column | Type | Purpose |
|--------|------|---------|
| `cycle_number` | INTEGER PK (auto) | Sequential consolidation number |
| `tasks_reviewed` | INTEGER | How many tasks were processed |
| `proposals_approved` | INTEGER | Sinapse updates approved |
| `proposals_rejected` | INTEGER | Sinapse updates rejected |
| `escalations_surfaced` | INTEGER | Promotion candidates surfaced to developer |
| `sinapses_reweighted` | INTEGER | Sinapses whose weight was adjusted |
| `created_at` | TEXT | ISO8601 |
