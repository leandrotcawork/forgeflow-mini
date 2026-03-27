---
name: brain-aside
description: Pipeline interrupt handler -- saves brain-task state during asides and reminds to resume. No brain context loading -- for brain-informed answers with sinapses, conventions, and lessons, use /brain-consult instead.
---

# brain-aside -- Quick Question

When the developer asks a question during an active brain-task pipeline:

## Execution

1. Check if brain-task is active (.brain/working-memory/brain-state.json current_pipeline_step > 0)
2. If active: save a note that an aside is in progress
3. Answer the question directly (no pipeline overhead)
4. After answering: output reminder:
   "Brain pipeline was at Step {N} for task {task_id}. Continue with /brain-task --resume"

If no brain-task is active, just answer the question normally.

## Token Budget
Minimal -- just the question and answer.
