#!/usr/bin/env bash
# ForgeFlow Mini - Stop hook
# Prevents session finalization when verification has not passed yet.
# Modern output schema: hookSpecificOutput.permissionDecision

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
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
    raise SystemExit(0)

phase = str(state.get("phase") or "").strip()
verify_status = str(state.get("verify_status") or "").strip()
task_id = state.get("task_id") or state.get("last_task_id")

if task_id in (None, ""):
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
    raise SystemExit(0)

risky_phases = {"IMPLEMENTING", "REVIEWING", "VERIFYING", "DOCUMENTING"}
if phase in risky_phases and verify_status != "passed":
    print(json.dumps({
        "hookSpecificOutput": {
            "permissionDecision": "deny",
            "reason": (
                f"Session end blocked: task '{task_id}' is in phase '{phase}' with verify_status='{verify_status}'. "
                "Run brain-verify to completion before ending the session. "
                "Required action: complete brain-verify → brain-document → phase COMPLETED."
            )
        }
    }))
else:
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
PY
