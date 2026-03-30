#!/usr/bin/env bash
# ForgeFlow Mini — SessionStart hook
# Injects brain orientation + current project state into session context.
# Output: {"result":"add_context","context":"<escaped content>"}

set -euo pipefail

# ── Resolve plugin directory (one level up from hooks/) ──
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Resolve project directory ──
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BRAIN_DIR="${PROJECT_DIR}/.brain"

# ── Read orientation skill ──
ORIENTATION_FILE="${PLUGIN_DIR}/skills/brain-orientation/SKILL.md"
orientation=""
if [[ -f "$ORIENTATION_FILE" ]]; then
  orientation="$(cat "$ORIENTATION_FILE")"
fi

# ── Read project state (optional) ──
STATE_FILE="${BRAIN_DIR}/progress/brain-project-state.json"
state=""
if [[ -f "$STATE_FILE" ]]; then
  state="$(cat "$STATE_FILE")"
fi

# ── Build combined context ──
context=""
if [[ -n "$orientation" ]]; then
  context+=$'# Brain Orientation\n\n'"${orientation}"
fi

if [[ -n "$state" ]]; then
  if [[ -n "$context" ]]; then
    context+=$'\n\n---\n\n'
  fi
  context+=$'# Current Project State\n\n'"${state}"
fi

# ── Bail if nothing to inject ──
if [[ -z "$context" ]]; then
  echo '{"result":"approve"}'
  exit 0
fi

# ── Escape for JSON and output ──
escaped="$(python3 -c "
import json, sys
raw = sys.stdin.read()
print(json.dumps(raw))
" <<< "$context")"

echo "{\"result\":\"add_context\",\"context\":${escaped}}"
