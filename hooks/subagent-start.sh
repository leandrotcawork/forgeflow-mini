#!/usr/bin/env bash
# ForgeFlow Mini - SubagentStart hook (v3)
# Injects discipline contract into every spawned subagent.
# Reads workflow-state.json to provide task-specific constraints.
# Modern output schema: hookSpecificOutput.additionalContext

set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state_file="${project_dir}/.brain/working-memory/workflow-state.json"

PROJECT_DIR="$project_dir" STATE_FILE="$state_file" python3 - <<'PY'
import json
import os
from pathlib import Path

project_dir = Path(os.environ.get("PROJECT_DIR", os.getcwd())).resolve()
state_file = Path(os.environ.get("STATE_FILE", str(project_dir / ".brain" / "working-memory" / "workflow-state.json"))).resolve(strict=False)

def load_state(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None

state = load_state(state_file)

if not state:
    context = """# ForgeFlow Discipline Contract

You are a ForgeFlow subagent. No active workflow state found.

## Rules
- Do NOT write or edit source files without an approved plan
- Do NOT skip phases or take shortcuts
- Do NOT implement anything not in your assigned task
- Report DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED"""
else:
    task_id = state.get("task_id", "unknown")
    intent = state.get("intent", "unknown")
    phase = state.get("phase", "unknown")
    allowed_files = state.get("allowed_files") or []

    if allowed_files:
        files_list = "\n".join(f"  - {f}" for f in allowed_files)
    else:
        files_list = "  (none defined — do not write any source files)"

    context = f"""# ForgeFlow Discipline Contract

You are a ForgeFlow subagent operating within a strict workflow.

## Active Task
- **Task ID:** {task_id}
- **Intent:** {intent}
- **Phase:** {phase}

## Allowed Files
{files_list}

## Rules
- Only write or edit files listed above
- Do NOT write to .brain/hippocampus/ (read-only)
- Do NOT skip phases or implement beyond your task scope
- Do NOT take shortcuts or bypass the flow
- Complete your assigned task fully, then stop
- Report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED"""

print(json.dumps({"hookSpecificOutput": {"additionalContext": context}}))
PY
