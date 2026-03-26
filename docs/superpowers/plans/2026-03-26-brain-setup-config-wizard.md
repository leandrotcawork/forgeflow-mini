# brain-setup — Interactive Configuration Wizard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/brain-setup` skill that provides an interactive, guided configuration wizard for all 50+ brain.config.json options, plus an MCP config server for external tool integration.

**Architecture:** A new SKILL.md-based wizard that presents config sections one-at-a-time as markdown forms, validates input, shows before/after diffs, and writes changes with audit logging. An MCP config server (Node.js) exposes config as queryable JSON for future UI tools. Both read/write the same `.brain/brain.config.json`.

**Tech Stack:** Markdown (SKILL.md), Node.js (MCP server), JSON (config schema), SQLite (audit log in brain.db)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `skills/brain-setup/SKILL.md` | Interactive config wizard — guided multi-step flow |
| `mcp/brain-config-server.js` | MCP server exposing config read/write/validate tools |
| `mcp/config-schema.json` | JSON Schema for brain.config.json validation |
| `templates/brain/brain.config.json` | Template updated with schema comments |
| `.claude-plugin/plugin.json` | Register new skill |

---

### Task 1: Create config-schema.json (validation source of truth)

**Files:**
- Create: `mcp/config-schema.json`

- [ ] **Step 1: Create the JSON Schema file**

Define a JSON Schema that validates every field in brain.config.json. The schema has 7 top-level sections: hooks, linters, resilience, subagents, learning, context_loading, token_budgets, token_optimization, consolidation, lesson_escalation, weight_decay.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["brain_id", "version", "brain_root", "database", "cortex_regions"],
  "properties": {
    "brain_id": { "type": "string", "description": "Unique brain instance identifier" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "created_at": { "type": "string", "format": "date-time" },
    "project_root": { "type": "string", "default": "." },
    "brain_root": { "type": "string", "default": ".brain" },
    "database": {
      "type": "object",
      "properties": {
        "path": { "type": "string", "default": ".brain/brain.db" },
        "schema_version": { "type": "integer", "minimum": 1 }
      }
    },
    "cortex_regions": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["backend", "frontend", "database", "infra"],
      "description": "Project domains — each gets a cortex/ subdirectory"
    },
    "hooks": {
      "type": "object",
      "properties": {
        "profile": { "type": "string", "enum": ["minimal", "standard", "strict"], "default": "standard" },
        "individual_overrides": { "type": "object" }
      }
    },
    "linters": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "File extension -> linter command mapping"
    },
    "resilience": {
      "type": "object",
      "properties": {
        "circuit_breaker": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "failure_threshold": { "type": "integer", "minimum": 1, "maximum": 10, "default": 3 },
            "cooldown_seconds": { "type": "integer", "minimum": 30, "maximum": 3600, "default": 300 },
            "window_seconds": { "type": "integer", "minimum": 60, "maximum": 7200, "default": 600 }
          }
        },
        "strategy_rotation": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "failure_threshold": { "type": "integer", "minimum": 1, "maximum": 5, "default": 2 },
            "max_retry_per_strategy": { "type": "integer", "minimum": 1, "maximum": 5, "default": 2 },
            "strategies": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "subagents": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "dispatch_threshold": { "type": "integer", "minimum": 0, "maximum": 100, "default": 20 },
        "parallel_review": { "type": "boolean", "default": true },
        "fallback_to_inline": { "type": "boolean", "default": true },
        "model_overrides": {
          "type": "object",
          "properties": {
            "implementation": { "type": ["string", "null"], "enum": ["haiku", "sonnet", "opus", null] },
            "review": { "type": ["string", "null"], "enum": ["haiku", "sonnet", "opus", null] },
            "document": { "type": ["string", "null"], "enum": ["haiku", "sonnet", "opus", null] },
            "research": { "type": ["string", "null"], "enum": ["haiku", "sonnet", "opus", null] },
            "status": { "type": ["string", "null"], "enum": ["haiku", "sonnet", "opus", null] }
          }
        }
      }
    },
    "learning": {
      "type": "object",
      "properties": {
        "confidence_initial": { "type": "number", "minimum": 0.1, "maximum": 0.5, "default": 0.3 },
        "promotion_threshold": { "type": "number", "minimum": 0.5, "maximum": 1.0, "default": 0.7 },
        "min_occurrences_for_promotion": { "type": "integer", "minimum": 2, "maximum": 10, "default": 3 },
        "scope_default": { "type": "string", "enum": ["project", "global"], "default": "project" },
        "auto_promote_to_global": { "type": "boolean", "default": false }
      }
    },
    "context_loading": {
      "type": "object",
      "properties": {
        "tier_1_max_tokens": { "type": "integer", "minimum": 1000, "maximum": 10000, "default": 4000 },
        "tier_2_max_tokens": { "type": "integer", "minimum": 5000, "maximum": 30000, "default": 15000 },
        "tier_3_max_tokens": { "type": "integer", "minimum": 1000, "maximum": 10000, "default": 5000 },
        "tier_2_default_count": { "type": "integer", "minimum": 1, "maximum": 15, "default": 5 },
        "tier_3_on_demand": { "type": "boolean", "default": true }
      }
    },
    "token_budgets": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "in": { "type": "integer", "minimum": 1000 },
          "out": { "type": "integer", "minimum": 500 },
          "subagent_budget": { "type": "integer" },
          "high_stakes_only": { "type": "boolean" }
        },
        "required": ["in", "out"]
      }
    },
    "token_optimization": {
      "type": "object",
      "properties": {
        "compact_suggestion_threshold": { "type": "integer", "minimum": 10, "maximum": 90, "default": 50 },
        "context_pressure_levels": {
          "type": "object",
          "properties": {
            "low": { "type": "number" },
            "moderate": { "type": "number" },
            "high": { "type": "number" },
            "critical": { "type": "number" }
          }
        }
      }
    },
    "weight_decay": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "rate_per_day": { "type": "number", "minimum": 0.001, "maximum": 0.05, "default": 0.005 },
        "min_weight": { "type": "number", "minimum": 0.0, "maximum": 0.5, "default": 0.1 },
        "max_stale_days": { "type": "integer", "minimum": 30, "maximum": 365, "default": 90 }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp/config-schema.json
git commit -m "feat(brain-setup): add JSON Schema for brain.config.json validation"
```

---

### Task 2: Create the brain-setup SKILL.md

**Files:**
- Create: `skills/brain-setup/SKILL.md`

- [ ] **Step 1: Write the skill file**

The skill presents config as interactive sections. Each section shows current values, accepts changes, validates, and previews diff before writing.

Write the full SKILL.md with these sections:
1. **Quick Mode** (`/brain-setup` with no args) — show all sections as a menu, let user pick
2. **Direct Mode** (`/brain-setup set resilience.circuit_breaker.cooldown_seconds 600`) — set a specific value
3. **Section Mode** (`/brain-setup subagents`) — configure one full section interactively
4. **Export/Import** (`/brain-setup export` / `brain-setup import config.json`) — backup/restore

Each section should:
- Display current values as a markdown table
- Accept changes inline
- Validate against config-schema.json
- Show a before/after diff
- Require developer approval before writing
- Log changes to `.brain/progress/config-changes.log`

Config sections to present:
1. **Model Selection** — subagents.model_overrides (which model for each role)
2. **Hook Profile** — hooks.profile + individual_overrides
3. **Linters** — file extension -> command mapping
4. **Resilience** — circuit breaker + strategy rotation params
5. **Context Loading** — tier token limits, tier 2 count, tier 3 behavior
6. **Token Budgets** — per-layer in/out/subagent budgets
7. **Learning** — confidence, promotion, scope
8. **Weight Decay** — enabled, rate, min weight, stale days
9. **Cortex Regions** — add/remove project domains
10. **Advanced** — token optimization, consolidation, lesson escalation

- [ ] **Step 2: Commit**

```bash
git add skills/brain-setup/SKILL.md
git commit -m "feat(brain-setup): interactive config wizard skill with 10 config sections"
```

---

### Task 3: Create MCP config server

**Files:**
- Create: `mcp/brain-config-server.js`

- [ ] **Step 1: Write the MCP server**

A Node.js MCP server that exposes 4 tools:
1. `brain_config_read` — read full config or a specific section
2. `brain_config_write` — write a validated config change
3. `brain_config_validate` — validate a proposed change against schema
4. `brain_config_diff` — show diff between current and proposed config

The server reads `.brain/brain.config.json` from cwd, validates against `config-schema.json`, and logs all writes to `.brain/progress/config-changes.log`.

Pure Node.js, zero npm dependencies (like brain-hooks.js).

- [ ] **Step 2: Commit**

```bash
git add mcp/brain-config-server.js
git commit -m "feat(brain-setup): MCP config server with read/write/validate/diff tools"
```

---

### Task 4: Register skill + update plugin.json

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Add brain-setup to the skills array**

Add after brain-codex-review:
```json
{
  "name": "brain-setup",
  "description": "Interactive configuration wizard -- set model selection, token budgets, hook profiles, and all Brain settings",
  "trigger": "/brain-setup [section|set key value]"
}
```

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat(brain-setup): register skill in plugin.json"
```

---

### Task 5: Add config change audit logging

**Files:**
- Modify: `docs/brain-db-schema.sql`

- [ ] **Step 1: Add config_changes table to schema**

```sql
CREATE TABLE IF NOT EXISTS config_changes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    section     TEXT NOT NULL,
    key         TEXT NOT NULL,
    old_value   TEXT,
    new_value   TEXT NOT NULL,
    changed_by  TEXT DEFAULT 'brain-setup',
    changed_at  TEXT NOT NULL
);
```

- [ ] **Step 2: Add to build_brain_db.py**

Add the CREATE TABLE statement to the schema creation section.

- [ ] **Step 3: Commit**

```bash
git add docs/brain-db-schema.sql scripts/build_brain_db.py
git commit -m "feat(brain-setup): add config_changes audit table to brain.db schema"
```

---

### Task 6: Final verification + integration test

- [ ] **Step 1: Verify skill loads**

Check that the SKILL.md frontmatter is valid and the plugin.json is valid JSON.

- [ ] **Step 2: Test MCP server standalone**

```bash
echo '{}' | node mcp/brain-config-server.js brain_config_read
```

- [ ] **Step 3: Commit all**

```bash
git add -A
git commit -m "feat(brain-setup): complete config wizard + MCP server + audit logging"
```
