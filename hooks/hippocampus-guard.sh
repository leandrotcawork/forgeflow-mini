#!/usr/bin/env bash
# ForgeFlow Mini - PreToolUse hook (hippocampus guard)
# Blocks writes to .brain/hippocampus/ (immutable memory layer).
# Modern output schema: hookSpecificOutput.permissionDecision

set -euo pipefail

input="$(cat)"

INPUT_JSON="$input" python3 - <<'PY'
import json
import os

raw = os.environ.get("INPUT_JSON", "")

def extract_path(payload):
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    for key in ("file_path", "path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            return value
    for key in ("file_path", "path"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return ""

try:
    payload = json.loads(raw) if raw.strip() else {}
except json.JSONDecodeError:
    payload = {}

file_path = extract_path(payload)
normalized = file_path.replace("\\", "/")

if ".brain/hippocampus/" in normalized:
    output = {
        "hookSpecificOutput": {
            "permissionDecision": "deny",
            "reason": "Hippocampus is immutable. Review and approve this write before continuing."
        }
    }
else:
    output = {
        "hookSpecificOutput": {
            "permissionDecision": "allow"
        }
    }

print(json.dumps(output))
PY
