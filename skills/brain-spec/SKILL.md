---
name: brain-spec
description: Generate spec for any build/fix/refactor/improve/debug task. Runs search-first, writes spec using template, dispatches spec-reviewer, presents for user approval.
---

# brain-spec

Create the approved spec before any plan exists.

## Trigger

Routed from `brain-dev` after `dev-context-{task_id}.md` is written and `workflow-state.json` is initialized with `phase: SPEC_PENDING`.

## Hard Gates

1. No plan writing. No code writing. No implementation.
2. No handoff to `brain-plan` until the user has explicitly approved the spec.
3. The `Reuse Strategy` section in the spec MUST NOT be empty — the flow is blocked if it is.
4. Spec is saved to `.brain/specs/` — not `.brain/working-memory/`.

## Step 1: Load Context

Read:
- `.brain/working-memory/dev-context-{task_id}.md`
- `.brain/working-memory/workflow-state.json`

If `dev-context` is missing, stop and return to `brain-dev`.

Update `workflow-state.json`:
```json
{ "phase": "SPEC_REVIEW" }
```

## Step 2: Search-First (Mandatory)

Before writing a single word of spec, execute the search order:

1. **Repo scan** — search for existing patterns, similar modules, reusable components related to the task
2. **`.claude/rules/`** — read relevant architectural conventions and stack rules
3. **`.brain/`** — check episodes/, proposals/, sinapses/ for prior work on similar problems
4. **Known libs/frameworks** — identify applicable existing libraries
5. **Web research** — only if steps 1–4 are insufficient

Document what you found in each step. This becomes the Reuse Strategy section.

## Step 3: Write the Spec

Write `.brain/specs/spec-{task_id}.md` using the template at `templates/spec.md`.

Fill every section:
- **Objective** — what is being built and why
- **Constraints** — technical, scope, performance, compatibility
- **Reuse Strategy** — MANDATORY: document findings from each search step; what will be reused, adapted, or built new
- **Affected Areas** — files, modules, or systems to be created or modified
- **Acceptance Criteria** — verifiable, measurable criteria (checkbox format)
- **Risks** — known risks and unknowns

Keep it concrete. If one blocker remains, ask ONE clarifying question before writing.

## Step 3.5: Enforce Reuse Strategy Gate

Before dispatching spec-reviewer, verify the Reuse Strategy section is populated:

- Read `.brain/specs/spec-{task_id}.md`
- Find the `## Reuse Strategy` section
- Check that it contains substantive content (not just the template placeholder text)

If the Reuse Strategy section is empty or contains only template text:
- STOP
- Output: `brain-spec: Reuse Strategy section is empty. You must document what was found in each search step before this spec can proceed. Return to Step 2 and complete the search.`
- Do not dispatch spec-reviewer
- Do not advance phase

Only proceed to spec-reviewer dispatch when Reuse Strategy has real content.

## Step 4: Dispatch spec-reviewer Agent

Dispatch the `agents/spec-reviewer.md` agent with:
- The full spec text (inlined, not a file reference)

The spec-reviewer will return PASS or FAIL with specific findings.

If FAIL: address the identified issues and re-dispatch spec-reviewer.
Do not proceed to user approval until spec-reviewer returns PASS.

After spec-reviewer returns PASS, update `workflow-state.json`:
```json
{ "phase": "SPEC_APPROVAL" }
```
(spec_status remains "reviewing" while awaiting user decision)

## Step 5: User Approval Gate

Present the spec to the user with:
1. The full spec content
2. The spec-reviewer result (PASS with no issues, or summary of issues already fixed)
3. Ask: "Does this spec look correct? Approve to proceed to planning, or request changes."

While waiting for approval:
- `workflow-state.json` phase stays `SPEC_APPROVAL`
- `spec_status` stays `"reviewing"` (set in Step 1; advanced to `"approved"` only after user approves)

After user approval, update `workflow-state.json`:
```json
{
  "phase": "PLAN_PENDING",
  "spec_status": "approved"
}
```

Then hand off to `brain-plan`.

## Pipeline

`brain-dev → brain-spec → [spec-reviewer] → USER APPROVAL → brain-plan → brain-task → brain-review → brain-verify → brain-document`
