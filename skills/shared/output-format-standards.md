# Output Format Standards

Standard formats for artifacts produced by brain skills. Every skill that creates these artifacts must follow these formats exactly. Subagents reading these artifacts depend on consistent structure.

---

## dev-context (written by brain-dev)

**File:** `.brain/working-memory/dev-context-{task_id}.md`

**Purpose:** Classification metadata and retrieval keywords for downstream skills. This is the handoff from brain-dev (router) to brain-plan/brain-map/brain-consult.

```yaml
---
task_id: YYYY-MM-DD-{slug}
intent: build | fix-investigate | fix-known | debug | review | question | refactor
domain: backend | frontend | database | infra | analytics | cross-domain
score: 0-100
model: haiku | sonnet | codex | opus
plan_mode: true | false
keywords: ["{kw1}", "{kw2}", "{kw3}"]
recent_task: "{last_task_id}" | null
created_at: "{ISO8601}"
---

{developer's original request, verbatim — do not paraphrase}
```

**Optional section** (appended when intent is `fix-investigate` or `debug` AND `recent_task` is set):

```markdown
## Previous Task
Description: {what was requested}
Files changed: {list of files}
Tests: {pass/fail/skip counts}
```

**Field rules:**
- `task_id`: format is `YYYY-MM-DD-{slug}`, slug is max 20 chars, kebab-case
- `score`: calculated as `15 (baseline) + domain (0-30) + risk (0-35) + type (0-20)`, capped at 100
- `keywords`: max 3, nouns and domain terms only (not verbs), used for FTS5 retrieval
- `model`: determined by score — `< 20` Haiku, `20-39` Sonnet, `40-74` Codex, `75+` Codex + plan mode. Debug intent always Opus.
- Body text after frontmatter: the developer's exact words, never paraphrased

---

## context-packet (written by brain-map)

**File:** `.brain/working-memory/context-packet-{task_id}.md`

**Purpose:** Assembled brain context for the task. Read directly by brain-task and subagents as-is — no reformatting pass.

```markdown
---
task_id: YYYY-MM-DD-{slug}
domain: backend | frontend | database | infra | cross-domain
score: 0-100
sinapses_loaded: {N}
tokens_estimated: {estimated total}
generated_at: "{ISO8601}"
---

# Context Packet -- {Task Description}

## Tier 1: Foundational (~4k tokens)

> **Content rule:** Tier 1 hippocampus content MUST be read from disk
> and inlined verbatim (first 500 chars each). Never compose from memory.
> A subagent reading this packet has no other access to hippocampus files.

### Hippocampus Context

**Architecture:**
{Verbatim first 500 chars of .brain/hippocampus/architecture.md}

**Conventions:**
{Verbatim first 500 chars of .brain/hippocampus/conventions.md}

### Task Summary

{User description, domain, risk level, type from dev-context}

## Tier 2: Domain-Specific (~10-15k tokens)

### Architecture Patterns -- {Domain}

#### Pattern 1: {Sinapse Title}
**Weight:** {0.XX} | **Region:** cortex/{domain}
**Tags:** [{tag1}, {tag2}, {tag3}]
{Brief 2-3 line summary of pattern}

**When to use:** {One-liner}
**Example:** [[linked-sinapse]] shows this in action

#### Pattern 2: {Another Sinapse Title}
**Weight:** {0.XX} | **Region:** cortex/{domain}
...

### Cross-Cutting Patterns

#### {Sinapse Title} (sinapses/ region)
**Weight:** {0.XX}
**Applies to:** {domains}
{Description}

**Related sinapses:** [[pattern-A]], [[pattern-B]]

## Tier 3: On-Demand (if loaded)

{Additional sinapses linked from Tier 2}
{Only loaded if complexity >= 75 or risk = critical}

---

## Brain Health

- **Region:** cortex/{domain}
- **Sinapses loaded:** {N} (healthy/stale/very stale)
- **Average weight:** {0.XX}
- **Last updated:** {date}
- **Escalation candidates:** {count}
```

**Key rules:**
- Tier 1 hippocampus content is always verbatim from disk, never from memory
- Tier 2 sinapses are sorted by weight descending
- Tier 3 is only loaded when complexity >= 75, risk = critical, or `--deep` flag
- Brain Health section provides sinapse freshness metrics

---

## implementation-plan (written by brain-plan)

**File:** `.brain/working-memory/implementation-plan-{task_id}.md`

**Purpose:** Detailed TDD implementation plan with micro-steps. Each micro-step is self-contained for subagent execution.

```markdown
---
task_id: YYYY-MM-DD-{slug}
plan_type: expanded
task: "{user description}"
domain: backend | frontend | database | infra | cross-cutting
timestamp: "{ISO8601}"
status: planned
dispatch_ready: true
micro_steps: {N}
estimated_tokens: {total}k
---

# Implementation Plan -- {Task Title}

## Task Summary

{1-2 sentence summary of what and why}

## Sinapse Index

| ID | Title | Region | Applies To |
|----|-------|--------|------------|
| [[sinapse-id]] | {Title} | {region} | {where used in plan} |
| [[lesson-id]] | {Title} | {domain} | {what to avoid} |

## File Structure

| # | Action | Path | Purpose | Depends On |
|---|--------|------|---------|------------|
| F1 | create | {path} | {purpose} | -- |
| F2 | create | {path} | {purpose} | F1 |
| F3 | modify | {path} | {purpose} | F1 |

## Micro-Steps

### Micro-Step M1: {Short Title}

**Domain:** {domain}
**Files:** F1, F2
**Estimated tokens:** {N}k

#### Spec (write first)

**File:** {exact spec path}
**What to test:**
- {Concrete test case 1 -- e.g., "calculateMargin(100, 30) returns 0.30"}
- {Concrete test case 2 -- e.g., "throws InvalidInputError on negative input"}
- {Edge case -- e.g., "returns 0, not NaN, for zero inputs"}

**Conventions:**
- [[sinapse-id]]: {how this sinapse applies to the spec}
- [[lesson-id]]: {what failure to avoid}

#### Implementation (write after spec)

**File:** {exact implementation path}
**Pattern:** {pattern reference to existing file or sinapse}
**Key decisions:**
- {Decision 1 with sinapse/lesson link}
- {Decision 2 with sinapse/lesson link}

#### Acceptance Gate

- [ ] Spec file exists and contains all test cases listed above
- [ ] Implementation file exists
- [ ] All specs pass: `{exact test command}`
- [ ] No linting errors: `{exact lint command}`
- [ ] {Domain-specific check}

#### Dependencies

- Requires: {M-numbers or "None"}
- Unlocks: {M-numbers}

## Implementation Order

{Topological sort of micro-steps}

1. M1 (0 deps) -> {N}k tokens
2. M2 (depends on M1) -> {N}k tokens

## Total Token Budget

- Micro-step estimates: {N}k
- Testing buffer: {N}k
- Documentation: {N}k
- **Estimated total: {N}k tokens**

## Conflict Check

{Output from sinapse/ADR/lesson cross-reference}

## Self-Review

- [x] Every micro-step has a Spec section with concrete test cases
- [x] Every micro-step has an Implementation section with a named pattern
- [x] Every file referenced in micro-steps appears in the File Structure table
- [x] Every convention reference uses [[sinapse-id]] notation
- [x] No placeholders: zero instances of TODO, TBD, fill in, as needed, etc.
- [x] Acceptance gates include exact commands
- [x] Dependencies form a valid DAG
- [x] Token estimates sum to a reasonable total
- [x] At least one lesson is referenced
- [x] Multi-domain tasks have explicit cross-domain integration micro-steps

## Dispatch Metadata

**Dispatch ready:** true
**Recommended mode:** inline | dispatch
```

**Key rules:**
- Every file in micro-steps must appear in the File Structure table
- Every convention reference must use `[[sinapse-id]]` notation
- Zero placeholders: no TODO, TBD, "fill in later", "as needed", or "etc."
- Acceptance gates must include exact commands (not "run tests" but the specific command)
- Self-Review checklist must all be checked before the plan is output

---

## sinapse-proposal (written by brain-document)

**File:** `.brain/working-memory/sinapse-updates-{task_id}.md`

**Purpose:** Proposed changes to cortex sinapses after task completion. Always a proposal — never applied without developer approval.

```markdown
# Proposed Sinapse Updates

## Changes

### Additions

#### {New section in .brain/cortex/{domain}/index.md}

**Target:** `.brain/cortex/{domain}/index.md`
**Section:** {section title}
**Rationale:** {why this addition is needed, referencing task and files changed}

```diff
--- a/.brain/cortex/{domain}/index.md
+++ b/.brain/cortex/{domain}/index.md
@@ -{line},{count} +{line},{count} @@
 {existing context line}

+## {New Section Title}
+
+{New content derived from actual implementation code}
+
+**Related:**
+- [[sinapse-id]] {relationship}
+- [[lesson-id]] {relationship}
```

### Updates

#### {Modified section in .brain/cortex/{domain}/index.md}

**Target:** `.brain/cortex/{domain}/index.md`
**Section:** {existing section title}
**Rationale:** {why this update is needed}

```diff
--- a/.brain/cortex/{domain}/index.md
+++ b/.brain/cortex/{domain}/index.md
@@ -{line},{count} +{line},{count} @@
-{old text}
+{new text}
```

### Removals

#### {Outdated section to remove}

**Target:** `.brain/cortex/{domain}/index.md`
**Section:** {section title}
**Rationale:** {why this should be removed — pattern no longer in use, superseded by new approach}

## Impact

- **Sinapses affected:** {count}
- **Weight changes:** {list of weight adjustments with justification, or "None"}
- **New links:** {list of new [[sinapse-id]] cross-references}
- **Broken links:** {list of links that no longer resolve, if any}

## Approval

- [ ] Developer has reviewed all proposed changes
- [ ] All diff sections are accurate (current text matches actual file)
- [ ] Links verified (all referenced sinapses exist)
- [ ] Weight changes justified
```

**Key rules:**
- Always use unified diff format — never full file rewrites
- Current text in diffs must match the actual file content (read before proposing)
- Example code in proposals must be copy-pasted from actual implementation, not invented
- Never propose changes to `.brain/hippocampus/` — hippocampus is updated only by brain-health
- Anti-patterns are captured as episodes, not as sinapse proposals

---

## episode (written by brain-task, brain-consult, brain-document)

**File:** `.brain/working-memory/episode-{source}-{task_id}.md`

Where `{source}` is `task`, `consult`, or `document`.

**Purpose:** Capture a learning event (success, failure, correction, anti-pattern) for later processing by brain-health (consolidation) into sinapse updates.

```yaml
---
type: episode
task_id: "{task_id or consult-{timestamp}}"
domain: backend | frontend | database | infra | analytics | cross-domain
severity: low | medium | high | critical
trigger: task-completion | anti-pattern | consultation | correction
tags: ["{tag1}", "{tag2}", "{tag3}"]
sinapses_loaded: ["{sinapse-id-1}", "{sinapse-id-2}"]
related_completion: "{task-completion filename}" | null
created_at: "{ISO8601}"
---

## What Happened

{1-3 sentences: what the developer was doing or what the system encountered}

## What Worked

{1-3 sentences: the correct approach, solution, or pattern that resolved it}

## Lesson

{1-2 sentences: the generalized learning that applies beyond this specific task}

## Files Involved

{List of files relevant to this episode, or omit section if no files involved}

## Related

- [[sinapse-id]]: {how this episode relates to existing knowledge}
```

**Key rules:**
- Max 500 tokens per episode — brain-health (consolidation) processes many at once
- `severity` determines processing priority: critical episodes are processed first
- `trigger` indicates the source: `task-completion` (after implementation), `anti-pattern` (failure discovered), `consultation` (insight from Q&A), `correction` (developer corrected the system)
- `sinapses_loaded` links the episode to the context that was active when it occurred — brain-health (consolidation) uses this to target the right sinapse for the lesson update
- `related_completion` links to the task-completion file for additional context
- The `## Lesson` section is what brain-health (consolidation) extracts as a `## Lessons Learned` bullet in the target sinapse
