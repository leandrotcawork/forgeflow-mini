# Anti-Patterns

Known failure modes in the ForgeFlow Mini brain system. Each pattern describes what goes wrong, why it happens, and how to fix it. These were identified from v1.x operational data (avg 11.4 errors/session, 0% agent success rate).

---

## 1. Context Exhaustion

**What happens:** A skill loads too much brain context, consuming most of the available token budget before implementation begins. The agent runs out of context mid-task, produces truncated output, or fails silently.

**Why it happens:**
- Loading multiple cortex regions when only one is needed
- Not truncating hippocampus files to 500 chars
- Loading all sinapses from FTS5 without a LIMIT clause
- Multiple skills in the pipeline each loading their own context independently instead of sharing the context packet

**Symptoms:**
- Agent produces incomplete code (cuts off mid-function)
- Agent "forgets" earlier instructions in the same session
- Tool errors increase sharply after context assembly
- Subagent receives truncated prompt

**Fix:**
- Follow per-skill budgets in `context-budget-guide.md` strictly
- Truncate hippocampus to 500 chars per file, always
- Limit FTS5 queries: `LIMIT 3` for brain-consult, `LIMIT 5` for brain-map
- Load only ONE cortex region per task (the domain matching the task)
- Let brain-map own multi-tier loading — other skills read the context packet it produces
- Monitor pipeline accumulation: if cumulative context exceeds ~900 lines before brain-task, something is wrong

---

## 2. Hippocampus Direct Write

**What happens:** A skill writes directly to `.brain/hippocampus/` files, bypassing the approval gate. Hippocampus contains strategic decisions and conventions — unauthorized changes corrupt the project's architectural memory.

**Why it happens:**
- Skill logic attempts to "update conventions" after learning something new
- brain-document mistakenly targets hippocampus instead of cortex
- A subagent with write access modifies hippocampus files as part of implementation

**Symptoms:**
- `hippocampus-guard` hook blocks the write (correct behavior)
- If guard is bypassed: conventions change without team awareness
- Subsequent tasks follow outdated or wrong conventions
- Architecture decisions silently overwritten

**Fix:**
- The `hippocampus-guard` hook blocks ALL writes to `.brain/hippocampus/` unconditionally
- Only brain-health (consolidation) may write to hippocampus, and only after explicit developer approval
- brain-document proposals target `.brain/cortex/` and `.brain/sinapses/` only
- When a skill discovers something that should change conventions, it writes an episode file to working memory — brain-consolidate processes it through the approval pipeline
- Subagent prompts must never include hippocampus paths as writable targets

---

## 3. Skipping brain-map

**What happens:** A skill (usually brain-task or brain-plan) proceeds to implementation without running brain-map first. The task executes without sinapse context, ignoring established patterns, conventions, and lessons from prior tasks.

**Why it happens:**
- Rationalization: "The task is simple enough — I don't need the context packet"
- brain-plan called directly without brain-dev routing (no dev-context file)
- brain-task started from an interrupted state where the context packet was already archived

**Symptoms:**
- Implementation ignores project conventions (naming, patterns, architecture)
- Repeats mistakes documented in existing sinapses/lessons
- brain-document produces empty or generic proposals (no sinapse references to update)
- Code review catches pattern violations that sinapses would have prevented

**Fix:**
- brain-task GATE 1 enforces that `context-packet-{task_id}.md` MUST exist before Step 2
- brain-plan Step 0e calls brain-map explicitly before generating the plan
- If brain-map fails (brain.db missing, new project), the skill proceeds but logs a warning — the lack of context is acknowledged, not silently ignored
- For interrupted task resume: check if the context packet still exists in working memory before resuming

---

## 4. Circuit Breaker Ignorance

**What happens:** A task executes despite the circuit breaker being in `open` state. The circuit breaker opens after consecutive failures to prevent cascading errors — ignoring it means running into the same failure repeatedly, wasting tokens and time.

**Why it happens:**
- Skill skips the Pre-Step circuit breaker check in brain-task
- `brain-project-state.json` is not read or the `circuit_breaker` field is ignored
- Developer forces execution without checking breaker state

**Symptoms:**
- Same error repeats 3+ times in a session
- Token burn rate spikes with no progress
- Session ends with 0 commits despite multiple attempts
- Developer frustration: "why is this broken?"

**Fix:**
- brain-task Pre-Step is MANDATORY: read `brain-project-state.json`, check `circuit_breaker.state`
- If state is `open` and `now < cooldown_until`: BLOCK execution, show remaining cooldown time
- If state is `half-open`: allow execution as a probe, track result to determine breaker state
- If state is `closed`: proceed normally
- After a task failure: update `circuit_breaker.failure_count` and check threshold. If failures >= 3 consecutive, open the breaker with a cooldown period
- The circuit breaker protects against: repeated build failures, persistent test failures, environment issues (missing deps, wrong Node version)

---

## 5. Strategy Fixation

**What happens:** After a failed implementation attempt, the same strategy is retried without considering alternatives. The agent loops on the same approach, consuming tokens without making progress.

**Why it happens:**
- No strategy rotation mechanism — the agent re-reads the same context and makes the same decisions
- Failed approach is not recorded as an episode, so the next attempt has no memory of the failure
- brain-plan generates only one approach instead of presenting 2 options to the developer

**Symptoms:**
- Same error appears 2-3 times in a session
- Agent retries with minor variations of the same approach
- Session drift detected (reading files repeatedly without implementing)
- High token cost with low commit-to-attempt ratio

**Fix:**
- After a task failure, brain-task MUST write an episode file with `trigger: anti-pattern` describing what failed and why
- brain-plan Step 0c MUST present exactly 2 implementation approaches — never just one
- When retrying a failed task, the episode from the first attempt is available in working memory — brain-map loads it as context, ensuring the next attempt knows what did not work
- If the same task fails twice with the same approach, the circuit breaker should open — this prevents a third identical attempt
- Check `get_task_history` for prior attempts on the same feature before starting implementation

---

## 6. Overloading Subagents

**What happens:** A subagent receives too much context (entire brain dump, full conversation history, multiple cortex regions) and fails to produce useful output. The subagent's effective context window is consumed by irrelevant information.

**Why it happens:**
- Passing the full session conversation to the subagent instead of just the prompt + context packet
- Including all hippocampus files untruncated in the subagent prompt
- Loading multiple cortex regions "just in case"
- Combining the implementer prompt, reviewer prompt, and documentation prompt into a single mega-prompt

**Symptoms:**
- Subagent produces generic code that ignores specific instructions
- Subagent "forgets" the task partway through implementation
- Subagent output is truncated (ran out of output tokens)
- Implementation quality drops despite high-quality plan

**Fix:**
- Subagent receives ONLY: its specific prompt (from `skills/brain-task/prompts/`) + the context packet + the implementation plan. Nothing else.
- Subagent does NOT inherit session conversation history — fresh context is the speed gain
- Implementer prompt: max 100 lines. Reviewer prompts: max 60 lines each.
- Context packet is already optimized by brain-map — do not add additional context on top of it
- One subagent per micro-step (sequential execution). Never combine multiple micro-steps into a single subagent dispatch.
- If a micro-step's estimated tokens exceed 25k, split it into smaller steps in the plan — do not push a too-large step to a single subagent

---

## 7. Consolidation Without Approval

**What happens:** Sinapse updates are applied to `.brain/cortex/` or `.brain/hippocampus/` without developer review and approval. The brain's knowledge base changes silently, potentially introducing incorrect patterns or removing valid conventions.

**Why it happens:**
- brain-consolidate auto-applies proposals instead of presenting them for review
- brain-document writes directly to cortex instead of creating a proposal file
- A script or hook applies pending proposals without gating

**Symptoms:**
- Cortex content changes without the developer noticing
- Conventions shift between sessions with no explanation
- Sinapse weights change without justification
- `git diff` shows unexpected changes in `.brain/` files

**Fix:**
- brain-document is proposal-only: it creates `.brain/working-memory/sinapse-updates-{task_id}.md` and NEVER writes to cortex directly
- brain-consolidate presents every proposal individually using `AskUserQuestion` with Approve/Reject/Modify options
- brain-health (the v2.0 merge of brain-consolidate + brain-status) follows the same approval gate
- The `hippocampus-guard` hook provides a hard block on hippocampus writes as a safety net
- All sinapse updates must be committed via git so they are visible in the change history
- Weight adjustments require explicit justification in the proposal's Impact section

---

## Quick Reference: Anti-Pattern Detection

Use this table to identify which anti-pattern you might be hitting based on observed symptoms.

| Symptom | Likely anti-pattern | First action |
|---|---|---|
| Agent output truncated mid-task | Context Exhaustion (#1) | Check pipeline accumulation against budget |
| hippocampus-guard blocks a write | Hippocampus Direct Write (#2) | Redirect to cortex or episode file |
| Implementation ignores conventions | Skipping brain-map (#3) | Verify context-packet exists before Step 2 |
| Same error repeats 3+ times | Circuit Breaker Ignorance (#4) | Read brain-project-state.json, check breaker |
| Same approach retried after failure | Strategy Fixation (#5) | Write episode, present 2 options on retry |
| Subagent produces generic output | Overloading Subagents (#6) | Audit what context the subagent received |
| Brain content changed without notice | Consolidation Without Approval (#7) | Check for unapproved writes, review git diff |
