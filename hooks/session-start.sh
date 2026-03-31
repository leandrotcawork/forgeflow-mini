#!/usr/bin/env bash
# ForgeFlow Mini - SessionStart hook
# Injects brain orientation + current project state into session context.
# Modern output schema: hookSpecificOutput.additionalContext

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ORIENTATION_FILE="${PLUGIN_DIR}/skills/brain-orientation/SKILL.md"
STATE_FILE="${PROJECT_DIR}/.brain/progress/brain-project-state.json"

ORIENTATION_FILE="$ORIENTATION_FILE" STATE_FILE="$STATE_FILE" python3 - <<'PY'
import json
import os
from pathlib import Path

orientation_file = Path(os.environ["ORIENTATION_FILE"])
state_file = Path(os.environ["STATE_FILE"])

def read_text(path):
    try:
        return path.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, OSError):
        return ""

parts = []

orientation = read_text(orientation_file)
if orientation:
    parts.append("# Brain Orientation\n\n" + orientation)

state = read_text(state_file)
if state:
    parts.append("# Current Project State\n\n" + state)

context = "\n\n---\n\n".join(parts)
print(json.dumps({"hookSpecificOutput": {"additionalContext": context}}))
PY
