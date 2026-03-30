---
reference: consolidation-pipeline
version: 2.0
---

# Consolidation Pipeline — 7-Step Cycle

## Step 1: Collect Episodes

- Read all `episode-*.md` files from `.brain/working-memory/`
- Sort by date (oldest first — process in chronological order)
- Group by type: lesson episodes, task episodes, cross-domain episodes
- Cross-reference with `task-completion-*.md` for outcome context
- Skip any episodes already marked as processed

## Step 2: Generate Update Proposals

For each episode:
1. **Detect target sinapses** — use `sinapses_loaded`; fallback: FTS5 by tags, domain match, propose new sinapse
2. **Missing-file recovery** — if DB row exists but file missing, recreate from `sinapses.content`
3. **Dedup check** — >80% tag overlap + description similarity = skip
4. **Detect patterns** — recurring themes across episodes (same tags, similar outcomes)
5. **Propose** — write `lesson-update-PROPOSAL-{sinapse_id}-{timestamp}.md` to working-memory

## Step 3: Review Existing Proposals

Present ALL proposals as a single numbered list (lesson-updates from Step 2 + sinapse-updates from brain-document). Developer choices: **y** = approve, **n** = reject, **m** = modify. Use `AskUserQuestion` for each. Track tallies.

## Step 4: Escalation Check

Scan ALL `## Lessons Learned` bullets across every sinapse (not just current batch).

**Threshold: 3+ matching bullets triggers escalation.**

Process:
1. Group bullets by domain + tag pattern
2. Supplement with FTS5 semantic matching (fallback: domain+tags only if FTS5 unavailable)
3. Check if pattern already exists in `.brain/hippocampus/conventions.md` — skip if found
4. Check if escalation proposal already exists in working-memory — skip if found
5. Generate `escalation-PROPOSAL-{timestamp}.md` with convention text
6. Present to developer: approve (add to conventions.md) / reject / modify

**Convention promotion target:** `.brain/hippocampus/conventions.md`
**Guard:** hippocampus-guard will prompt on write — this is expected.

## Step 5: Apply Approved Updates

For each approved proposal:
1. Update sinapse markdown file on disk
2. `UPDATE sinapses SET content = ?, updated_at = ? WHERE id = ?`
3. Rebuild FTS5: `INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild')`
4. Increment weight: `+0.02` per approval (cap at 1.0)

For approved escalations:
1. Append convention text to `.brain/hippocampus/conventions.md`
2. Delete the escalation proposal file

## Step 6: Weight Maintenance

Apply weight decay per `weight-decay-rules.md`:
- Decay unused sinapses: `weight - (rate * days_since_access)`, floor at `min_weight`
- Apply Hebbian usage bonus for sinapses used in successful tasks since last consolidation
- See `weight-decay-rules.md` for full formula and parameters

## Step 7: Clean Working Memory

1. **Archive processed files** — move `task-completion-*.md` and `episode-*.md` to `.brain/progress/completed-contexts/`
2. **Remove applied proposals** — delete proposal files that were approved or rejected
3. **Update state** — set `tasks_since_last_consolidation = 0`, increment `total_consolidation_cycles`
4. **Write checkpoint** — append `<!-- consolidation-checkpoint: {ISO8601} cycle-{N} -->` to `.brain/progress/activity.md`
5. **Verify clean state** — working-memory should contain only: unprocessed items, active consult files, pending escalation proposals
