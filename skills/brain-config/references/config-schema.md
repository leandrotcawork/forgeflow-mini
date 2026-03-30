# Config Schema — Validation Rules

Reference for brain-config Edit mode. Every field change MUST pass validation
before writing to brain.config.json.

---

## Validation Process

1. Parse brain.config.json as JSON (reject if invalid)
2. Check required top-level fields exist: brain_id, version, database, cortex_regions
3. Validate field type matches schema (string, number, integer, boolean, array, enum)
4. Validate range constraints (min/max for numbers, min length for arrays)
5. Validate enum constraints (allowed value set)
6. Reject writes to read-only / protected fields
7. Show before/after diff to developer before writing

---

## Protected Fields

These fields require special handling and CANNOT be weakened:

| Field | Rule |
|-------|------|
| `consolidation.developer_approval_required` | MUST remain `true` -- never allow false |
| `resilience.circuit_breaker.failure_threshold` | MUST be >= 1 -- zero disables safety |
| `resilience.strategy_rotation.failure_threshold` | MUST be >= 1 |

## Read-Only Fields

These fields cannot be edited via brain-config Edit mode:

`brain_id`, `version`, `created_at`, `project_root`, `brain_root`,
`database.path`, `database.schema_version`, `hooks.profiles`

---

## Field Validation Table

| Field Path | Type | Valid Values / Range | Default |
|------------|------|---------------------|---------|
| hooks.profile | enum | minimal, standard | standard |
| hooks.individual_overrides.{name} | boolean | true, false | -- |
| linters.{.ext} | string | non-empty shell command | -- |
| resilience.circuit_breaker.enabled | boolean | true, false | true |
| resilience.circuit_breaker.failure_threshold | integer | 1 - 20 | 3 |
| resilience.circuit_breaker.cooldown_seconds | integer | 30 - 3600 | 300 |
| resilience.circuit_breaker.window_seconds | integer | 60 - 7200 | 600 |
| resilience.strategy_rotation.enabled | boolean | true, false | true |
| resilience.strategy_rotation.failure_threshold | integer | 1 - 10 | 2 |
| resilience.strategy_rotation.max_retry_per_strategy | integer | 1 - 5 | 2 |
| resilience.strategy_rotation.strategies | string[] | non-empty array | ["default","alternative","minimal","escalate","human"] |
| subagents.enabled | boolean | true, false | true |
| subagents.dispatch_threshold | integer | 1 - 100 | 20 |
| subagents.parallel_review | boolean | true, false | true |
| subagents.fallback_to_inline | boolean | true, false | true |
| subagents.model_overrides.{role} | enum/null | null, opus, sonnet, haiku | null |
| learning.confidence_initial | number | 0.0 - 1.0 | 0.3 |
| learning.promotion_threshold | number | 0.0 - 1.0 | 0.7 |
| learning.min_occurrences_for_promotion | integer | 1 - 100 | 3 |
| learning.scope_default | enum | project, global | project |
| learning.auto_promote_to_global | boolean | true, false | false |
| context_loading.tier_1_max_tokens | integer | 1000 - 20000 | 4000 |
| context_loading.tier_2_max_tokens | integer | 5000 - 50000 | 15000 |
| context_loading.tier_3_max_tokens | integer | 1000 - 20000 | 5000 |
| context_loading.tier_1_always_loaded | string[] | non-empty array | ["hippocampus_summary","current_task","top_3_lessons"] |
| context_loading.tier_2_default_count | integer | 1 - 20 | 5 |
| context_loading.tier_3_on_demand | boolean | true, false | true |
| context_loading.persistent_mind_cache | string | valid path | .brain/working-memory/agent-state.md |
| consolidation.trigger | string | non-empty | explicit_command_or_5_tasks |
| consolidation.auto_propose_updates | boolean | true, false | true |
| consolidation.developer_approval_required | boolean | true (protected) | true |
| weight_decay.enabled | boolean | true, false | true |
| weight_decay.rate_per_day | number | 0.001 - 0.1 | 0.005 |
| weight_decay.min_weight | number | 0.01 - 0.5 | 0.1 |
| weight_decay.max_stale_days | integer | 7 - 365 | 90 |
