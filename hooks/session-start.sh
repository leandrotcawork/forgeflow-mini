#!/usr/bin/env bash
# ForgeFlow Mini - SessionStart hook (v3)
# Injects ForgeFlow Active orientation into every session context.
# Modern output schema: hookSpecificOutput.additionalContext

set -euo pipefail

python3 - <<'PY'
import json

context = """# ForgeFlow Mini — Active

This project uses ForgeFlow Mini V1. The rigid development flow is enforced.

## Required Entry Point
Use `/brain-dev` for ALL development tasks. Do NOT write code directly.

## Flow (Non-Negotiable)
`/brain-dev` → brain-spec → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document

## Phase Gates
- Write/Edit are BLOCKED until `plan_status = approved`
- Session end is BLOCKED until `verify_status = passed`
- Every phase must complete before the next begins

## Rules
- No phase skipping — every task, no exceptions
- No inline implementation — always route through brain-dev
- Spec must be approved by user before plan begins
- Implementation only proceeds with an approved plan"""

print(json.dumps({"hookSpecificOutput": {"additionalContext": context}}))
PY
