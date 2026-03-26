# Plan A: brain-setup Interactive Configuration Wizard

**Date:** 2026-03-26
**Status:** In Progress
**Author:** ForgeFlow contributors

## Goal

Add a `/brain-setup` skill that provides an interactive configuration wizard for `brain.config.json`. The wizard allows developers to browse, edit, validate, and diff configuration changes across all 10+ sections of brain.config.json without manually editing JSON.

## Motivation

`brain.config.json` has 50+ configurable options across 10 sections (hooks, linters, resilience, subagents, learning, context_loading, token_budgets, token_optimization, consolidation, lesson_escalation, weight_decay). Manual editing is error-prone and requires knowledge of valid value ranges. An interactive wizard with validation prevents misconfigurations that could break the brain pipeline.

## Architecture

```
/brain-setup  (SKILL.md — interactive wizard UI)
     |
     v
mcp/brain-config-server.js  (MCP-style server — pure Node.js, zero deps)
     |
     +-- brain_config_read(section?)      -> returns current config or section
     +-- brain_config_write(section, key, value) -> writes validated value
     +-- brain_config_validate(section?, key?, value?) -> validates config
     +-- brain_config_diff(original, modified) -> returns diff
```

## Tasks

### Task 1: Create Plan Document
- Write this plan at `docs/superpowers/plans/2026-03-26-brain-setup-config-wizard.md`
- Commit

### Task 2: Create SKILL.md
- Create `skills/brain-setup/SKILL.md` with full interactive wizard logic
- Frontmatter: `name: brain-setup`, `description: ...`
- Menu-driven section navigation
- Markdown table display of current values
- Inline change acceptance with validation
- Before/after diff display
- Change logging to `.brain/progress/activity.md`

### Task 3: Create MCP Server
- Create `mcp/brain-config-server.js` — pure Node.js, zero npm dependencies
- Model after `hooks/brain-hooks.js` (stdin JSON -> stdout JSON)
- Implement 4 tools:
  - `brain_config_read` — read entire config or a specific section
  - `brain_config_write` — write a validated value to a section.key
  - `brain_config_validate` — validate a value against schema constraints
  - `brain_config_diff` — compute diff between original and modified config
- Full validation schema with types, ranges, enums, and descriptions for every field

### Task 4: Register Skill in plugin.json
- Add `brain-setup` entry to `.claude-plugin/plugin.json` skills array
- Trigger: `/brain-setup [section]`

### Task 5: Create Tests
- Create `tests/brain-config-server.test.js`
- Test all 4 MCP tools
- Test validation rules (type checks, range checks, enum checks)
- Test diff generation
- Test error handling (missing file, invalid JSON, unknown section)

### Task 6: Update Documentation
- Add brain-setup to CHANGELOG.md
- Add usage examples

## Validation Schema Summary

Every field in brain.config.json gets:
- **Type constraint**: string, number, boolean, array, object
- **Range/enum**: min/max for numbers, allowed values for enums
- **Description**: human-readable explanation shown in the wizard

## Sections

| Section | Key Count | Description |
|---------|-----------|-------------|
| database | 2 | DB path and schema version |
| hooks | 3 | Profile, profiles map, individual overrides |
| linters | 5 | File extension to linter command mapping |
| resilience | 2 | Circuit breaker and strategy rotation |
| subagents | 5 | Dispatch threshold, models, fallback |
| learning | 5 | Confidence scoring and promotion |
| context_loading | 7 | Token budgets per tier, always-loaded items |
| token_budgets | 7 | Per-agent token in/out limits |
| token_optimization | 2 | Compact threshold and pressure levels |
| consolidation | 3 | Trigger, auto-propose, approval required |
| lesson_escalation | 2 | Threshold and action |
| weight_decay | 4 | Rate, min weight, max stale days |

## Success Criteria

1. `/brain-setup` with no args shows section menu
2. `/brain-setup hooks` shows hooks section as markdown table
3. Values are validated before writing
4. Diff is shown before committing changes
5. All changes are logged
6. MCP server passes all tests
7. Skill registered in plugin.json
