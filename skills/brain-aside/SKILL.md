---
name: brain-aside
description: DEPRECATED — pipeline-check-and-remind behavior absorbed into brain-consult. Use /brain-consult for questions during an active pipeline.
metadata:
  deprecated: true
  replaced_by: brain-consult
---

# brain-aside — DEPRECATED

> **This skill has been absorbed into `/brain-consult` as of v0.9.0.**
> Use `/brain-consult` for any question during an active brain-task pipeline.
> brain-consult automatically detects the active pipeline and appends a resume reminder.

## Original behavior (now in brain-consult Pre-Step)

When brain-task pipeline is active:
1. Check brain-state.json for current_pipeline_step
2. Answer the question
3. Append resume reminder: "Brain pipeline at Step {N} for {task_id}. Resume: /brain-task --resume"
