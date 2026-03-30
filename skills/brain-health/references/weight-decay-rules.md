---
reference: weight-decay-rules
version: 2.0
---

# Weight Decay Rules

## Decay Formula

```
new_weight = max(min_weight, weight - (decay_rate * days_since_last_access))
```

Applied to sinapses not accessed since last consolidation (7+ days idle).

## Default Parameters

| Parameter | Value | Description |
|---|---|---|
| `decay_rate` | 0.005 | Weight loss per idle day |
| `min_weight` | 0.1 | Floor — weight never drops below this |
| `max_weight` | 1.0 | Ceiling — weight never exceeds this |
| `idle_threshold` | 7 days | Decay only applies after this many idle days |
| `usage_bonus` | 0.01 | Per successful task use |
| `approval_bonus` | 0.02 | Per developer-approved update |

## Hebbian Usage Bonus

Formula: `new_weight = min(1.0, weight + 0.1 * (1 - weight))`

Asymptotic — larger bonuses for low-weight sinapses, prevents runaway inflation.

Process:
1. Read `task-completion-*.md` from working-memory only (not archived)
2. Filter to `status: success` and `created_at > last_consolidation_checkpoint`
3. Extract `sinapses_loaded` arrays, apply bonus per sinapse per successful use

Guard against double-counting: only files after last checkpoint. Archived completions already processed.

## Promotion Mechanics

| Stage | Location | Trigger | Weight Effect |
|---|---|---|---|
| Episode | working-memory | Task completion | n/a (not a sinapse yet) |
| Sinapse | cortex/ | Approved proposal | starts at 0.5 |
| Convention | hippocampus/ | 3+ matching lessons | source sinapses get +0.1 |

## Cleanup Rules

Flag for archival when:
- Weight at `min_weight` (0.1) for 30+ consecutive days
- No backlinks from other sinapses
- Not referenced in last 3 consolidation cycles

Archive process:
1. Flag in health report under "Orphaned Sinapses"
2. Present to developer: archive / keep / merge
3. On approval: move to `archived-sinapses/`, mark `archived = 1` in DB, remove from FTS5
4. **Never auto-delete** — always require user confirmation
