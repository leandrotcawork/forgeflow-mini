---
name: brain-setup
description: "Interactive configuration wizard for brain.config.json — browse, edit, validate, and diff all Brain settings"
---

# brain-setup Skill — Interactive Configuration Wizard

**Purpose:** Provide an interactive, menu-driven wizard to browse, edit, validate, and diff all settings in `.brain/brain.config.json`. Prevents misconfigurations by enforcing type constraints, value ranges, and enum validation before writing changes.

**Token Budget:** 8k in / 4k out

## Command

```
/brain-setup [section] [--reset section] [--export] [--dry-run]
```

## Input

- **section** (optional): Jump directly to a specific config section. If omitted, show the section menu.
  - Valid sections: `database`, `cortex_regions`, `hooks`, `linters`, `resilience`, `subagents`, `learning`, `context_loading`, `token_budgets`, `token_optimization`, `consolidation`, `lesson_escalation`, `weight_decay`
- **--reset section** (optional): Reset a section to its template defaults.
- **--export** (optional): Output the entire current config as a formatted JSON code block.
- **--dry-run** (optional): Show what changes would be made without writing to disk.

## Prerequisites

- `.brain/brain.config.json` must exist (run `/brain-init` first)
- The MCP config server at `mcp/brain-config-server.js` provides the backend tools

## Execution Flow

### Step 1: Load Current Configuration

Read `.brain/brain.config.json` from the project root.

If the file does not exist, output:
```
brain.config.json not found. Run /brain-init first to initialize the Brain.
```
And stop.

If `--export` flag is present, output the entire config as a formatted JSON code block and stop.

### Step 2: Section Menu (no args)

**Pre-Step: Flag extraction**
Parse and strip all flags from the arguments before checking the section name:
- `--dry-run` → set DRY_RUN=true, remove from args
- `--reset` → set RESET=true, remove from args
- `--export` → set EXPORT=true, remove from args

The remaining token (if any) is the section name. This prevents flags from being
treated as section names (e.g., `/brain-setup --dry-run` would otherwise hit
"Unknown section: --dry-run").

If no section argument is provided, display the section menu:

```markdown
# Brain Configuration Wizard

Current config: .brain/brain.config.json
Brain ID: {brain_id} | Version: {version}

## Sections

| # | Section | Keys | Description |
|---|---------|------|-------------|
| 1 | database | 2 | Database path and schema version |
| 2 | cortex_regions | 1 | Brain domain regions — add/remove domain directories (e.g., backend, frontend) |
| 3 | hooks | 3 | Hook profile, profiles map, individual overrides |
| 4 | linters | 5 | File extension to linter command mapping |
| 5 | resilience | 2 subsections (8 editable fields) | Resilience settings — circuit_breaker (4 fields) + strategy_rotation (4 fields) |
| 6 | subagents | 5 | Subagent dispatch, models, and fallback |
| 7 | learning | 5 | Confidence scoring and lesson promotion |
| 8 | context_loading | 7 | Token budgets per tier and always-loaded items |
| 9 | token_budgets | 8 | Per-agent token in/out limits |
| 10 | token_optimization | 2 | Compact threshold and context pressure levels |
| 11 | consolidation | 3 | Trigger mode, auto-propose, approval required |
| 12 | lesson_escalation | 2 | Escalation threshold and action |
| 13 | weight_decay | 4 | Decay rate, min weight, max stale days |

To configure a section: `/brain-setup <section-name>`
Example: `/brain-setup hooks`
```

Then ask the developer which section they want to configure.

### Step 3: Display Section Details

When a section is selected (either by argument or from the menu), display its current values as a markdown table.

Use the validation schema below to show descriptions, types, and current values.

Format for **flat sections** (e.g., `learning`, `consolidation`):

```markdown
## Section: learning

| Key | Current Value | Type | Range/Allowed | Description |
|-----|---------------|------|---------------|-------------|
| confidence_initial | 0.3 | number | 0.0 - 1.0 | Initial confidence score for new lessons |
| promotion_threshold | 0.7 | number | 0.0 - 1.0 | Confidence threshold to promote a lesson |
| min_occurrences_for_promotion | 3 | integer | 1 - 100 | Minimum times a lesson must occur before promotion |
| scope_default | "project" | enum | project, global | Default scope for new lessons |
| auto_promote_to_global | false | boolean | true, false | Automatically promote high-confidence lessons to global |

To change a value: tell me the key and new value
Example: "Set confidence_initial to 0.4"
```

Format for **nested sections** (e.g., `resilience`, `token_budgets`):

```markdown
## Section: resilience

### resilience.circuit_breaker

| Key | Current Value | Type | Range/Allowed | Description |
|-----|---------------|------|---------------|-------------|
| enabled | true | boolean | true, false | Enable/disable the circuit breaker |
| failure_threshold | 3 | integer | 1 - 20 | Failures before circuit opens |
| cooldown_seconds | 300 | integer | 30 - 3600 | Seconds to wait before half-open |
| window_seconds | 600 | integer | 60 - 7200 | Time window for counting failures |

### resilience.strategy_rotation

| Key | Current Value | Type | Range/Allowed | Description |
|-----|---------------|------|---------------|-------------|
| enabled | true | boolean | true, false | Enable/disable strategy rotation |
| failure_threshold | 2 | integer | 1 - 10 | Consecutive failures before suggesting rotation |
| max_retry_per_strategy | 2 | integer | 1 - 5 | Max retries before moving to next strategy |
| strategies | ["default", ...] | array | string[] | Ordered list of fallback strategies |
```

#### cortex_regions

Display as a numbered list:
```
cortex_regions (string array)
────────────────────────────────
  1. backend
  2. frontend
  3. database
  4. infra
────────────────────────────────
```
To add a region: "Add [region-name] to cortex_regions"
To remove a region: "Remove [region-name] from cortex_regions"
Key for brain_config_write: 'cortex_regions' (top-level array)

**Array fields** (e.g., `context_loading.tier_1_always_loaded`, `resilience.strategy_rotation.strategies`):

Display inline as a bracketed list:
```
tier_1_always_loaded: ["hippocampus_summary", "current_task", "top_3_lessons"]
```

To edit: user says "Set tier_1_always_loaded to [hippocampus_summary, current_task]"
Parse: split on comma + optional space, trim brackets, build string array.
Write: brainConfigWrite({ key: 'context_loading.tier_1_always_loaded', value: ['hippocampus_summary', 'current_task'] })

### Step 4: Accept Changes

When the developer specifies a change, validate it using the validation schema:

1. **Parse the request**: Extract the key path and new value.
   - Simple: `"Set confidence_initial to 0.4"`
   - Nested: `"Set circuit_breaker.failure_threshold to 5"`
   - Linter: `"Set .rs to 'cargo clippy --fix'"`

2. **Validate the value**:
   - **Type check**: Is the value the correct type (string, number, boolean, integer, array)?
   - **Range check**: For numbers, is it within min/max?
   - **Enum check**: For enums, is it one of the allowed values?
   - **Pattern check**: For paths, does it match expected patterns?

3. **If validation fails**, show the error:
   ```
   Validation error: "failure_threshold" must be an integer between 1 and 20. Got: 0
   ```

3b. **Before writing:** Check if the target field is marked `readonly` in the validation schema.
   If readonly (applies to: `hooks.profiles`, `brain_id`, `version`, `created_at`, `project_root`, `brain_root`, `database.path`, `database.schema_version`):
     → Reject: "❌ `[field]` is read-only and cannot be edited via brain-setup."
     → Return to section display (Step 3). Do not call brain_config_write.

4. **If validation passes**, proceed to Step 5.

Multiple changes can be batched before showing the diff. Ask:
```
Change queued. Any more changes to this section, or should I show the diff?
```

### Step 5: Show Before/After Diff

Before writing any changes, display a diff:

```markdown
## Proposed Changes

### Section: learning

| Key | Before | After |
|-----|--------|-------|
| confidence_initial | 0.3 | **0.4** |
| promotion_threshold | 0.7 | **0.8** |

Apply these changes? (yes/no)
```

If `--dry-run` flag was set, show the diff and stop without writing.

### Step 6: Write Changes

If the developer approves:

1. Write the updated config to `.brain/brain.config.json`
2. Log the changes to `.brain/progress/activity.md`:
   ```markdown
   ## [YYYY-MM-DD HH:MM] brain-setup: config changes
   - learning.confidence_initial: 0.3 -> 0.4
   - learning.promotion_threshold: 0.7 -> 0.8
   ```
3. Confirm:
   ```
   Config updated. 2 changes written to .brain/brain.config.json
   Changes logged to .brain/progress/activity.md
   ```

### Step 7: Continue or Exit

After writing changes, ask:
```
Configure another section? (section name or "done")
```

If the developer says "done" or similar, output a summary of all changes made in this session.

## Reset Flow (--reset)

When `--reset section` is used:

1. Read the default template config via the MCP server's special `_template` section:
     Call: brain_config_read({ section: '_template' })
     The server resolves the template path internally (relative to its own location).
     This avoids hardcoding the plugin install directory in the skill.

   Then for the selected section, merge in the template values using brain_config_write for each field.
2. Extract the specified section from the template
3. Show the diff between current and template values
4. Ask for confirmation
5. Write the template values for that section only (preserve all other sections)
6. Log the reset to activity.md

## Validation Schema

The following schema defines all valid fields, their types, constraints, and descriptions. Use this for validation in Step 4.

### Top-level fields

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| brain_id | string | non-empty | Unique identifier for this brain instance |
| version | string | semver pattern | Plugin version that created this config |
| created_at | string | ISO 8601 datetime | When this brain was initialized |
| project_root | string | path | Project root directory (relative or absolute) |
| brain_root | string | path | Brain directory path (relative or absolute) |

### database

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| path | string | read-only | Path to brain.db SQLite database |
| schema_version | integer | read-only | Database schema version number |

### cortex_regions

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| (array) | string[] | non-empty | List of active cortex region names |

### hooks

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| profile | enum | minimal, standard, strict | Active hook profile |
| profiles | object | read-only | Profile descriptions (informational) |
| individual_overrides | object | key: hookName, value: boolean | Per-hook enable/disable overrides |

### linters

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| (each key) | string | file extension starting with `.` | Maps file extension to linter command |
| (each value) | string | non-empty | Shell command to run for linting |

**Key format:** Linter keys use double-dot notation: `linters..rs` (not `linters.rs`).
The first dot separates the section name from the key; the second dot is part of the file extension.
Example: To set the Rust linter → key: `linters..rs`, value: `'cargo clippy --fix'`

### resilience.circuit_breaker

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| enabled | boolean | - | Enable/disable the circuit breaker |
| failure_threshold | integer | 1 - 20 | Number of failures before circuit opens |
| cooldown_seconds | integer | 30 - 3600 | Seconds to wait in open state before half-open |
| window_seconds | integer | 60 - 7200 | Time window (seconds) for counting failures |

### resilience.strategy_rotation

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| enabled | boolean | - | Enable/disable strategy rotation |
| failure_threshold | integer | 1 - 10 | Consecutive failures before suggesting rotation |
| max_retry_per_strategy | integer | 1 - 5 | Max retries on each strategy before advancing |
| strategies | string[] | non-empty array | Ordered list of fallback strategy names |

### subagents

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| enabled | boolean | - | Enable/disable subagent dispatch |
| dispatch_threshold | integer | 1 - 100 | Complexity score threshold for dispatch |
| parallel_review | boolean | - | Allow parallel review subagents |
| fallback_to_inline | boolean | - | Fall back to inline execution if dispatch fails |
| model_overrides | object | keys: agent role, values: string or null | Model override per agent role (null = default) |

### subagents.model_overrides

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| implementation | enum/null | null, opus, sonnet, haiku | Model for implementation agents |
| review | enum/null | null, opus, sonnet, haiku | Model for review agents |
| document | enum/null | null, opus, sonnet, haiku | Model for documentation agents |
| research | enum/null | null, opus, sonnet, haiku | Model for research agents |
| status | enum/null | null, opus, sonnet, haiku | Model for status agents |

### learning

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| confidence_initial | number | 0.0 - 1.0 | Initial confidence score for new lessons |
| promotion_threshold | number | 0.0 - 1.0 | Confidence threshold to promote a lesson |
| min_occurrences_for_promotion | integer | 1 - 100 | Minimum occurrences before promotion eligible |
| scope_default | enum | project, global | Default scope for newly captured lessons |
| auto_promote_to_global | boolean | - | Auto-promote high-confidence lessons to global scope |

### context_loading

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| tier_1_max_tokens | integer | 1000 - 20000 | Max tokens for Tier 1 (always-loaded) context |
| tier_2_max_tokens | integer | 5000 - 50000 | Max tokens for Tier 2 (task-relevant) context |
| tier_3_max_tokens | integer | 1000 - 20000 | Max tokens for Tier 3 (on-demand) context |
| tier_1_always_loaded | string[] | non-empty array | Items always loaded in Tier 1 |
| tier_2_default_count | integer | 1 - 20 | Default number of sinapses to load in Tier 2 |
| tier_3_on_demand | boolean | - | Load Tier 3 only when explicitly requested |
| persistent_mind_cache | string | path | Path to persistent agent state file |

### token_budgets

Each sub-key (context_mapper, mckinsey_layer, planner, implementer, reviewer, documenter, learner, verifier) has:

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| in | integer | 1000 - 100000 | Max input tokens for this agent |
| out | integer | 500 - 50000 | Max output tokens for this agent |
| subagent_budget | integer | 1000 - 100000 | (optional) Token budget for spawned subagents |
| high_stakes_only | boolean | - | (optional) Only activate for high-stakes tasks |

### token_optimization

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| compact_suggestion_threshold | integer | 10 - 100 | % context usage before suggesting compaction |
| context_pressure_levels | object | keys: low/moderate/high/critical, values: 0.0-1.0 | Threshold ratios for each pressure level |

### token_optimization.context_pressure_levels

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| low | number | 0.0 - 1.0 | Threshold ratio for "low" pressure |
| moderate | number | 0.0 - 1.0 | Threshold ratio for "moderate" pressure |
| high | number | 0.0 - 1.0 | Threshold ratio for "high" pressure |
| critical | number | 0.0 - 1.0 | Threshold ratio for "critical" pressure |

### consolidation

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| trigger | string | non-empty | When to trigger consolidation (e.g., "explicit_command_or_5_tasks") |
| auto_propose_updates | boolean | - | Automatically propose sinapse updates during consolidation |
| developer_approval_required | boolean | - | Require developer approval before applying updates |

### lesson_escalation

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| threshold | integer | 1 - 20 | Number of matching lessons before escalation |
| action | enum | propose_hippocampus_convention, auto_escalate, notify_only | What to do when threshold is reached |

### weight_decay

| Key | Type | Constraint | Description |
|-----|------|-----------|-------------|
| enabled | boolean | - | Enable/disable automatic weight decay |
| rate_per_day | number | 0.001 - 0.1 | Daily decay rate applied to sinapse weights |
| min_weight | number | 0.01 - 0.5 | Minimum weight (floor) after decay |
| max_stale_days | integer | 7 - 365 | Days of inactivity before a sinapse is considered stale |

## Error Handling

- **File not found**: Direct to `/brain-init`
- **Invalid JSON**: Report parse error, suggest manual fix or `--reset`
- **Unknown section**: List valid sections
- **Unknown key**: List valid keys for that section
- **Validation failure**: Show constraint and current value, suggest valid alternatives

## Output

- Interactive markdown tables with current config values
- Before/after diff for proposed changes
- Confirmation prompts before writing
- Change log appended to activity.md
- Summary of all changes at session end

## Example

```bash
/brain-setup learning

# Output:
# ## Section: learning
#
# | Key | Current Value | Type | Range/Allowed | Description |
# |-----|---------------|------|---------------|-------------|
# | confidence_initial | 0.3 | number | 0.0 - 1.0 | Initial confidence score for new lessons |
# | promotion_threshold | 0.7 | number | 0.0 - 1.0 | Confidence threshold to promote a lesson |
# | min_occurrences_for_promotion | 3 | integer | 1 - 100 | Min occurrences before promotion |
# | scope_default | "project" | enum | project, global | Default scope for new lessons |
# | auto_promote_to_global | false | boolean | true, false | Auto-promote to global scope |
#
# Developer: "Set confidence_initial to 0.5 and promotion_threshold to 0.8"
#
# ## Proposed Changes
#
# | Key | Before | After |
# |-----|--------|-------|
# | confidence_initial | 0.3 | **0.5** |
# | promotion_threshold | 0.7 | **0.8** |
#
# Apply these changes? (yes/no)
# > yes
#
# Config updated. 2 changes written to .brain/brain.config.json
# Changes logged to .brain/progress/activity.md
```

---

**Created:** 2026-03-26 | **Agent Type:** Configuration
