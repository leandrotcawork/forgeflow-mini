---
name: brain-consult
description: Brain-informed consultation — answers questions using brain context (sinapses, conventions) without full task orchestration. The default skill for non-implementation questions like "how should I...", "why is this...", "what approach for...", "explain...", "compare...", "what does X do...", "remind me...". Supports quick answers, doc research (Context7/WebSearch), and multi-model consensus (Claude + Codex via --consensus flag).
---

# brain-consult -- Brain-Informed Consultation

Answer questions with brain knowledge. No pipeline overhead. No context files. No implementation.

## When to Use

Use brain-consult when the developer asks a **question** -- not an implementation task:

- "How should I structure the auth flow?" -> consult (Quick or Research)
- "Why is this 401 error happening?" -> consult (Research)
- "What's the right endpoint for product listing?" -> consult (Research)
- "Which approach is better: X or Y?" -> consult (Quick or --consensus)
- "Remind me how we handle tenant isolation" -> consult (Quick)
- "What does the ML API documentation say about rate limits?" -> consult (Research)

Do NOT use for:
- "Implement the auth flow" -> /brain-task (implementation)
- "Fix the 401 bug" -> /brain-task (implementation + debugging)
- "Add a new endpoint" -> /brain-task (implementation)

**Rule of thumb:** If the answer requires writing or modifying code files, it is a brain-task. If the answer is knowledge, guidance, or analysis, it is brain-consult.

## Token Budget

| Mode | Budget | Context |
|------|--------|---------|
| Quick | 3-6k | Tier 1A only (~1k), expand to 1B if needed |
| Research | 12-20k | Tier 1 + FTS5 Tier 2 + external docs |
| Consensus | 15-25k | Tier 1 + FTS5 Tier 2 + Codex analysis |

---

## EXECUTE THESE STEPS NOW

### Pre-Step: Pipeline Check (absorbed from brain-aside)

Check `.brain/working-memory/brain-state.json`:
- Read `current_pipeline_step` and `last_task_id`
- If `current_pipeline_step > 0`: note that a brain-task pipeline is active. At the END of this consultation response, append:

```
---
⚠️  Brain pipeline active: Task {last_task_id} paused at Step {current_pipeline_step}.
Resume when ready: /brain-task --resume
```

- If `current_pipeline_step == 0` or file doesn't exist: no note needed. Proceed normally.

This pipeline check is built into brain-consult. Use brain-consult for any question during an active pipeline.

### Step 0.5: Read dev-context (if routed from brain-dev)

If a `task_id` was passed from brain-dev routing:
1. Read `.brain/working-memory/dev-context-{task_id}.md`
2. Extract `## Previous Task` section if present
3. Use this context throughout the consultation

If no task_id was passed (direct /brain-consult invocation): skip this step.

---

### Step 1: Pipeline Check + Question Analysis

**1a.0: Set current_skill (direct invocation guard, NEW in v1.2.0)**

If brain-consult was invoked directly (not via brain-dev routing):
- Read brain-state.json
- If `current_skill` is null or missing: set `current_skill: "brain-consult"`
- This ensures the routing guard hook is active even for direct invocations

If brain-consult was routed via brain-dev: `current_skill` is already set to `"brain-consult"` by brain-dev. No action needed.

**Note:** If brain-consult is invoked during an active brain-task pipeline (e.g., developer asks a question mid-task), `current_skill` will be `"brain-task"`. Do NOT overwrite it — brain-task needs it to remain `"brain-task"` so its writes aren't blocked. The routing guard already allows all writes when `current_skill` is `"brain-task"`, so brain-consult's own writes (consult-*.json, consult-log.md) are permitted.

**1a: Check active pipeline**

- Pipeline state already read in Pre-Step — use its result. If pipeline is active, the resume reminder will be appended at the end of the response (Step 6e).

**1b: Check conversation thread**

Scan `.brain/working-memory/` for `consult-*.json` files:
- If a file exists from the **last 10 minutes** AND its `domain` matches the inferred domain of the current question: this is a **thread continuation**.
- Read the prior file's `question` and `answer_summary` fields (~200-500 tokens).
- Include as thread context — this avoids re-loading the same sinapses.
- If the prior file is > 10 minutes old or domain doesn't match: fresh consultation, no thread.

**1c: Infer domain**

Parse the question for domain signals:

```
backend:     API, endpoint, handler, adapter, service, query, tenant, auth, middleware, route
frontend:    component, page, hook, state, render, CSS, UI, layout, form, button
database:    migration, schema, index, query, constraint, SQL, table, column, relation
infra:       deploy, pipeline, Docker, CI, environment, config, monitoring, container
analytics:   metrics, dashboard, events, aggregation, reporting, tracking
cross-domain: architecture, integration, auth flow, event system, patterns, cross-cutting
```

If no domain signal detected:
1. Check `brain-state.json` for `last_task_id` domain
2. Check last 3 entries in `.brain/progress/consult-log.md`
3. Use the most recent domain as default

**1d: Detect vague questions**

If the question has fewer than 5 meaningful words AND no domain signal (e.g., "it isn't working", "help", "what's wrong"):

Check context sources in order:
1. `active_context_files` from `brain-state.json` -> "Are you asking about your current task [{task_description}]?"
2. Most recent `task-completion-*.md` in `.brain/working-memory/` -> "Is this related to [{recent_task}]?"
3. Most recent `consult-*.json` (thread) -> "Continuing from our discussion about [{prior_question}]?"
4. If still no signal: ask ONE focused clarifying question:
   "What specifically isn't working? (e.g., which file, which error, which feature)"

Do NOT proceed without a domain or topic. Vague consultations waste tokens.

**1e: Select mode**

```
IF --quick flag:      mode = Quick
ELSE IF --research flag:   mode = Research
ELSE IF --consensus flag:  mode = Consensus
ELSE:
  Quick signals:      "what is", "where is", "how do we", "remind me",
                      "which file", "what does [X] do", "explain [internal]"

  Research signals:   "how to [external tech]", "why is this error",
                      "what's the right endpoint", "latest version",
                      "API for", "documentation", "best practice for [library]",
                      question contains a library/framework name

  If clear Quick signal detected:  mode = Quick
  If clear Research signal detected: mode = Research
  If uncertain / ambiguous:        mode = Research (safe default — better
                                   to over-research than under-inform)
```

Consensus is NEVER auto-selected. Only via explicit `--consensus` flag.

**Output (compact, single line):**
```
[Brain] Consult ({mode}) | Domain: {domain} | Loading context...
```

---

### Step 2: Load Brain Context

**All modes -- Tier 1A (always loaded, ~1-1.5k tokens):**

1. Read `.brain/hippocampus/architecture.md` -- condense to key patterns (~300 chars)
2. Read `.brain/hippocampus/conventions.md` -- condense to relevant rules (~300 chars)
3. Lesson knowledge is now embedded in sinapse content (`## Lessons Learned` sections) and loaded naturally through sinapse retrieval. No separate lesson query needed.
4. Read active task summary from `.brain/working-memory/brain-state.json` (if pipeline active)
5. Include thread context from prior `consult-*.json` (if thread continuation detected in Step 1b)

**Quick mode only -- Tier 1B expansion (if confidence is low):**

Confidence is low when:
- (a) The loaded sinapse's domain doesn't match the inferred domain
- (b) The question contains keywords not found in condensed hippocampus content
- (c) No thread context exists and the question references prior work ("the thing we discussed", "that endpoint")

If any of (a), (b), (c) are true, expand to Tier 1B:

- Lesson knowledge is now embedded in sinapse content (`## Lessons Learned` sections) and loaded naturally through sinapse retrieval. No separate lesson query needed.
- Last 3 entries from `.brain/progress/consult-log.md`

**Research + Consensus modes -- Tier 2 via FTS5 (~4-8k additional tokens):**

Extract 2-3 keywords from the question. Query brain.db using FTS5:

```sql
SELECT s.id, s.title, s.content, s.tags, s.weight,
       rank AS fts_rank
FROM sinapses_fts
JOIN sinapses s ON s.rowid = sinapses_fts.rowid
WHERE sinapses_fts MATCH '{extracted_keywords}'
ORDER BY (s.weight * 0.6) + (rank * -0.4) DESC
LIMIT 3
```

- 60% sinapse weight, 40% FTS5 text relevance — prioritizes proven patterns but surfaces relevant ones
- Falls back to structured query if FTS5 returns < 2 results:
  ```sql
  SELECT id, title, content, tags, weight
  FROM sinapses
  WHERE region LIKE '%{domain}%'
  ORDER BY weight DESC
  LIMIT 3
  ```
- Also falls back if FTS5 tables don't exist (old brain without v0.7.0 upgrade)

Lesson knowledge is now embedded in sinapse content (`## Lessons Learned` sections) and loaded naturally through sinapse retrieval. No separate lesson query needed.

**Track sinapse usage (Hebbian learning, NEW in v1.2.0):**

After FTS5 Tier 2 sinapses are loaded (Research + Consensus modes only), update access tracking:

```sql
UPDATE sinapses
SET last_accessed = '{ISO8601_now}',
    usage_count = usage_count + 1
WHERE id IN ({loaded_sinapse_ids});
```

Tier 1A/1B hippocampus sinapses are excluded from tracking (same rule as brain-map).

**Important:** Do NOT create any files in `.brain/working-memory/` during context loading. Context is assembled in-memory only. brain-consult writes up to four post-response artifacts: audit JSON (`consult-*.json`), log entry (`consult-log.md`), episode file (`episode-consult-*.md`, when warranted), and `brain-state.json` updates.

---

### Step 3: External Research (Research mode only)

If mode is Research, perform external lookups. Maximum 3 MCP calls total. Stop as soon as the question is answered.

**Decision tree for tool selection:**

```
Question mentions a specific library/framework?
  YES -> Context7:
         1. resolve-library-id (identify the library)
         2. query-docs (get relevant documentation)
         Stop if answer found.

Question asks about API endpoints, error codes, current versions?
  YES -> WebSearch:
         Search for: "{library/service} {specific question}"
         Stop if answer found.

Question asks about best practices or patterns?
  YES -> WebSearch:
         Search for: "{topic} best practices 2026"
         Stop if answer found.
```

**Research rules:**
- Max 3 MCP calls total across all tools
- Stop at clarity -- if Call 1 answers the question, do NOT make Call 2
- Prefer authoritative sources first: Context7 docs before WebSearch
- If a call returns no useful results, note `[No external data found for {query}]` and proceed with brain context only
- Never hallucinate documentation -- if you cannot find it, say so

---

### Step 4: Codex Consultation (Consensus mode only)

Only executes when `--consensus` flag is explicitly passed. Never auto-triggered.

**4a: Claude forms its answer FIRST** using the brain context loaded in Step 2.

**4b: Dispatch to Codex for independent analysis:**

```
mcp__codex__codex(
  prompt: "Project context (from brain knowledge system):
    Architecture: [condensed architecture summary]
    Conventions: [key conventions]
    Domain: {domain}

    Developer question: {user_question}

    Provide your analysis and recommendation. Be specific.
    If you disagree with conventional approaches, explain why.",
  sandbox: "read-only"
)
```

**4c: Compare perspectives:**
- If perspectives align: present unified answer with confidence note
- If perspectives diverge: present both with reasoning, let developer decide
- Never suppress disagreement -- genuine divergence is a valuable signal

**4d: Handle unavailability:**
- If Codex MCP is unavailable or times out: proceed with Claude-only answer
- Note: `[Codex unavailable -- single-model response]`

---

### Step 5: Synthesize and Respond

**Previous Task awareness:**

If the dev-context (routed from brain-dev) contains a `## Previous Task` section:
1. **Acknowledge the previous work** at the start of your response: "I see you just implemented {description}, changing {files}."
2. **Focus your answer** on those specific files and patterns — not generic domain advice.
3. **Use test results** to guide debugging: "The 2 failed tests ({test names}) suggest the issue is in {area}."

If no `## Previous Task` section: respond normally using domain sinapses.

This costs zero extra tokens — brain-dev already loaded the context.

---

**Quick mode output:**

```
[Brain] Consult (quick) | Domain: {domain}

{Direct answer using brain context}

{Reference relevant sinapses inline:}
Per [[sinapse-id]]: {how this applies}

---
Brain context: Tier {1A or 1A+1B} ({N} sinapses, domain: {domain})
```

**Research mode output:**

```
[Brain] Consult (research) | Domain: {domain}

{Answer synthesizing brain knowledge with external research}

### From Brain Context
- [[sinapse-id]]: {relevant pattern or convention}

### From External Documentation
- {Finding 1} -- source: {Context7 library / WebSearch URL}
- {Finding 2} -- source: {URL}

---
Brain context: Tier 1+2 ({N} sinapses) + {K} external lookups
```

**Consensus mode output:**

```
[Brain] Consult (consensus) | Domain: {domain} | Models: Claude + Codex

### Claude Assessment (with brain context)
{Claude's answer referencing sinapses}

### Codex Assessment
{Codex's independent analysis}

### Synthesis
- **Agreement:** {areas where both models align}
- **Divergence:** {areas of disagreement, if any}
- **Recommendation:** {synthesized recommendation with reasoning}

---
Brain context: Tier 1+2 ({N} sinapses) | Consensus: {aligned/divergent}
```

---

### Step 6: Post-Response Actions

**6a: Write audit JSON (always)**

Write `.brain/working-memory/consult-{timestamp}.json`:

```json
{
  "timestamp": "{ISO8601}",
  "mode": "{quick|research|consensus}",
  "domain": "{domain}",
  "question": "{user question}",
  "answer_summary": "{2-3 sentence summary of the answer}",
  "context_loaded": {
    "tier": "{1A|1A+1B|1A+2|1A+1B+2}",
    "sinapse_ids": ["{loaded sinapse IDs}"],
    "external_sources": ["{Context7:lib-name or WebSearch:query}"]
  },
  "confidence": "{high|medium|low}",
  "thread_parent": "{filename of prior consult JSON, or null}"
}
```

Timestamp format for filename: `consult-YYYY-MM-DDTHH-MM-SSZ.json` (colons replaced with hyphens for filesystem safety).

If `.brain/working-memory/` has > 50 `consult-*.json` files, auto-prune the oldest before writing new one.

**6b: Log to consult-log.md (always)**

Append one row to `.brain/progress/consult-log.md`:

```markdown
| {timestamp} | {mode} | {domain} | {question summary, max 50 chars} | {confidence} | {thread_parent filename or --} |
```

If `consult-log.md` doesn't exist, create it with header:
```markdown
## Consultation Log

| Timestamp | Mode | Domain | Question | Confidence | Thread |
|---|---|---|---|---|---|
```

**6c: Auto-capture episode (when warranted)**

If the consultation revealed:
- A failure pattern not in existing knowledge
- A correction to what the developer believed
- A new anti-pattern discovered during research
- A significant insight about project architecture

Write `.brain/working-memory/episode-consult-{timestamp}.md`:

```yaml
---
type: episode
task_id: consult-{timestamp}
domain: {domain}
severity: {estimated: low|medium|high|critical}
trigger: consultation
tags: ["{extracted from Q&A}"]
sinapses_loaded: ["{sinapse IDs used in answer}"]
related_completion: null
created_at: {ISO8601}
---

## What Happened
{what the developer believed or was doing wrong}

## What Worked
{the correct answer from the consultation}

## Files Involved
{if any files were discussed, otherwise omit}
```

brain-consolidate will process this episode and propose a sinapse update during the next consolidation cycle.

**6d: Suggest escalation (when warranted)**

If the answer requires implementation:
```
---
This question is evolving into implementation work.
  Suggested: /brain-task "{suggested task description}"
  Estimated: {Haiku (trivial) / Sonnet (medium) / Codex (complex)}
```

If the question is actually an architectural decision:
```
---
This is an architectural decision that would benefit from structured analysis.
  Suggested: /brain-mckinsey "{decision description}"
```

**6e: Pipeline resume reminder (when applicable)**

If `brain-state.json` shows `current_pipeline_step > 0`:
```
Brain pipeline was at Step {N} for task {task_id}. Continue with /brain-task --resume
```

**6f: Restore current_skill (NEW in v1.2.0)**

If brain-consult set `current_skill: "brain-consult"` in Step 1a.0 (direct invocation):
→ Set `current_skill: null` in brain-state.json. brain-consult's job is done.

If brain-consult was invoked during an active pipeline (current_skill was already `"brain-task"` or `"brain-plan"`):
→ Do NOT clear current_skill. The owning skill still needs it.

---

## Command Format

```
/brain-consult "question"
/brain-consult --quick "question"
/brain-consult --research "question"
/brain-consult --consensus "question"
/brain-consult --domain backend "question"
```

Flags:
- `--quick`: Force Quick mode (Tier 1A/1B only, no external research)
- `--research`: Force Research mode (Tier 1 + FTS5 Tier 2 + Context7/WebSearch)
- `--consensus`: Force Consensus mode (adds Codex independent analysis)
- `--domain {domain}`: Override domain inference (backend/frontend/database/infra/analytics/cross-domain)

---

## Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Behavior |
|---|---|---|
| Creating context-packet files | brain-consult is ephemeral | Context in-memory; up to four post-response artifacts persist: audit JSON, consult-log entry, episode file (when warranted), and brain-state.json updates |
| Invoking brain-map as sub-skill | Too heavy, loads 5+2 sinapses | Inline Tier 1A/1B + FTS5 Tier 2 (max 3) |
| Invoking brain-dev for simple questions | Overkill for consultation | Direct execution — brain-consult is self-contained |
| Answering without brain context | Defeats the purpose of brain-informed consultation | Always load Tier 1A minimum |
| More than 3 MCP calls in Research | Diminishing returns | Stop at clarity after first authoritative answer |
| Forcing Codex when unavailable | Blocks response | Fall back Claude-only with note |
| Skipping episode capture on corrections | Loses learning opportunity | Always write episode file when a correction is identified |
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
| FTS5 tables don't exist | Fall back to LIKE queries on tags + region. Note: `[FTS5 unavailable -- basic retrieval]` |
| No sinapses match | Answer with hippocampus + sinapses only. Note: `[No matching sinapses]` |
| Context7/WebSearch unavailable | Proceed brain context only. Note: `[External research unavailable]` |
| Codex MCP unavailable (--consensus) | Proceed Claude-only. Note: `[Codex unavailable -- single-model response]` |
| Vague question, no context anywhere | Ask ONE focused clarifying question |
| Thread parent JSON corrupted | Ignore thread, fresh consultation |
| >50 consult-*.json in working-memory | Auto-prune oldest before writing new one |

---

## Relationship to Other Skills

| Skill | Relationship |
|---|---|
| **brain-aside** | Deleted. brain-aside was absorbed into brain-consult Pre-Step in v0.9.0 and fully removed in v0.9.1. Pipeline check lives in brain-consult Pre-Step. |
| **brain-dev** | Not invoked. brain-consult skips the router entirely. If consultation reveals need for implementation, suggest /brain-task (which goes through brain-dev). |
| **brain-map** | Not invoked as sub-skill. brain-consult does its own lightweight inline context loading (Tier 1A/1B + FTS5 Tier 2). brain-map's full 3-tier loading with context-packet generation is overkill for consultation. |
| **brain-task** | Escalation target. When consultation evolves into implementation, suggest /brain-dev for full routing. |
| **brain-lesson** | Deleted. brain-consult writes episode files directly to working-memory. brain-consolidate processes them into sinapse updates. |
| **brain-mckinsey** | Escalation target for high-stakes architectural decisions. If question is "should we adopt X for our entire stack?", suggest /brain-mckinsey. |
| **brain-consolidate** | Secondary cleanup path for consult-*.json files. Primary cleanup is automatic via sessionEnd hook (7-day TTL + 50 max cap). brain-consolidate remains a fallback for missed cleanups. |

---

**Created:** 2026-03-27 | **Agent Type:** Consultant | **Skill Count:** 14
