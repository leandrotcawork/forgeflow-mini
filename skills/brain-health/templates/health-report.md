---
template: health-report
version: 2.0
---

# Brain Health Report — {{date}}

**Brain ID:** {{brain_id}}  |  **Mode:** {{mode}}

## Knowledge Summary

| Region | Sinapses | Avg Weight | Staleness | Status |
|---|---|---|---|---|
{{#each regions}}
| {{name}} | {{sinapse_count}} | {{avg_weight}} | {{days_since_update}}d | {{status_badge}} |
{{/each}}
| **TOTAL** | **{{total_sinapses}}** | **{{global_avg_weight}}** | — | — |

Staleness: healthy (< 7d) | stale (7-30d) | very stale (> 30d)

## Circuit Breaker

State: {{circuit_breaker_state}} | Failures: {{circuit_breaker_failures}} | Cooldown: {{circuit_breaker_cooldown}}

## Pending Items

| Category | Count | Action |
|---|---|---|
| Unprocessed episodes | {{pending_episodes}} | `--consolidate` if > 5 |
| Open proposals | {{pending_proposals}} | Review during consolidation |
| Tasks since consolidation | {{tasks_since_consolidation}} | Consolidate after 5+ |

## Recommendations

{{#each recommendations}}
- {{severity}}: {{message}}
{{/each}}
