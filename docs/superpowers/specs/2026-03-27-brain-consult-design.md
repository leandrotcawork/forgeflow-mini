# brain-consult — Brain-Informed Consultation Skill

**Date:** 2026-03-27
**Status:** Approved design, pending implementation
**Version target:** v0.7.0
**Skill count:** 15 → 16

---

## Problem

There is a gap between brain-aside (no context, just Q&A) and brain-task (full 6-step pipeline). Developers implementing features constantly ask questions — "why is this 401?", "what endpoint?", "which approach?" — that:

- Are too simple for brain-task (don't need verification, archival, context files)
- Are too important for brain-aside (need brain knowledge — sinapses, conventions, lessons)
- Sometimes need external doc lookup (Context7, WebSearch)
- Could benefit from multi-model consensus (Claude + Codex)
- Often come in sequences about the same topic (multi-turn consultation)

brain-consult fills this gap: load brain context, answer the question, capture learnings, move on.

---

## Architecture Overview

```
Developer question
       |
       v
+--------------------------------------------------+
|              brain-consult                        |
|                                                   |
|  Step 1: Analyze question + check thread          |
|     +-- recent consult JSON? -> include as thread |
|     +-- active pipeline? -> note for resume       |
|     +-- infer domain, select mode                 |
|                                                   |
|  Step 2: Load brain context                       |
|     +-- Quick: Tier 1A (~1k) -> expand to 1B     |
|        if confidence low                          |
|     +-- Research/Consensus: Tier 1 + FTS5 Tier 2  |
|                                                   |
|  Step 3: External research (Research only)        |
|     +-- Context7 / WebSearch, max 3 calls         |
|                                                   |
|  Step 4: Codex consultation (--consensus only)    |
|     +-- opt-in, never auto-selected               |
|                                                   |
|  Step 5: Synthesize + respond                     |
|                                                   |
|  Step 6: Post-response                            |
|     +-- consult-log.md (separate from activity)   |
|     +-- consult-{ts}.json (audit, 7-day TTL)      |
|     +-- suggest /brain-lesson if learning found   |
|     +-- suggest /brain-task if impl needed        |
|     +-- pipeline resume reminder if applicable    |
+--------------------------------------------------+
```

### Skill Boundaries

| Skill | Role | Never does |
|---|---|---|
| brain-aside | Pipeline interrupt handler (state save/restore) | Load brain context |
| brain-consult | Knowledge consultation (context + answer) | Write code, create context-packet files |
| brain-task | Implementation pipeline (6 steps) | Skip verification/archival |
| brain-mckinsey | Strategic analysis (scoring + parallel research) | Answer quick questions |

---

## Modes of Operation

Three modes, auto-selected with confidence gate, flag-overridable:

| Mode | Token Budget | Context | External | Codex | When |
|---|---|---|---|---|---|
| **Quick** | 3-6k | Tier 1A (~1k), expand to 1B if needed | None | No | Clear simple question |
| **Research** | 12-20k | Tier 1 + FTS5 Tier 2 (~4-8k) | Context7/WebSearch (max 3 calls) | No | Needs docs, API details, error analysis |
| **Consensus** | 15-25k | Tier 1 + FTS5 Tier 2 | Optional | Yes | Explicit `--consensus` flag only |

### Mode Auto-Selection

```
Parse question
       |
       v
  Clear Quick signal?  --yes-->  Quick mode
  ("remind me", "which file",
   "what does X do", "explain
   [internal concept]")
       | no
       v
  Clear Research signal?  --yes-->  Research mode
  ("how to [external tech]",
   "error", "endpoint", "docs",
   "API", "version", library name)
       | no
       v
  Uncertain / ambiguous  ------>  Research mode (safe default)
```

Consensus is NEVER auto-selected. Only via explicit `--consensus` flag.

### Flag Overrides

- `--quick` — force Quick mode
- `--research` — force Research mode
- `--consensus` — force Consensus mode (adds Codex analysis)
- `--domain {x}` — override inferred domain

---

## Context Loading

### Tier 1A (~1-1.5k tokens) — Quick mode default

- Condensed `architecture.md` (~300 chars)
- Condensed `conventions.md` (~300 chars)
- 1 most relevant lesson (highest weight, status `active|promotion_candidate|promoted`)
- Active task summary from `brain-state.json` (if pipeline active)
- Thread context from recent `consult-*.json` (if within 10 min, same domain)

### Tier 1B (~3-4k tokens) — Quick mode expansion

Triggers when Tier 1A confidence is low. Confidence is low when: (a) the loaded lesson's domain doesn't match the inferred domain, (b) the question contains keywords not found in condensed hippocampus content, or (c) no thread context exists and the question references prior work ("the thing we discussed", "that endpoint").

- Full Tier 1A +
- 2 additional lessons (total 3, status `active|promotion_candidate|promoted`)
- Last 3 entries from `consult-log.md`

### Tier 2 via FTS5 (~4-8k tokens) — Research and Consensus modes

```sql
SELECT s.id, s.title, s.content, s.tags, s.weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{extracted_keywords}'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 3
```

- 60% sinapse weight, 40% FTS5 text relevance
- Falls back to `WHERE region LIKE '%{domain}%' ORDER BY weight DESC LIMIT 3` if FTS5 returns < 2 results

### Lesson Retrieval (all modes)

```sql
SELECT id, title, severity, tags, evidence, confidence
FROM lessons
WHERE domain = '{domain}'
  AND status IN ('active', 'promotion_candidate', 'promoted')
ORDER BY weight DESC
LIMIT {1 for Tier 1A, 3 for Tier 1B and above}
```

### Vague Question Context Sources (checked in order)

1. `active_context_files` from `brain-state.json` (if pipeline active)
2. Most recent `task-completion-*.md` (if exists)
3. Most recent `consult-*.json` (thread continuation)
4. Ask ONE focused clarifying question (last resort)

---

## FTS5 Infrastructure (System-Wide Upgrade)

### New Virtual Tables

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS sinapses_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    tags,
    content=sinapses,
    content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS lessons_fts USING fts5(
    id UNINDEXED,
    title,
    tags,
    evidence,
    content=lessons,
    content_rowid=rowid
);
```

### build_brain_db.py Changes

After populating `sinapses` and `lessons` tables:

```sql
INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild');
INSERT INTO lessons_fts(lessons_fts) VALUES('rebuild');
```

### Consumers Updated

| Skill | Current Query | FTS5 Upgrade |
|---|---|---|
| **brain-consult** | (new) | Tier 2: `MATCH` keywords, scored by `weight * 0.6 + rank * -0.4` |
| **brain-map** | `WHERE region LIKE '%{domain}%' ORDER BY weight DESC LIMIT 5` | Hybrid: domain filter + FTS5 boost for task-related keywords. Falls back to current query if no keywords |
| **brain-consolidate** | Groups lessons by `domain + tags` | Uses `lessons_fts MATCH` to find semantically related lessons |
| **brain-status** | Full scan for health metrics | Can surface "most relevant sinapses for current work" |

### Backward Compatibility

- FTS5 tables are additive — existing queries still work unchanged
- If FTS5 tables don't exist (old brain), skills fall back to current LIKE queries
- `build_brain_db.py` detects SQLite FTS5 support and skips if unavailable
- `brain-init --upgrade` rebuilds FTS tables from existing data

---

## Conversation Threading

### Thread Detection (time-based, lightweight)

- Before loading context, check `.brain/working-memory/` for `consult-*.json` files
- If a file exists from the **last 10 minutes** in the **same domain**: thread continuation
- Include `question + answer_summary` from prior JSON (~200-500 tokens) as additional context
- Thread resets automatically after 10 min gap or domain change

### Audit JSON Format

File: `.brain/working-memory/consult-{timestamp}.json`

```json
{
  "timestamp": "2026-03-27T14:30:00Z",
  "mode": "research",
  "domain": "backend",
  "question": "Why is the Mercado Livre API returning 401?",
  "answer_summary": "Token refresh needed — ML uses OAuth2 with 6h expiry...",
  "context_loaded": {
    "tier": "1A+2",
    "sinapse_ids": ["sinapse-backend-auth", "sinapse-backend-adapters"],
    "lesson_ids": ["lesson-00042"],
    "external_sources": ["Context7:mercadolibre-sdk"]
  },
  "confidence": "high",
  "thread_parent": null
}
```

### Follow-up Example (same thread, 3 min later)

```json
{
  "timestamp": "2026-03-27T14:33:00Z",
  "mode": "quick",
  "domain": "backend",
  "question": "What about the token refresh endpoint?",
  "answer_summary": "Use POST /oauth/token with grant_type=refresh_token...",
  "context_loaded": {
    "tier": "1A",
    "sinapse_ids": [],
    "lesson_ids": [],
    "external_sources": []
  },
  "confidence": "high",
  "thread_parent": "consult-2026-03-27T14-30-00Z.json"
}
```

Thread follow-ups load zero sinapses when the prior answer already contains the context. This is the token savings.

### TTL Cleanup

- `brain-consolidate` cleans `consult-*.json` files older than 7 days
- If `.brain/working-memory/` has > 50 consult files, auto-prune oldest

### Consultation Log

Separate file: `.brain/progress/consult-log.md`

```markdown
## Consultation Log

| Timestamp | Mode | Domain | Question | Confidence | Thread |
|---|---|---|---|---|---|
| 2026-03-27T14:30 | research | backend | ML API 401 error | high | -- |
| 2026-03-27T14:33 | quick | backend | Token refresh endpoint | high | ^ thread |
```

This is separate from `activity.md` to avoid polluting task analytics.

---

## Escalation Rules

| Signal | Escalation |
|---|---|
| Answer requires writing/modifying code | `-> /brain-task "{description}"` |
| Architectural decision with multiple stakeholders | `-> /brain-mckinsey "{description}"` |
| Debugging evolving into root cause analysis | `-> /brain-task --debug "{description}"` |
| Question is actually a feature request | `-> /brain-task "{description}"` |

Escalation format (compact, appended at end of response):

```
---
This question is evolving into implementation work.
  Suggested: /brain-task "implement ML OAuth2 token refresh"
  Estimated: Sonnet (medium complexity)
```

---

## Trigger Deconfliction

| Question type | Routes to | Why |
|---|---|---|
| "How should I structure auth?" | brain-consult | Question, not implementation |
| "Implement the auth flow" | brain-decision -> brain-task | Implementation verb |
| "Fix the 401 bug" | brain-decision -> brain-task | Implementation verb ("fix") |
| "Why is this 401 happening?" | brain-consult (Research) | Question about error |
| "Should we use REST or GraphQL?" | brain-consult (Quick or --consensus) | Comparison question |
| "Monolith vs microservices for our scale" | brain-mckinsey | High-stakes strategic |
| (mid-pipeline) "What's that function called?" | brain-aside | Pipeline interrupt, no context needed |

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Behavior |
|---|---|---|
| Creating context-packet files | brain-consult is ephemeral | Context in-memory, only audit JSON persists |
| Invoking brain-map as sub-skill | Too heavy, loads 5+2 sinapses | Inline Tier 1A/1B + FTS5 Tier 2 (max 3) |
| Invoking brain-decision | Skipping the router is the whole point | Direct execution |
| Answering without brain context | Same failure as brain-aside | Always load Tier 1A minimum |
| More than 3 MCP calls in Research | Diminishing returns | Stop at clarity after first authoritative answer |
| Forcing Codex when unavailable | Blocks response | Fall back Claude-only with note |
| Creating lesson files directly | Violates brain-lesson ownership | Suggest `/brain-lesson`, never create |
| Starting implementation | Scope creep into brain-task | Suggest escalation, never write code |
| Auto-selecting Consensus | Too slow, overlaps mckinsey | Only via `--consensus` flag |
| Defaulting to Quick when uncertain | False confidence | Default to Research when uncertain |
| Logging to activity.md | Pollutes task analytics | Separate `consult-log.md` |
| Loading stale thread context | Irrelevant noise | 10 min TTL, domain must match |

---

## Failure Scenarios

| Scenario | Action |
|---|---|
| brain.db missing or corrupt | Read hippocampus `.md` files directly. Note: `[brain.db unavailable]` |
| FTS5 tables don't exist | Fall back to LIKE queries. Note: `[FTS5 unavailable — basic retrieval]` |
| No sinapses match | Answer with hippocampus + lessons only. Note: `[No matching sinapses]` |
| Context7/WebSearch unavailable | Proceed brain context only. Note: `[External research unavailable]` |
| Codex MCP unavailable (--consensus) | Proceed Claude-only. Note: `[Codex unavailable — single-model response]` |
| Vague question, no context anywhere | Ask ONE focused clarifying question |
| Thread parent JSON corrupted | Ignore thread, fresh consultation |
| >50 consult-*.json in working-memory | Auto-prune oldest before writing new one |

---

## Files Touched

| File | Change |
|---|---|
| `skills/brain-consult/SKILL.md` | **New** — full skill spec |
| `skills/brain-aside/SKILL.md` | Update description for trigger disambiguation |
| `skills/brain-map/SKILL.md` | Add FTS5 hybrid queries alongside existing |
| `skills/brain-consolidate/SKILL.md` | Add consult-*.json TTL cleanup + FTS5 lesson grouping |
| `skills/brain-status/SKILL.md` | Add consultation stats section |
| `docs/brain-db-schema.sql` | Add FTS5 virtual tables |
| `docs/brain-db-schema.md` | Document FTS5 tables |
| `scripts/build_brain_db.py` | Populate FTS5 indexes on build |
| `README.md` | Add brain-consult row, update skill count 15 -> 16 |
| `CHANGELOG.md` | v0.7.0 entry |

---

## Design Decisions Log

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Consensus mode selection | Opt-in only (`--consensus`) | Avoids overlap with brain-mckinsey, keeps consultation fast |
| 2 | Consultation logging | Separate `consult-log.md` | Prevents task analytics pollution in activity.md |
| 3 | Quick mode context | Tier 1A/1B split (~1k lean, expand if needed) | Optimizes token usage for simple questions |
| 4 | Uncertain mode selection | Default to Research | Better to over-research than under-inform |
| 5 | Audit trail | Tiny JSON + 7-day TTL cleanup | Debugging + thread continuity without clutter |
| 6 | Sinapse retrieval | FTS5 scored formula (weight * 0.6 + rank * -0.4) | Semantic matching beats LIKE queries |
| 7 | Lesson status filters | Only `active\|promotion_candidate\|promoted` | Excludes archived/superseded noise |
| 8 | Vague question context | active_context_files + task-completion-*.md | Richer signal than activity.md one-liners |
| 9 | FTS5 scope | All consumers (system-wide) | Small implementation cost, system-wide benefit |
| 10 | Conversation threading | Time-based (10 min TTL, same domain) | Lightweight, no complex topic detection |
| 11 | Approach | Polished plan + lean threading | Codex-reviewed, all 8 findings addressed |

---

## Reviewed By

- **Claude (Plan phase):** Initial 3-mode design with 6-step workflow
- **Codex (Review):** 8 findings — activity pollution, keyword search scaling, Quick mode overhead, auto-selection brittleness, Consensus/mckinsey overlap, vague question fallback, lesson status filters, audit trail
- **Claude + User (Brainstorming):** Consolidated design incorporating all Codex feedback + FTS5 infrastructure + conversation threading
