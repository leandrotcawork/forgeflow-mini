# Context Budget Guide

Token limits per skill and subagent. These budgets prevent context exhaustion — the primary cause of agent failure in ForgeFlow Mini v1.x (avg 11.4 errors/session, 0% agent success rate).

---

## Per-Skill Token Budgets

| Skill | Input budget | Output budget | Total ceiling | Notes |
|---|---|---|---|---|
| brain-orientation | ~100 lines | N/A (injected) | 100 lines | Injected by session-start hook, not invocable |
| brain-dev | ~500-800 tokens | ~200 tokens | 1k tokens | Pure classifier — zero DB queries, zero file reads beyond state |
| brain-map | 4-5k tokens | 15-20k tokens | 25k tokens | Context assembly only — the only multi-tier loader |
| brain-plan | 15k tokens in | 8k tokens out | 23k tokens | Reads context packet + generates implementation plan |
| brain-task | 20k tokens in | Variable | 30k tokens (orchestrator) | Orchestrator budget — implementation delegated to subagent |
| brain-verify | 5k tokens in | 3k tokens out | 8k tokens | Runs tools, minimal text generation |
| brain-document | 10k tokens in | 5k tokens out | 15k tokens | Reads completion record, proposes sinapse diffs |
| brain-consult (quick) | 3-6k tokens | 2k tokens | 8k tokens | Tier 1A only, expand to 1B if confidence low |
| brain-consult (research) | 12-20k tokens | 4k tokens | 24k tokens | Tier 1 + FTS5 Tier 2 + external docs |
| brain-consult (consensus) | 15-25k tokens | 6k tokens | 31k tokens | Tier 1 + FTS5 Tier 2 + Codex analysis |
| brain-config | 5k tokens in | 3k tokens out | 8k tokens | Init wizard + config validation |
| brain-health | 15-25k tokens in | 8k tokens out | 33k tokens | Consolidation + dashboard — heaviest off-pipeline skill |

---

## Pipeline Accumulation Budget

A full pipeline (brain-dev through brain-document) accumulates context in the main session. The v2.0 target is ~890 lines in the main session, with implementation isolated in subagents.

| Pipeline stage | Incremental tokens | Cumulative (main session) |
|---|---|---|
| brain-orientation (hook) | ~100 lines | ~100 lines |
| brain-dev | ~100 lines | ~200 lines |
| brain-map | ~80 lines (status output) | ~280 lines |
| brain-plan | ~150 lines (plan summary) | ~430 lines |
| brain-task (orchestrator) | ~120 lines | ~550 lines |
| brain-verify | ~80 lines | ~630 lines |
| brain-document | ~80 lines | ~710 lines |

**Subagent budget (isolated, not accumulated):**
- Implementer: ~260 lines (prompt + plan + context packet)
- Spec reviewer: ~100 lines
- Code reviewer: ~100 lines

---

## Subagent Token Budgets

| Subagent | Prompt size | Context received | Max output | Model |
|---|---|---|---|---|
| Implementer | ~100 lines | Plan + context packet (~15-20k) | Variable (code) | Haiku/Sonnet/Codex (per score) |
| Spec reviewer | ~60 lines | Implementation + plan (~10k) | 2k tokens | Sonnet |
| Code reviewer | ~60 lines | Implementation + diff (~10k) | 2k tokens | Sonnet |

**Subagent isolation rule:** Subagents receive ONLY their prompt + the artifacts explicitly listed above. They do NOT inherit the session conversation history. This is the key mechanism that keeps the main session clean.

---

## Hard Rules

These rules are non-negotiable. Violating them leads to context exhaustion or corrupted brain state.

### 1. Hippocampus truncation at 500 characters

When loading hippocampus files (`architecture.md`, `conventions.md`), always truncate to the first 500 characters. Read the file and include the first 500 chars verbatim — do NOT summarize from memory.

**Why:** Hippocampus files are loaded by every skill in the pipeline. Without truncation, they bloat every stage. 500 chars captures the key patterns and rules; details live in cortex.

**Applies to:** brain-map (Tier 1), brain-consult (Tier 1A), any skill reading hippocampus.

### 2. One cortex region per task

Load only the cortex region matching the task domain (e.g., `.brain/cortex/backend/index.md` for a backend task). Never load multiple cortex regions in a single skill invocation.

**Why:** Each cortex region is ~3k tokens. Loading 3 regions adds ~9k tokens — nearly half of brain-plan's entire input budget. Cross-domain tasks load the primary domain in Tier 2; secondary domains are available in Tier 3 on-demand.

**Exception:** brain-health (consolidation) may read multiple regions when generating the health report, because it runs off-pipeline with its own budget.

### 3. brain-map is the only multi-tier loader

Only brain-map performs the full 3-tier loading sequence (hippocampus + cortex + FTS5 sinapses + spreading activation + on-demand Tier 3). No other skill should replicate this logic.

**Why:** Multi-tier loading is expensive (~16k tokens for Tier 1+2). If multiple skills each loaded their own context, pipeline accumulation would exceed 50k tokens before implementation starts.

**How other skills get context:**
- brain-plan reads the context packet that brain-map produced
- brain-task reads the context packet and passes it to the subagent
- brain-consult does its own lightweight inline loading (Tier 1A/1B + FTS5, max 3 sinapses)
- brain-document reads the task-completion record, not the full context packet

### 4. FTS5 query limit: 3-5 sinapses

FTS5 queries must use `LIMIT 3` (brain-consult) or `LIMIT 5` (brain-map with spreading activation). Never load more sinapses than the limit.

**Why:** Each sinapse is ~2-3k tokens. Loading 10 sinapses adds ~25k tokens — exceeding most skill budgets entirely. The scoring formula (60% weight + 40% FTS5 rank) ensures the top results are the most relevant.

### 5. No context files for brain-consult

brain-consult assembles context in-memory only. It does NOT create `context-packet-*.md` or `implementation-plan-*.md` files. Its only persistent artifacts are: `consult-*.json` (audit), `consult-log.md` (log entry), `episode-*.md` (when a lesson is discovered), and `brain-state.json` updates.

**Why:** brain-consult is ephemeral — it answers a question and exits. Creating context files would pollute working memory and confuse brain-task if a pipeline is active.

### 6. Subagent prompt budget: 100 lines max

Subagent prompts (in `skills/brain-task/prompts/`) must not exceed 100 lines for the implementer or 60 lines for reviewers. The prompt tells the subagent what to do; the context packet tells it what to know. Mixing instructions and knowledge in the prompt bloats subagent context.

### 7. Episode files: 500 tokens max each

Episode files (`.brain/working-memory/episode-*.md`) must be concise: type, date, severity, context, observation, learning, related. No multi-page narratives. brain-health (consolidation) processes potentially many episodes in a single run — verbose episodes exhaust its 25k input budget.
