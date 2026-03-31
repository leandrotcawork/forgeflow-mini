#!/usr/bin/env bash
# ForgeFlow Mini - PreToolUse hook
# Enforces workflow-state write gates before source edits are allowed.
# Modern output schema: hookSpecificOutput.permissionDecision

set -euo pipefail

input="$(cat)"
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state_file="${project_dir}/.brain/working-memory/workflow-state.json"

INPUT_JSON="$input" PROJECT_DIR="$project_dir" STATE_FILE="$state_file" python3 - <<'PY'
import json
import os
from pathlib import Path

raw = os.environ.get("INPUT_JSON", "")
project_dir = Path(os.environ.get("PROJECT_DIR", os.getcwd())).resolve()
state_file = Path(os.environ.get("STATE_FILE", str(project_dir / ".brain" / "working-memory" / "workflow-state.json"))).resolve(strict=False)

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

def normalize_target(raw_path):
    if not raw_path:
        return None
    candidate = Path(raw_path.replace("\\", "/"))
    if not candidate.is_absolute():
        candidate = project_dir / candidate
    return candidate.resolve(strict=False)

def load_state(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None

def is_under(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False

try:
    payload = json.loads(raw) if raw.strip() else {}
except json.JSONDecodeError:
    payload = {}

target_raw = extract_path(payload)
target = normalize_target(target_raw)
brain_root = (project_dir / ".brain").resolve(strict=False)

if target is None:
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
    raise SystemExit(0)

if is_under(target, brain_root):
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
    raise SystemExit(0)

state = load_state(state_file)
if not state:
    print(json.dumps({
        "hookSpecificOutput": {
            "permissionDecision": "deny",
            "reason": "workflow-state.json is missing, unreadable, or invalid; source writes are blocked until the workflow state can be loaded."
        }
    }))
    raise SystemExit(0)

phase = str(state.get("phase") or "").strip()
plan_status = str(state.get("plan_status") or "").strip()
allowed_files = state.get("allowed_files") or []
unrestricted = bool(state.get("unrestricted"))

if phase in {"spec", "plan"} or plan_status != "approved":
    print(json.dumps({
        "hookSpecificOutput": {
            "permissionDecision": "deny",
            "reason": "Source writes are locked until the workflow reaches an approved plan outside spec/plan phases."
        }
    }))
    raise SystemExit(0)

if not allowed_files and not unrestricted:
    print(json.dumps({
        "hookSpecificOutput": {
            "permissionDecision": "deny",
            "reason": "Source writes require a populated allowed_files list, or an explicit unrestricted flag in workflow-state.json."
        }
    }))
    raise SystemExit(0)

if allowed_files:
    allowed_targets = []
    for item in allowed_files:
        if not isinstance(item, str) or not item.strip():
            continue
        allowed_path = Path(item.replace("\\", "/"))
        if not allowed_path.is_absolute():
            allowed_path = project_dir / allowed_path
        allowed_targets.append(allowed_path.resolve(strict=False))

    if not allowed_targets or not any(target == allowed or is_under(target, allowed) for allowed in allowed_targets):
        print(json.dumps({
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "reason": "This write is outside the workflow state's allowed_files allowlist."
            }
        }))
        raise SystemExit(0)

print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
PY
