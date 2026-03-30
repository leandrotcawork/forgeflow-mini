#!/usr/bin/env bash
# ForgeFlow Mini — PreToolUse hook (hippocampus guard)
# Blocks writes to .brain/hippocampus/ (immutable memory layer).
# Reads tool input JSON from stdin; outputs approve or block.

set -euo pipefail

input="$(cat)"

file_path="$(python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
print(data.get('input', {}).get('file_path', ''))
" <<< "$input" 2>/dev/null || echo "")"

if [[ "$file_path" == *".brain/hippocampus/"* ]]; then
  echo '{"result":"block","reason":"Hippocampus is immutable. If you are running /brain-health, review and approve this write."}'
else
  echo '{"result":"approve"}'
fi
