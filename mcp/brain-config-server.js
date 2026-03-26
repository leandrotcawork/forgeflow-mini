#!/usr/bin/env node

/**
 * ForgeFlow Mini — Brain Config MCP Server
 *
 * Pure Node.js, zero npm dependencies.
 * Reads JSON from stdin, dispatches to the requested tool, prints JSON to stdout.
 *
 * Tools:
 *   brain_config_read     — Read entire config or a specific section
 *   brain_config_write    — Write a validated value to section.key
 *   brain_config_validate — Validate a value against schema constraints
 *   brain_config_diff     — Compute diff between original and modified config
 *
 * Usage:
 *   echo '{"tool":"brain_config_read","args":{"section":"hooks"}}' | node mcp/brain-config-server.js
 *   echo '{"tool":"brain_config_read"}' | node mcp/brain-config-server.js
 *
 * Modeled after hooks/brain-hooks.js — stdin JSON -> stdout JSON pattern.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function brainRoot() {
  return path.join(process.cwd(), '.brain');
}

function configPath() {
  return path.join(brainRoot(), 'brain.config.json');
}

function templateConfigPath() {
  // Resolve relative to this script's location (plugin directory)
  return path.join(__dirname, '..', 'templates', 'brain', 'brain.config.json');
}

function activityLogPath() {
  return path.join(brainRoot(), 'progress', 'activity.md');
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJSON(filePath, data) {
  try {
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function success(data) {
  return { ok: true, data: data };
}

function error(message) {
  return { ok: false, error: message };
}

function timestamp() {
  var d = new Date();
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

/**
 * Schema definition for every configurable field in brain.config.json.
 * Each entry: { type, constraint?, min?, max?, enum?, items?, description }
 *
 * Types: "string", "number", "integer", "boolean", "array", "object", "enum", "nullable_enum"
 */
var SCHEMA = {
  // Top-level scalars (read-only in the wizard — informational)
  brain_id:     { type: 'string', description: 'Unique identifier for this brain instance', readonly: true },
  version:      { type: 'string', description: 'Plugin version that created this config', readonly: true },
  created_at:   { type: 'string', description: 'When this brain was initialized (ISO 8601)', readonly: true },
  project_root: { type: 'string', description: 'Project root directory', readonly: true },
  brain_root:   { type: 'string', description: 'Brain directory path', readonly: true },

  // database
  'database.path':           { type: 'string', description: 'Path to brain.db SQLite database' },
  'database.schema_version': { type: 'integer', min: 1, max: 100, description: 'Database schema version number' },

  // cortex_regions
  'cortex_regions': { type: 'array', items: 'string', description: 'List of active cortex region names' },

  // hooks
  'hooks.profile':              { type: 'enum', enum: ['minimal', 'standard', 'strict'], description: 'Active hook profile' },
  'hooks.profiles':             { type: 'object', description: 'Profile descriptions (informational)', readonly: true },
  'hooks.individual_overrides': { type: 'object', description: 'Per-hook enable/disable overrides (key: hookName, value: boolean)' },

  // linters (dynamic keys — handled specially)
  'linters': { type: 'object', description: 'Map of file extension to linter command', dynamic: true },

  // resilience.circuit_breaker
  'resilience.circuit_breaker.enabled':           { type: 'boolean', description: 'Enable/disable the circuit breaker' },
  'resilience.circuit_breaker.failure_threshold':  { type: 'integer', min: 1, max: 20, description: 'Failures before circuit opens' },
  'resilience.circuit_breaker.cooldown_seconds':   { type: 'integer', min: 30, max: 3600, description: 'Seconds to wait in open state before half-open' },
  'resilience.circuit_breaker.window_seconds':     { type: 'integer', min: 60, max: 7200, description: 'Time window (seconds) for counting failures' },

  // resilience.strategy_rotation
  'resilience.strategy_rotation.enabled':              { type: 'boolean', description: 'Enable/disable strategy rotation' },
  'resilience.strategy_rotation.failure_threshold':    { type: 'integer', min: 1, max: 10, description: 'Consecutive failures before suggesting rotation' },
  'resilience.strategy_rotation.max_retry_per_strategy': { type: 'integer', min: 1, max: 5, description: 'Max retries on each strategy before advancing' },
  'resilience.strategy_rotation.strategies':           { type: 'array', items: 'string', description: 'Ordered list of fallback strategy names' },

  // subagents
  'subagents.enabled':             { type: 'boolean', description: 'Enable/disable subagent dispatch' },
  'subagents.dispatch_threshold':  { type: 'integer', min: 1, max: 100, description: 'Complexity score threshold for dispatch' },
  'subagents.parallel_review':     { type: 'boolean', description: 'Allow parallel review subagents' },
  'subagents.fallback_to_inline':  { type: 'boolean', description: 'Fall back to inline execution if dispatch fails' },
  'subagents.model_overrides.implementation': { type: 'nullable_enum', enum: [null, 'opus', 'sonnet', 'haiku'], description: 'Model for implementation agents (null = default)' },
  'subagents.model_overrides.review':         { type: 'nullable_enum', enum: [null, 'opus', 'sonnet', 'haiku'], description: 'Model for review agents (null = default)' },
  'subagents.model_overrides.document':       { type: 'nullable_enum', enum: [null, 'opus', 'sonnet', 'haiku'], description: 'Model for documentation agents (null = default)' },
  'subagents.model_overrides.research':       { type: 'nullable_enum', enum: [null, 'opus', 'sonnet', 'haiku'], description: 'Model for research agents (null = default)' },
  'subagents.model_overrides.status':         { type: 'nullable_enum', enum: [null, 'opus', 'sonnet', 'haiku'], description: 'Model for status agents (null = default)' },

  // learning
  'learning.confidence_initial':            { type: 'number', min: 0.0, max: 1.0, description: 'Initial confidence score for new lessons' },
  'learning.promotion_threshold':           { type: 'number', min: 0.0, max: 1.0, description: 'Confidence threshold to promote a lesson' },
  'learning.min_occurrences_for_promotion': { type: 'integer', min: 1, max: 100, description: 'Minimum occurrences before promotion eligible' },
  'learning.scope_default':                 { type: 'enum', enum: ['project', 'global'], description: 'Default scope for newly captured lessons' },
  'learning.auto_promote_to_global':        { type: 'boolean', description: 'Auto-promote high-confidence lessons to global scope' },

  // context_loading
  'context_loading.tier_1_max_tokens':     { type: 'integer', min: 1000, max: 20000, description: 'Max tokens for Tier 1 (always-loaded) context' },
  'context_loading.tier_2_max_tokens':     { type: 'integer', min: 5000, max: 50000, description: 'Max tokens for Tier 2 (task-relevant) context' },
  'context_loading.tier_3_max_tokens':     { type: 'integer', min: 1000, max: 20000, description: 'Max tokens for Tier 3 (on-demand) context' },
  'context_loading.tier_1_always_loaded':  { type: 'array', items: 'string', description: 'Items always loaded in Tier 1' },
  'context_loading.tier_2_default_count':  { type: 'integer', min: 1, max: 20, description: 'Default number of sinapses to load in Tier 2' },
  'context_loading.tier_3_on_demand':      { type: 'boolean', description: 'Load Tier 3 only when explicitly requested' },
  'context_loading.persistent_mind_cache': { type: 'string', description: 'Path to persistent agent state file' },

  // token_budgets (per-agent)
  'token_budgets.context_mapper.in':              { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for context mapper' },
  'token_budgets.context_mapper.out':             { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for context mapper' },
  'token_budgets.mckinsey_layer.in':              { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for mckinsey layer' },
  'token_budgets.mckinsey_layer.out':             { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for mckinsey layer' },
  'token_budgets.mckinsey_layer.subagent_budget': { type: 'integer', min: 1000, max: 100000, description: 'Subagent token budget for mckinsey layer' },
  'token_budgets.mckinsey_layer.high_stakes_only': { type: 'boolean', description: 'Only activate mckinsey layer for high-stakes tasks' },
  'token_budgets.planner.in':                     { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for planner' },
  'token_budgets.planner.out':                    { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for planner' },
  'token_budgets.implementer.in':                 { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for implementer' },
  'token_budgets.implementer.out':                { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for implementer' },
  'token_budgets.implementer.subagent_budget':    { type: 'integer', min: 1000, max: 100000, description: 'Subagent token budget for implementer' },
  'token_budgets.reviewer.in':                    { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for reviewer' },
  'token_budgets.reviewer.out':                   { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for reviewer' },
  'token_budgets.documenter.in':                  { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for documenter' },
  'token_budgets.documenter.out':                 { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for documenter' },
  'token_budgets.learner.in':                     { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for learner' },
  'token_budgets.learner.out':                    { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for learner' },
  'token_budgets.verifier.in':                    { type: 'integer', min: 1000, max: 100000, description: 'Max input tokens for verifier' },
  'token_budgets.verifier.out':                   { type: 'integer', min: 500, max: 50000, description: 'Max output tokens for verifier' },

  // token_optimization
  'token_optimization.compact_suggestion_threshold': { type: 'integer', min: 10, max: 100, description: '% context usage before suggesting compaction' },
  'token_optimization.context_pressure_levels.low':      { type: 'number', min: 0.0, max: 1.0, description: 'Threshold ratio for "low" pressure' },
  'token_optimization.context_pressure_levels.moderate':  { type: 'number', min: 0.0, max: 1.0, description: 'Threshold ratio for "moderate" pressure' },
  'token_optimization.context_pressure_levels.high':      { type: 'number', min: 0.0, max: 1.0, description: 'Threshold ratio for "high" pressure' },
  'token_optimization.context_pressure_levels.critical':  { type: 'number', min: 0.0, max: 1.0, description: 'Threshold ratio for "critical" pressure' },

  // consolidation
  'consolidation.trigger':                    { type: 'string', description: 'When to trigger consolidation' },
  'consolidation.auto_propose_updates':       { type: 'boolean', description: 'Automatically propose sinapse updates during consolidation' },
  'consolidation.developer_approval_required': { type: 'boolean', description: 'Require developer approval before applying updates' },

  // lesson_escalation
  'lesson_escalation.threshold': { type: 'integer', min: 1, max: 20, description: 'Number of matching lessons before escalation' },
  'lesson_escalation.action':    { type: 'enum', enum: ['propose_hippocampus_convention', 'auto_escalate', 'notify_only'], description: 'Action when escalation threshold reached' },

  // weight_decay
  'weight_decay.enabled':       { type: 'boolean', description: 'Enable/disable automatic weight decay' },
  'weight_decay.rate_per_day':  { type: 'number', min: 0.001, max: 0.1, description: 'Daily decay rate applied to sinapse weights' },
  'weight_decay.min_weight':    { type: 'number', min: 0.01, max: 0.5, description: 'Minimum weight (floor) after decay' },
  'weight_decay.max_stale_days': { type: 'integer', min: 7, max: 365, description: 'Days of inactivity before sinapse considered stale' },
};

/**
 * Top-level sections that are navigable in the wizard.
 */
var SECTIONS = [
  'database', 'cortex_regions', 'hooks', 'linters', 'resilience', 'subagents',
  'learning', 'context_loading', 'token_budgets', 'token_optimization',
  'consolidation', 'lesson_escalation', 'weight_decay'
];

// ---------------------------------------------------------------------------
// Deep get/set helpers
// ---------------------------------------------------------------------------

/**
 * Split a key path into parts, handling special cases like "linters..ext"
 * where the key itself contains dots (e.g., file extensions like ".ts").
 *
 * "linters..ts" => ["linters", ".ts"]
 * "a.b.c"       => ["a", "b", "c"]
 */
function splitKeyPath(keyPath) {
  // Special handling for linters keys: "linters.<ext>" where ext starts with "."
  var lintersMatch = keyPath.match(/^linters\.(\..+)$/);
  if (lintersMatch) {
    return ['linters', lintersMatch[1]];
  }
  return keyPath.split('.');
}

var DANGEROUS_KEY_SEGMENTS = ['__proto__', 'constructor', 'prototype'];

function isSafeKeyPath(keyPath) {
  var parts = splitKeyPath(keyPath);
  for (var i = 0; i < parts.length; i++) {
    if (DANGEROUS_KEY_SEGMENTS.indexOf(parts[i]) !== -1) return false;
  }
  return true;
}

/**
 * Get a value from a nested object by dot-separated path.
 * getDeep({a: {b: 1}}, 'a.b') => 1
 */
function getDeep(obj, keyPath) {
  var parts = splitKeyPath(keyPath);
  var current = obj;
  for (var i = 0; i < parts.length; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[parts[i]];
  }
  return current;
}

/**
 * Set a value in a nested object by dot-separated path.
 * setDeep({a: {b: 1}}, 'a.b', 2) => {a: {b: 2}}
 */
function setDeep(obj, keyPath, value) {
  if (!isSafeKeyPath(keyPath)) { return; }
  var parts = splitKeyPath(keyPath);
  var current = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Deep clone a JSON-serializable object.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a value against a schema entry.
 * Returns { valid: true } or { valid: false, error: "message" }
 */
function validateValue(schemaEntry, value) {
  if (!schemaEntry) {
    return { valid: false, error: 'Unknown field — no schema entry found.' };
  }

  if (schemaEntry.readonly) {
    return { valid: false, error: 'This field is read-only and cannot be modified via brain-setup.' };
  }

  var type = schemaEntry.type;

  // Type: boolean
  if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      return { valid: false, error: 'Expected boolean (true or false), got ' + typeof value + '.' };
    }
    return { valid: true };
  }

  // Type: integer
  if (type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return { valid: false, error: 'Expected integer, got ' + JSON.stringify(value) + '.' };
    }
    if (schemaEntry.min !== undefined && value < schemaEntry.min) {
      return { valid: false, error: 'Value ' + value + ' is below minimum ' + schemaEntry.min + '.' };
    }
    if (schemaEntry.max !== undefined && value > schemaEntry.max) {
      return { valid: false, error: 'Value ' + value + ' exceeds maximum ' + schemaEntry.max + '.' };
    }
    return { valid: true };
  }

  // Type: number (float)
  if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { valid: false, error: 'Expected finite number, got ' + value + '.' };
    }
    if (schemaEntry.min !== undefined && value < schemaEntry.min) {
      return { valid: false, error: 'Value ' + value + ' is below minimum ' + schemaEntry.min + '.' };
    }
    if (schemaEntry.max !== undefined && value > schemaEntry.max) {
      return { valid: false, error: 'Value ' + value + ' exceeds maximum ' + schemaEntry.max + '.' };
    }
    return { valid: true };
  }

  // Type: string
  if (type === 'string') {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Expected string, got ' + typeof value + '.' };
    }
    if (value.length === 0 && !schemaEntry.allowEmpty) {
      return { valid: false, error: 'String must not be empty.' };
    }
    return { valid: true };
  }

  // Type: enum
  if (type === 'enum') {
    if (schemaEntry.enum.indexOf(value) === -1) {
      return { valid: false, error: 'Value ' + JSON.stringify(value) + ' is not one of: ' + schemaEntry.enum.join(', ') + '.' };
    }
    return { valid: true };
  }

  // Type: nullable_enum (allows null)
  if (type === 'nullable_enum') {
    if (value === null) return { valid: true };
    if (schemaEntry.enum.indexOf(value) === -1) {
      return { valid: false, error: 'Value ' + JSON.stringify(value) + ' is not one of: ' + schemaEntry.enum.map(function (v) { return JSON.stringify(v); }).join(', ') + '.' };
    }
    return { valid: true };
  }

  // Type: array
  if (type === 'array') {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'Expected array, got ' + typeof value + '.' };
    }
    if (value.length === 0) {
      return { valid: false, error: 'Array must not be empty.' };
    }
    if (schemaEntry.items === 'string') {
      for (var i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string') {
          return { valid: false, error: 'Array item at index ' + i + ' must be a string.' };
        }
      }
    }
    return { valid: true };
  }

  // Type: object (freeform or dynamic)
  if (type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, error: 'Expected object, got ' + (Array.isArray(value) ? 'array' : typeof value) + '.' };
    }
    return { valid: true };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Tool: brain_config_read
// ---------------------------------------------------------------------------

/**
 * Read the entire config or a specific section.
 * Args: { section?: string }
 */
function brainConfigRead(args) {
  var config = readJSON(configPath());
  if (!config) {
    return error('brain.config.json not found. Run /brain-init first.');
  }

  var section = args && args.section;
  if (!section) {
    return success({
      config: config,
      sections: SECTIONS,
      field_count: Object.keys(SCHEMA).length
    });
  }

  // Validate section name
  if (SECTIONS.indexOf(section) === -1) {
    return error('Unknown section: "' + section + '". Valid sections: ' + SECTIONS.join(', '));
  }

  // Extract section data
  var sectionData = config[section];
  if (sectionData === undefined) {
    return error('Section "' + section + '" not found in config.');
  }

  // Gather schema entries for this section
  var schemaEntries = {};
  var prefix = section + '.';
  Object.keys(SCHEMA).forEach(function (key) {
    if (key === section || key.indexOf(prefix) === 0) {
      schemaEntries[key] = SCHEMA[key];
    }
  });

  return success({
    section: section,
    data: sectionData,
    schema: schemaEntries
  });
}

// ---------------------------------------------------------------------------
// Tool: brain_config_write
// ---------------------------------------------------------------------------

/**
 * Write a validated value to a config key.
 * Args: { key: string, value: any }
 * The key is a dot-separated path, e.g. "learning.confidence_initial"
 */
function brainConfigWrite(args) {
  if (!args || !args.key) {
    return error('Missing required argument: "key".');
  }

  var key = args.key;
  if (!isSafeKeyPath(key)) {
    return error('Invalid key "' + key + '": key segments cannot be __proto__, constructor, or prototype.');
  }
  var value = args.value;

  if (value === undefined) {
    return error('Missing required argument: "value".');
  }

  // Read current config
  var config = readJSON(configPath());
  if (!config) {
    return error('brain.config.json not found. Run /brain-init first.');
  }

  // Handle linters dynamic keys specially
  var schemaEntry;
  if (key.indexOf('linters.') === 0) {
    // Dynamic linter entry — validate as string
    schemaEntry = { type: 'string', description: 'Linter command for file extension' };
  } else {
    schemaEntry = SCHEMA[key];
  }

  if (!schemaEntry) {
    return error('Unknown config key: "' + key + '".');
  }

  // Validate
  var validation = validateValue(schemaEntry, value);
  if (!validation.valid) {
    return error('Validation failed for "' + key + '": ' + validation.error);
  }

  // Get old value for logging
  var oldValue = getDeep(config, key);

  // Write new value
  setDeep(config, key, value);

  // Persist
  if (!writeJSON(configPath(), config)) {
    return error('Failed to write brain.config.json.');
  }

  // Log to activity.md
  appendActivityLog(key, oldValue, value);

  return success({
    key: key,
    old_value: oldValue,
    new_value: value,
    written: true
  });
}

/**
 * Append a config change entry to .brain/progress/activity.md
 */
function appendActivityLog(key, oldValue, newValue) {
  var logPath = activityLogPath();
  try {
    var ts = timestamp();
    var entry = '\n## [' + ts + '] brain-setup: config change\n' +
      '- ' + key + ': ' + JSON.stringify(oldValue) + ' -> ' + JSON.stringify(newValue) + '\n';

    if (fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, entry, 'utf-8');
    }
    // If activity.md doesn't exist, skip silently (brain may not be fully initialized)
  } catch {
    // Non-critical — don't fail the write operation
  }
}

// ---------------------------------------------------------------------------
// Tool: brain_config_validate
// ---------------------------------------------------------------------------

/**
 * Validate a value without writing it.
 * Args: { key: string, value: any } or { section: string } to validate an entire section
 */
function brainConfigValidate(args) {
  if (!args) {
    return error('Missing arguments.');
  }

  // Validate entire config
  if (!args.key && !args.section) {
    var config = readJSON(configPath());
    if (!config) {
      return error('brain.config.json not found. Run /brain-init first.');
    }
    return validateFullConfig(config);
  }

  // Validate a specific section
  if (args.section && !args.key) {
    var config2 = readJSON(configPath());
    if (!config2) {
      return error('brain.config.json not found. Run /brain-init first.');
    }
    return validateSection(config2, args.section);
  }

  // Validate a single key-value pair
  var key = args.key;
  var value = args.value;

  if (value === undefined) {
    return error('Missing required argument: "value".');
  }

  var schemaEntry;
  if (key.indexOf('linters.') === 0) {
    schemaEntry = { type: 'string', description: 'Linter command for file extension' };
  } else {
    schemaEntry = SCHEMA[key];
  }

  if (!schemaEntry) {
    return error('Unknown config key: "' + key + '".');
  }

  var result = validateValue(schemaEntry, value);
  return success({
    key: key,
    value: value,
    valid: result.valid,
    error: result.error || null,
    schema: {
      type: schemaEntry.type,
      min: schemaEntry.min,
      max: schemaEntry.max,
      enum: schemaEntry.enum,
      description: schemaEntry.description
    }
  });
}

/**
 * Validate all fields in the config against the schema.
 */
function validateFullConfig(config) {
  var errors = [];
  var warnings = [];
  var checked = 0;

  Object.keys(SCHEMA).forEach(function (key) {
    var entry = SCHEMA[key];
    if (entry.readonly) return;

    var value = getDeep(config, key);
    if (value === undefined) {
      warnings.push({ key: key, message: 'Field missing from config.' });
      return;
    }

    checked++;
    var result = validateValue(entry, value);
    if (!result.valid) {
      errors.push({ key: key, value: value, error: result.error });
    }
  });

  return success({
    valid: errors.length === 0,
    checked: checked,
    errors: errors,
    warnings: warnings
  });
}

/**
 * Validate all fields in a specific section.
 */
function validateSection(config, section) {
  if (SECTIONS.indexOf(section) === -1) {
    return error('Unknown section: "' + section + '". Valid sections: ' + SECTIONS.join(', '));
  }

  var errors = [];
  var checked = 0;
  var prefix = section + '.';

  Object.keys(SCHEMA).forEach(function (key) {
    if (key !== section && key.indexOf(prefix) !== 0) return;
    var entry = SCHEMA[key];
    if (entry.readonly) return;

    var value = getDeep(config, key);
    if (value === undefined) return;

    checked++;
    var result = validateValue(entry, value);
    if (!result.valid) {
      errors.push({ key: key, value: value, error: result.error });
    }
  });

  return success({
    section: section,
    valid: errors.length === 0,
    checked: checked,
    errors: errors
  });
}

// ---------------------------------------------------------------------------
// Tool: brain_config_diff
// ---------------------------------------------------------------------------

/**
 * Compute a diff between the original config and a modified version.
 * Args: { original: object, modified: object } or { changes: [{key, value}] }
 *
 * If "changes" is provided, applies them to the current config and shows the diff.
 * If "original" and "modified" are provided, computes the diff directly.
 */
function brainConfigDiff(args) {
  if (!args) {
    return error('Missing arguments.');
  }

  var original, modified;

  if (args.changes && Array.isArray(args.changes)) {
    // Apply proposed changes to current config
    original = readJSON(configPath());
    if (!original) {
      return error('brain.config.json not found. Run /brain-init first.');
    }
    modified = deepClone(original);
    for (var i = 0; i < args.changes.length; i++) {
      var change = args.changes[i];
      if (!change.key || change.value === undefined) continue;
      if (!isSafeKeyPath(change.key)) {
        return error('Invalid key "' + change.key + '": key segments cannot be __proto__, constructor, or prototype.');
      }
      setDeep(modified, change.key, change.value);
    }
  } else if (args.original !== undefined && args.modified !== undefined) {
    if (
      typeof args.original !== 'object' || args.original === null || Array.isArray(args.original) ||
      typeof args.modified !== 'object' || args.modified === null || Array.isArray(args.modified)
    ) {
      return error('"original" and "modified" must be plain objects.');
    }
    original = args.original;
    modified = args.modified;
  } else {
    return error('Provide either { changes: [{key, value}] } or { original, modified }.');
  }

  // Compute diff by walking schema keys
  var diffs = [];

  function compareAt(keyPath, orig, mod) {
    var origStr = JSON.stringify(orig);
    var modStr = JSON.stringify(mod);
    if (origStr !== modStr) {
      diffs.push({
        key: keyPath,
        before: orig,
        after: mod
      });
    }
  }

  // Walk all schema keys
  Object.keys(SCHEMA).forEach(function (key) {
    var origVal = getDeep(original, key);
    var modVal = getDeep(modified, key);
    compareAt(key, origVal, modVal);
  });

  // Also check linters (dynamic keys)
  var origLinters = original.linters || {};
  var modLinters = modified.linters || {};
  var allLinterKeys = {};
  Object.keys(origLinters).forEach(function (k) { allLinterKeys[k] = true; });
  Object.keys(modLinters).forEach(function (k) { allLinterKeys[k] = true; });
  Object.keys(allLinterKeys).forEach(function (ext) {
    if (origLinters[ext] !== modLinters[ext]) {
      diffs.push({
        key: 'linters.' + ext,
        before: origLinters[ext] || null,
        after: modLinters[ext] || null
      });
    }
  });

  // Filter out duplicate diffs (linters section captured both as object and individual keys)
  var seen = {};
  var uniqueDiffs = diffs.filter(function (d) {
    // Skip the top-level "linters" key if we have individual linter diffs
    if (d.key === 'linters') return false;
    if (seen[d.key]) return false;
    seen[d.key] = true;
    return true;
  });

  return success({
    has_changes: uniqueDiffs.length > 0,
    change_count: uniqueDiffs.length,
    diffs: uniqueDiffs
  });
}

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

var TOOLS = {
  brain_config_read:     brainConfigRead,
  brain_config_write:    brainConfigWrite,
  brain_config_validate: brainConfigValidate,
  brain_config_diff:     brainConfigDiff,
};

// ---------------------------------------------------------------------------
// Main — read stdin JSON, dispatch tool, write stdout JSON
// ---------------------------------------------------------------------------

function main() {
  var chunks = [];
  process.stdin.setEncoding('utf-8');

  process.stdin.on('data', function (chunk) {
    chunks.push(chunk);
  });

  process.stdin.on('end', function () {
    var rawInput = chunks.join('');
    var input = {};

    if (rawInput.trim()) {
      try {
        input = JSON.parse(rawInput);
      } catch (e) {
        process.stdout.write(JSON.stringify(error('Invalid JSON input: ' + e.message)) + '\n');
        process.exit(1);
        return;
      }
    }

    var toolName = input.tool;
    if (!toolName) {
      // If tool name is passed as CLI argument
      toolName = process.argv[2];
    }

    if (!toolName) {
      process.stdout.write(JSON.stringify(error(
        'No tool specified. Available tools: ' + Object.keys(TOOLS).join(', ')
      )) + '\n');
      process.exit(1);
      return;
    }

    var toolFn = TOOLS[toolName];
    if (!toolFn) {
      process.stdout.write(JSON.stringify(error(
        'Unknown tool: "' + toolName + '". Available: ' + Object.keys(TOOLS).join(', ')
      )) + '\n');
      process.exit(1);
      return;
    }

    try {
      var result = toolFn(input.args || {});
      process.stdout.write(JSON.stringify(result) + '\n');
      process.exit(result.ok ? 0 : 1);
    } catch (err) {
      process.stdout.write(JSON.stringify(error(
        'Tool "' + toolName + '" threw: ' + (err.message || err)
      )) + '\n');
      process.exit(1);
    }
  });

  process.stdin.resume();
}

// ---------------------------------------------------------------------------
// Module exports (for testing) + CLI entry point
// ---------------------------------------------------------------------------

module.exports = {
  brainConfigRead: brainConfigRead,
  brainConfigWrite: brainConfigWrite,
  brainConfigValidate: brainConfigValidate,
  brainConfigDiff: brainConfigDiff,
  validateValue: validateValue,
  splitKeyPath: splitKeyPath,
  getDeep: getDeep,
  setDeep: setDeep,
  deepClone: deepClone,
  SCHEMA: SCHEMA,
  SECTIONS: SECTIONS,
  TOOLS: TOOLS,
  // Expose internals for testing
  _configPath: configPath,
  _templateConfigPath: templateConfigPath,
  _readJSON: readJSON,
  _writeJSON: writeJSON,
};

if (require.main === module) {
  main();
}
