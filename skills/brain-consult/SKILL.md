---
name: brain-consult
description: Brain-informed Q&A without implementation. Read-only consultation across Quick, Research, and Consensus modes.
---

# brain-consult -- Brain-Informed Consultation

Answer questions with brain knowledge. No implementation. No pipeline overhead.

## Hard Rule

brain-consult is read-only.

- Never write or modify source files
- Never approve a plan or implementation
- Never change workflow phase
- Never mutate `workflow_state`
- Never act as execution authorization for another skill

## Trigger

`/brain-consult <question>` or routed from brain-dev when the request is a question, not a task.

## Step 1: Detect Mode

| Signal | Mode | Examples |
|---|---|---|
| Simple factual, internal knowledge | **Quick** | "where is X?", "remind me how we...", "what does Y do?" |
| Domain/external tech, docs needed | **Research** | "how to use library X?", "best practice for...", "API docs say..." |
| High-stakes, architectural, multi-model | **Consensus** | "should we adopt X?", "which architecture for...?" (requires `--consensus`) |

Default: Quick. User can override with `--quick`, `--research`, or `--consensus`.
Consensus is never auto-selected.

## Step 2: Load Context Per Mode

| Mode | Context Loaded |
|---|---|
| Quick | Tier 1 only |
| Research | Tier 1 + Tier 2 + External |
| Consensus | Research + independent Codex analysis |

## Step 3: Answer Using Loaded Context

- Be specific: reference files, functions, and sinapse IDs.
- If routed from brain-dev with dev-context, acknowledge previous task and focus on those files.
- Quick: direct answer with brain references.
- Research: synthesize brain knowledge and external findings.
- Consensus: present Claude assessment, Codex assessment, then synthesis.

## Step 4: Capture Episode If Correction

If the user corrects the answer or reveals a failure pattern not in existing knowledge:
- Write `.brain/working-memory/episode-consult-{timestamp}.md`

## Step 5: Post-Response

1. Write audit JSON: `.brain/working-memory/consult-{timestamp}.json`
2. Append to `.brain/progress/consult-log.md`
3. If answer requires implementation: suggest `/brain-dev`
4. If pipeline is active: append a resume reminder only
5. Restore `current_skill` in `brain-state.json`

## Rules

1. Read-only. Never write or modify source files.
2. No workflow control. Never approve a plan and never change workflow phase.
3. Offer upgrade. If Quick mode answer has low confidence, offer Research.
4. Stop at clarity. In Research, stop external lookups once answered.
5. No auto-consensus. Consensus only via `--consensus`.
6. Episode capture. Always write episode when user corrects an answer.
7. Vague questions. If fewer than 5 meaningful words and no domain signal, ask one clarifying question.
