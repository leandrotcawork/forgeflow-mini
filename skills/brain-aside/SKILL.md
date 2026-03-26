---
name: brain-aside
description: Answer a quick question without losing current brain-task context — auto-saves and restores pipeline state
---

# brain-aside — Quick Question

When the developer asks a question during an active brain-task pipeline:

## Execution

1. Check if brain-task is active (brain-state.json current_pipeline_step > 0)
2. If active: save a note that an aside is in progress
3. Answer the question directly (no pipeline overhead)
4. After answering: output reminder:
   "Brain pipeline was at Step {N} for task {task_id}. Continue with /brain-task --resume"

If no brain-task is active, just answer the question normally.

## Token Budget
Minimal — just the question and answer.
