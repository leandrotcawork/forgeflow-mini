---
name: brain-consult
description: Brain-informed Q&A without implementation. 3 modes — Quick, Research, Consensus — merging former brain-consult + brain-mckinsey + brain-codex-review into one consolidated skill.
---

# brain-consult -- Brain-Informed Consultation

Answer questions with brain knowledge. No implementation. No pipeline overhead.

## Trigger

`/brain-consult <question>` or routed from brain-dev when the request is a question, not a task.

## Step 1: Detect Mode

| Signal | Mode | Examples |
|--------|------|----------|
| Simple factual, internal knowledge | **Quick** | "where is X?", "remind me how we...", "what does Y do?" |
| Domain/external tech, docs needed | **Research** | "how to use library X?", "best practice for...", "API docs say..." |
| High-stakes, architectural, multi-model | **Consensus** | "should we adopt X?", "which architecture for...?" (requires `--consensus`) |

**Default:** Quick. User can override with `--quick`, `--research`, or `--consensus` flags.
Consensus is NEVER auto-selected -- only via explicit `--consensus` flag.
When uncertain between Quick and Research, default to **Research** (better to over-research than under-inform).

```
/brain-consult "question"
/brain-consult --quick "question"
/brain-consult --research "question"
/brain-consult --consensus "question"
/brain-consult --domain backend "question"
```

## Step 2: Load Context Per Mode

| Mode | Context Loaded | Details |
|------|---------------|---------|
| Quick | Tier 1 only | See [mode-quick.md](references/mode-quick.md) |
| Research | Tier 1 + Tier 2 + External | See [mode-research.md](references/mode-research.md) |
| Consensus | Research + Codex dispatch | See [mode-consensus.md](references/mode-consensus.md) |

All modes load `architecture.md` + `conventions.md` from hippocampus as baseline.
Research and Consensus add FTS5 sinapse retrieval (max 3 sinapses) and track Hebbian usage.
Research adds Context7/WebSearch (max 3 MCP calls). Consensus adds independent Codex analysis.

## Step 3: Answer Using Loaded Context

- Be specific: reference files, functions, sinapse IDs -- not generic advice.
- If routed from brain-dev with dev-context, acknowledge previous task and focus on those files.
- Quick: direct answer with sinapse references.
- Research: synthesize brain knowledge + external findings with sources.
- Consensus: present Claude assessment, Codex assessment, then synthesis with agreement/divergence.

For Consensus mode, strategic decisions are scored on 4 axes (Business Impact 40%, Tech Risk 20%, Effort 20%, Strategic Alignment 20%) per [mode-consensus.md](references/mode-consensus.md).

## Step 4: Capture Episode If Correction

If the user corrects the answer or reveals a failure pattern not in existing knowledge:
- Write `.brain/working-memory/episode-consult-{timestamp}.md` with what was believed vs what is correct.
- brain-consolidate will process into sinapse updates.

## Step 5: Post-Response

1. Write audit JSON: `.brain/working-memory/consult-{timestamp}.json` (mode, domain, question, confidence, sinapses used).
2. Append to `.brain/progress/consult-log.md` (one row per consultation).
3. If answer requires implementation: suggest `/brain-task` escalation.
4. If pipeline active: append resume reminder.
5. Restore `current_skill` in brain-state.json (null if direct invocation, untouched if mid-pipeline).

## Mode Summary

| | Quick | Research | Consensus |
|---|---|---|---|
| **Context budget** | ~2500 tokens | ~6000 tokens | ~12000 tokens |
| **External tools** | None | Context7, WebSearch | Context7, WebSearch |
| **Subagent** | None | None | Codex (independent review) |
| **Speed** | Instant | 10-20s | 30-60s |
| **Codex prompt** | -- | -- | [consensus-reviewer.md](prompts/consensus-reviewer.md) |

## Rules

1. **No implementation.** Never write or modify code files. Suggest `/brain-task` if task detected.
2. **Offer upgrade.** If Quick mode answer has low confidence, offer to re-run as Research.
3. **Stop at clarity.** In Research, stop external lookups as soon as the question is answered (max 3 MCP calls).
4. **No auto-consensus.** Consensus only via `--consensus` flag.
5. **Episode capture.** Always write episode when user corrects an answer.
6. **Vague questions.** If < 5 meaningful words and no domain signal, ask ONE clarifying question before proceeding.

---

**Created:** 2026-03-30 | **Consolidates:** brain-consult + brain-mckinsey + brain-codex-review
