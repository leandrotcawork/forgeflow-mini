#!/usr/bin/env node

/**
 * Tests for mcp/brain-config-server.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-config-server.test.js
 *
 * Uses a temporary directory with a mock .brain/brain.config.json
 * to test all 4 MCP tools without touching real project files.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

var passed = 0;
var failed = 0;
var tests = [];

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + (message || ''));
  }
}

function assertEqual(actual, expected, message) {
  var a = JSON.stringify(actual);
  var e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      (message || 'assertEqual') + ': expected ' + e + ', got ' + a
    );
  }
}

function runTests() {
  console.log('Running brain-config-server tests...\n');

  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      t.fn();
      passed++;
      console.log('  PASS  ' + t.name);
    } catch (err) {
      failed++;
      console.log('  FAIL  ' + t.name);
      console.log('        ' + err.message);
    }
  }

  console.log('\n' + (passed + failed) + ' tests, ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Setup: temporary .brain directory
// ---------------------------------------------------------------------------

var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-config-test-'));
var brainDir = path.join(tmpDir, '.brain');
var configFile = path.join(brainDir, 'brain.config.json');
var progressDir = path.join(brainDir, 'progress');
var activityFile = path.join(progressDir, 'activity.md');

function setupTestConfig() {
  var baseConfig = {
    brain_id: 'test-brain',
    version: '0.6.0',
    created_at: '2026-03-26T10:00:00Z',
    project_root: '.',
    brain_root: '.brain',
    database: {
      path: '.brain/brain.db',
      schema_version: 1
    },
    cortex_regions: ['backend', 'frontend', 'database', 'infra'],
    hooks: {
      profile: 'standard',
      profiles: {
        minimal: 'Tier 1 only',
        standard: 'Tier 1+2',
        strict: 'All tiers'
      },
      individual_overrides: {}
    },
    linters: {
      '.ts': 'npx eslint --fix',
      '.py': 'ruff check --fix',
      '.go': 'gofmt -w',
      '.js': 'npx eslint --fix',
      '.tsx': 'npx eslint --fix'
    },
    resilience: {
      circuit_breaker: {
        enabled: true,
        failure_threshold: 3,
        cooldown_seconds: 300,
        window_seconds: 600
      },
      strategy_rotation: {
        enabled: true,
        failure_threshold: 2,
        max_retry_per_strategy: 2,
        strategies: ['default', 'alternative', 'minimal', 'escalate', 'human']
      }
    },
    subagents: {
      enabled: true,
      dispatch_threshold: 20,
      parallel_review: true,
      fallback_to_inline: true,
      model_overrides: {
        implementation: null,
        review: 'sonnet',
        document: 'haiku',
        research: 'haiku',
        status: 'haiku'
      }
    },
    learning: {
      confidence_initial: 0.3,
      promotion_threshold: 0.7,
      min_occurrences_for_promotion: 3,
      scope_default: 'project',
      auto_promote_to_global: false
    },
    context_loading: {
      tier_1_max_tokens: 4000,
      tier_2_max_tokens: 15000,
      tier_3_max_tokens: 5000,
      tier_1_always_loaded: ['hippocampus_summary', 'current_task', 'top_3_lessons'],
      tier_2_default_count: 5,
      tier_3_on_demand: true,
      persistent_mind_cache: '.brain/working-memory/agent-state.md'
    },
    token_budgets: {
      context_mapper: { in: 4000, out: 2000 },
      mckinsey_layer: { in: 5000, out: 3000, subagent_budget: 3000, high_stakes_only: true },
      planner: { in: 15000, out: 5000 },
      implementer: { in: 40000, out: 20000, subagent_budget: 50000 },
      reviewer: { in: 15000, out: 5000 },
      documenter: { in: 8000, out: 4000 },
      learner: { in: 5000, out: 2000 },
      verifier: { in: 10000, out: 3000 }
    },
    token_optimization: {
      compact_suggestion_threshold: 50,
      context_pressure_levels: {
        low: 0.5,
        moderate: 0.65,
        high: 0.75,
        critical: 0.8
      }
    },
    consolidation: {
      trigger: 'explicit_command_or_5_tasks',
      auto_propose_updates: true,
      developer_approval_required: true
    },
    lesson_escalation: {
      threshold: 3,
      action: 'propose_hippocampus_convention'
    },
    weight_decay: {
      enabled: true,
      rate_per_day: 0.005,
      min_weight: 0.1,
      max_stale_days: 90
    }
  };

  fs.mkdirSync(brainDir, { recursive: true });
  fs.mkdirSync(progressDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(baseConfig, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(activityFile, '# Brain Activity Log\n', 'utf-8');

  return baseConfig;
}

function cleanupTestConfig() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// Override cwd for the module
var originalCwd = process.cwd;
process.cwd = function () { return tmpDir; };

// Load the module AFTER overriding cwd
var server = require(path.join(__dirname, '..', 'mcp', 'brain-config-server.js'));

// ---------------------------------------------------------------------------
// Tests: validateValue
// ---------------------------------------------------------------------------

test('validateValue: boolean accepts true/false', function () {
  var schema = { type: 'boolean', description: 'test' };
  assert(server.validateValue(schema, true).valid);
  assert(server.validateValue(schema, false).valid);
  assert(!server.validateValue(schema, 'true').valid);
  assert(!server.validateValue(schema, 1).valid);
});

test('validateValue: integer checks type and range', function () {
  var schema = { type: 'integer', min: 1, max: 10, description: 'test' };
  assert(server.validateValue(schema, 5).valid);
  assert(server.validateValue(schema, 1).valid);
  assert(server.validateValue(schema, 10).valid);
  assert(!server.validateValue(schema, 0).valid);
  assert(!server.validateValue(schema, 11).valid);
  assert(!server.validateValue(schema, 5.5).valid);
  assert(!server.validateValue(schema, 'five').valid);
});

test('validateValue: number checks type and range', function () {
  var schema = { type: 'number', min: 0.0, max: 1.0, description: 'test' };
  assert(server.validateValue(schema, 0.5).valid);
  assert(server.validateValue(schema, 0.0).valid);
  assert(server.validateValue(schema, 1.0).valid);
  assert(!server.validateValue(schema, -0.1).valid);
  assert(!server.validateValue(schema, 1.1).valid);
  assert(!server.validateValue(schema, 'half').valid);
});

test('validateValue: string rejects empty by default', function () {
  var schema = { type: 'string', description: 'test' };
  assert(server.validateValue(schema, 'hello').valid);
  assert(!server.validateValue(schema, '').valid);
  assert(!server.validateValue(schema, 123).valid);
});

test('validateValue: enum checks allowed values', function () {
  var schema = { type: 'enum', enum: ['a', 'b', 'c'], description: 'test' };
  assert(server.validateValue(schema, 'a').valid);
  assert(server.validateValue(schema, 'c').valid);
  assert(!server.validateValue(schema, 'd').valid);
  assert(!server.validateValue(schema, 123).valid);
});

test('validateValue: nullable_enum accepts null', function () {
  var schema = { type: 'nullable_enum', enum: [null, 'opus', 'sonnet', 'haiku'], description: 'test' };
  assert(server.validateValue(schema, null).valid);
  assert(server.validateValue(schema, 'opus').valid);
  assert(!server.validateValue(schema, 'gpt4').valid);
});

test('validateValue: array requires non-empty with string items', function () {
  var schema = { type: 'array', items: 'string', description: 'test' };
  assert(server.validateValue(schema, ['a', 'b']).valid);
  assert(!server.validateValue(schema, []).valid);
  assert(!server.validateValue(schema, [1, 2]).valid);
  assert(!server.validateValue(schema, 'not array').valid);
});

test('validateValue: object rejects non-objects', function () {
  var schema = { type: 'object', description: 'test' };
  assert(server.validateValue(schema, { a: 1 }).valid);
  assert(!server.validateValue(schema, null).valid);
  assert(!server.validateValue(schema, []).valid);
  assert(!server.validateValue(schema, 'string').valid);
});

test('validateValue: readonly fields are rejected', function () {
  var schema = { type: 'string', description: 'test', readonly: true };
  var result = server.validateValue(schema, 'anything');
  assert(!result.valid);
  assert(result.error.indexOf('read-only') !== -1);
});

// ---------------------------------------------------------------------------
// Tests: getDeep / setDeep / deepClone
// ---------------------------------------------------------------------------

test('getDeep: retrieves nested values', function () {
  var obj = { a: { b: { c: 42 } } };
  assertEqual(server.getDeep(obj, 'a.b.c'), 42);
  assertEqual(server.getDeep(obj, 'a.b'), { c: 42 });
  assertEqual(server.getDeep(obj, 'x.y'), undefined);
});

test('setDeep: sets nested values, creating intermediates', function () {
  var obj = {};
  server.setDeep(obj, 'a.b.c', 99);
  assertEqual(obj.a.b.c, 99);
});

test('deepClone: produces independent copy', function () {
  var obj = { a: { b: [1, 2, 3] } };
  var clone = server.deepClone(obj);
  clone.a.b.push(4);
  assertEqual(obj.a.b.length, 3);
  assertEqual(clone.a.b.length, 4);
});

// ---------------------------------------------------------------------------
// Tests: brain_config_read
// ---------------------------------------------------------------------------

test('brain_config_read: returns full config when no section', function () {
  setupTestConfig();
  var result = server.brainConfigRead({});
  assert(result.ok);
  assertEqual(result.data.config.brain_id, 'test-brain');
  assert(result.data.sections.length > 0);
});

test('brain_config_read: returns specific section', function () {
  setupTestConfig();
  var result = server.brainConfigRead({ section: 'learning' });
  assert(result.ok);
  assertEqual(result.data.section, 'learning');
  assertEqual(result.data.data.confidence_initial, 0.3);
  assert(Object.keys(result.data.schema).length > 0);
});

test('brain_config_read: errors on unknown section', function () {
  setupTestConfig();
  var result = server.brainConfigRead({ section: 'nonexistent' });
  assert(!result.ok);
  assert(result.error.indexOf('Unknown section') !== -1);
});

test('brain_config_read: errors when config missing', function () {
  try { fs.unlinkSync(configFile); } catch {}
  var result = server.brainConfigRead({});
  assert(!result.ok);
  assert(result.error.indexOf('not found') !== -1);
  setupTestConfig();
});

// ---------------------------------------------------------------------------
// Tests: brain_config_write
// ---------------------------------------------------------------------------

test('brain_config_write: writes valid value', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'learning.confidence_initial', value: 0.5 });
  assert(result.ok);
  assertEqual(result.data.old_value, 0.3);
  assertEqual(result.data.new_value, 0.5);
  assert(result.data.written);

  var config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  assertEqual(config.learning.confidence_initial, 0.5);
});

test('brain_config_write: rejects invalid value', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'learning.confidence_initial', value: 2.0 });
  assert(!result.ok);
  assert(result.error.indexOf('exceeds maximum') !== -1);
});

test('brain_config_write: rejects readonly fields', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'brain_id', value: 'hacked' });
  assert(!result.ok);
  assert(result.error.indexOf('read-only') !== -1);
});

test('brain_config_write: rejects unknown key', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'nonexistent.field', value: 'x' });
  assert(!result.ok);
  assert(result.error.indexOf('Unknown config key') !== -1);
});

test('brain_config_write: handles dynamic linter keys', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'linters..rs', value: 'cargo clippy --fix' });
  assert(result.ok);
  assertEqual(result.data.new_value, 'cargo clippy --fix');

  // Verify it was actually persisted to disk
  var onDisk = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  assertEqual(onDisk.linters['.rs'], 'cargo clippy --fix');
});

test('brain_config_write: logs change to activity.md', function () {
  setupTestConfig();
  server.brainConfigWrite({ key: 'learning.confidence_initial', value: 0.4 });
  var log = fs.readFileSync(activityFile, 'utf-8');
  assert(log.indexOf('brain-setup: config change') !== -1);
  assert(log.indexOf('learning.confidence_initial') !== -1);
});

test('brain_config_write: errors when missing key arg', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ value: 42 });
  assert(!result.ok);
  assert(result.error.indexOf('Missing required argument') !== -1);
});

test('brain_config_write: errors when missing value arg', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'learning.confidence_initial' });
  assert(!result.ok);
  assert(result.error.indexOf('Missing required argument') !== -1);
});

// ---------------------------------------------------------------------------
// Tests: brain_config_validate
// ---------------------------------------------------------------------------

test('brain_config_validate: validates single key-value', function () {
  setupTestConfig();
  var result = server.brainConfigValidate({ key: 'weight_decay.rate_per_day', value: 0.01 });
  assert(result.ok);
  assert(result.data.valid);
});

test('brain_config_validate: reports invalid single key-value', function () {
  setupTestConfig();
  var result = server.brainConfigValidate({ key: 'weight_decay.rate_per_day', value: 0.5 });
  assert(result.ok);
  assert(!result.data.valid);
  assert(result.data.error.indexOf('exceeds maximum') !== -1);
});

test('brain_config_validate: validates entire section', function () {
  setupTestConfig();
  var result = server.brainConfigValidate({ section: 'learning' });
  assert(result.ok);
  assert(result.data.valid);
  assert(result.data.checked > 0);
});

test('brain_config_validate: validates entire config', function () {
  setupTestConfig();
  var result = server.brainConfigValidate({});
  assert(result.ok);
  assert(result.data.valid);
  assert(result.data.checked >= 30, 'Expected at least 30 fields checked, got ' + result.data.checked);
});

test('brain_config_validate: reports error for unknown section', function () {
  setupTestConfig();
  var result = server.brainConfigValidate({ section: 'bogus' });
  assert(!result.ok);
  assert(result.error.indexOf('Unknown section') !== -1);
});

test('brain_config_validate: detects invalid values in full config', function () {
  setupTestConfig();
  var config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  config.learning.confidence_initial = 'not_a_number';
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  var result = server.brainConfigValidate({});
  assert(result.ok);
  assert(!result.data.valid);
  assert(result.data.errors.length > 0);
  assert(result.data.errors[0].key === 'learning.confidence_initial');
});

test('brain_config_validate: gives useful error for corrupt JSON', function () {
  setupTestConfig();
  fs.writeFileSync(configFile, '{ bad json !!!', 'utf-8');
  var result = server.brainConfigValidate({});
  assert(!result.ok);
  assert(result.error.indexOf('not found') === -1, 'Should not say not found: ' + result.error);
  assert(result.error.indexOf('Failed to read') !== -1, 'Should say "Failed to read": ' + result.error);
  setupTestConfig(); // restore
});

// ---------------------------------------------------------------------------
// Tests: brain_config_diff
// ---------------------------------------------------------------------------

test('brain_config_diff: detects changes from changes array', function () {
  setupTestConfig();
  var result = server.brainConfigDiff({
    changes: [
      { key: 'learning.confidence_initial', value: 0.5 },
      { key: 'learning.promotion_threshold', value: 0.9 }
    ]
  });
  assert(result.ok);
  assert(result.data.has_changes);
  assertEqual(result.data.change_count, 2);

  var found = result.data.diffs.filter(function (d) {
    return d.key === 'learning.confidence_initial';
  });
  assertEqual(found.length, 1);
  assertEqual(found[0].before, 0.3);
  assertEqual(found[0].after, 0.5);
});

test('brain_config_diff: no changes when values same', function () {
  setupTestConfig();
  var result = server.brainConfigDiff({
    changes: [
      { key: 'learning.confidence_initial', value: 0.3 }
    ]
  });
  assert(result.ok);
  assert(!result.data.has_changes);
  assertEqual(result.data.change_count, 0);
});

test('brain_config_diff: works with original/modified objects', function () {
  setupTestConfig();
  var orig = { learning: { confidence_initial: 0.3 } };
  var mod  = { learning: { confidence_initial: 0.6 } };
  var result = server.brainConfigDiff({ original: orig, modified: mod });
  assert(result.ok);
  assert(result.data.has_changes);
  assertEqual(result.data.change_count, 1);
  var d = result.data.diffs[0];
  assertEqual(d.key, 'learning.confidence_initial');
  assertEqual(d.before, 0.3);
  assertEqual(d.after, 0.6);
});

test('brain_config_diff: detects linter changes', function () {
  setupTestConfig();
  var result = server.brainConfigDiff({
    changes: [
      { key: 'linters..rs', value: 'cargo clippy --fix' }
    ]
  });
  assert(result.ok);
  assert(result.data.has_changes);
  var linterDiff = result.data.diffs.filter(function (d) {
    return d.key === 'linters..rs';
  });
  assertEqual(linterDiff.length, 1);
  assertEqual(linterDiff[0].before, null);
  assertEqual(linterDiff[0].after, 'cargo clippy --fix');
});

test('brain_config_diff: errors with no args', function () {
  setupTestConfig();
  var result = server.brainConfigDiff({});
  assert(!result.ok);
  assert(result.error.indexOf('Provide either') !== -1);
});

test('brain_config_diff: rejects __proto__ key in changes', function () {
  setupTestConfig();
  var result = server.brainConfigDiff({
    changes: [{ key: '__proto__.polluted', value: true }]
  });
  assert(!result.ok);
  assert(result.error.indexOf('Invalid key') !== -1 || result.error.indexOf('__proto__') !== -1);
});

// ---------------------------------------------------------------------------
// Tests: SCHEMA completeness
// ---------------------------------------------------------------------------

test('SCHEMA covers all sections', function () {
  var schemaSections = {};
  Object.keys(server.SCHEMA).forEach(function (key) {
    var section = key.split('.')[0];
    schemaSections[section] = true;
  });

  var expected = ['database', 'hooks', 'linters', 'resilience', 'subagents', 'learning',
    'context_loading', 'token_budgets', 'token_optimization', 'consolidation',
    'lesson_escalation', 'weight_decay', 'cortex_regions'];

  expected.forEach(function (s) {
    assert(schemaSections[s], 'Schema missing section: ' + s);
  });
});

test('SECTIONS list matches navigable sections', function () {
  assert(server.SECTIONS.indexOf('database') !== -1);
  assert(server.SECTIONS.indexOf('hooks') !== -1);
  assert(server.SECTIONS.indexOf('learning') !== -1);
  assert(server.SECTIONS.indexOf('weight_decay') !== -1);
  assert(server.SECTIONS.length >= 10);
});

// ---------------------------------------------------------------------------
// Tests: CLI integration (via subprocess using execFileSync)
// ---------------------------------------------------------------------------

test('CLI: brain_config_read via subprocess', function () {
  setupTestConfig();
  var serverPath = path.join(__dirname, '..', 'mcp', 'brain-config-server.js');
  var input = JSON.stringify({ tool: 'brain_config_read', args: { section: 'learning' } });

  var result = execFileSync('node', [serverPath], {
    input: input,
    cwd: tmpDir,
    encoding: 'utf-8',
    timeout: 5000
  });

  var parsed = JSON.parse(result.trim());
  assert(parsed.ok);
  assertEqual(parsed.data.section, 'learning');
});

test('CLI: brain_config_validate via subprocess', function () {
  setupTestConfig();
  var serverPath = path.join(__dirname, '..', 'mcp', 'brain-config-server.js');
  var input = JSON.stringify({
    tool: 'brain_config_validate',
    args: { key: 'learning.confidence_initial', value: 0.5 }
  });

  var result = execFileSync('node', [serverPath], {
    input: input,
    cwd: tmpDir,
    encoding: 'utf-8',
    timeout: 5000
  });

  var parsed = JSON.parse(result.trim());
  assert(parsed.ok);
  assert(parsed.data.valid);
});

test('CLI: unknown tool returns error', function () {
  setupTestConfig();
  var serverPath = path.join(__dirname, '..', 'mcp', 'brain-config-server.js');
  var input = JSON.stringify({ tool: 'nonexistent_tool', args: {} });

  try {
    execFileSync('node', [serverPath], {
      input: input,
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 5000
    });
    assert(false, 'Should have thrown');
  } catch (err) {
    var output = (err.stdout || '') + (err.stderr || '');
    assert(output.indexOf('Unknown tool') !== -1 && err.status === 1,
      'Expected exit 1 AND "Unknown tool" in output. Got status=' + err.status + ' output=' + output);
  }
});

// ---------------------------------------------------------------------------
// 1a — Prototype pollution guard
// ---------------------------------------------------------------------------

test('brain_config_write: rejects __proto__ key in linters path', function () {
  setupTestConfig();
  var before = Object.prototype.polluted;
  var result = server.brainConfigWrite({ key: 'linters.__proto__.polluted', value: true });
  assert(!result.ok);
  assert(result.error.indexOf('Invalid key') !== -1 || result.error.indexOf('__proto__') !== -1);
  assertEqual(Object.prototype.polluted, before);
});

test('brain_config_write: rejects constructor key segment', function () {
  setupTestConfig();
  var result = server.brainConfigWrite({ key: 'learning.constructor.polluted', value: true });
  assert(!result.ok);
});

// ---------------------------------------------------------------------------
// 1b — NaN/Infinity validation
// ---------------------------------------------------------------------------

test('validateValue: number rejects NaN', function () {
  var schema = { type: 'number', min: 0.0, max: 1.0 };
  var result = server.validateValue(schema, NaN);
  assert(!result.valid, 'NaN should be invalid');
  assert(result.error.indexOf('finite') !== -1 || result.error.indexOf('NaN') !== -1);
});

test('validateValue: number rejects Infinity', function () {
  var schema = { type: 'number', min: 0.0, max: 1.0 };
  assert(!server.validateValue(schema, Infinity).valid);
});

test('validateValue: number rejects -Infinity', function () {
  var schema = { type: 'number', min: 0.0, max: 1.0 };
  assert(!server.validateValue(schema, -Infinity).valid);
});

// ---------------------------------------------------------------------------
// 1c — undefined value in diff changes
// ---------------------------------------------------------------------------

test('brain_config_diff: skips change entries with undefined value', function () {
  setupTestConfig();
  var result = server.brainConfigDiff({
    changes: [{ key: 'learning.confidence_initial' }]  // no value
  });
  assert(result.ok);
  var fieldDiff = (result.data.diffs || []).filter(function (d) {
    return d.key === 'learning.confidence_initial';
  });
  assertEqual(fieldDiff.length, 0);
});

// ---------------------------------------------------------------------------
// 1d — Unvalidated caller objects in brainConfigDiff
// ---------------------------------------------------------------------------

test('brain_config_diff: rejects null as original', function () {
  var result = server.brainConfigDiff({ original: null, modified: {} });
  assert(!result.ok);
  assert(result.error.indexOf('plain object') !== -1 || result.error.indexOf('object') !== -1);
});

test('brain_config_diff: rejects array as original', function () {
  var result = server.brainConfigDiff({ original: [], modified: {} });
  assert(!result.ok);
});

test('brain_config_diff: rejects string as modified', function () {
  var result = server.brainConfigDiff({ original: {}, modified: 'bad' });
  assert(!result.ok);
});

// ---------------------------------------------------------------------------
// 2a — Array allowEmpty flag
// ---------------------------------------------------------------------------

test('validateValue: array allows empty when allowEmpty is true', function () {
  var schema = { type: 'array', items: 'string', allowEmpty: true };
  var result = server.validateValue(schema, []);
  assert(result.valid, 'Expected valid for empty array with allowEmpty:true, got: ' + result.error);
});

test('validateValue: array still rejects empty without allowEmpty', function () {
  var schema = { type: 'array', items: 'string' };
  var result = server.validateValue(schema, []);
  assert(!result.valid, 'Expected invalid for empty array without allowEmpty');
});

// ---------------------------------------------------------------------------
// 2b — readJSON error distinction
// ---------------------------------------------------------------------------

test('brain_config_read: gives useful error for corrupt JSON (not "not found")', function () {
  setupTestConfig();
  fs.writeFileSync(configFile, '{ bad json !!!', 'utf-8');
  var result = server.brainConfigRead({});
  assert(!result.ok);
  assert(result.error.indexOf('not found') === -1, 'Should not say "not found" for corrupt file, got: ' + result.error);
  assert(result.error.indexOf('Failed to read') !== -1, 'Should say "Failed to read": ' + result.error);
  setupTestConfig(); // restore
});

test('brain_config_write: gives useful error for corrupt JSON', function () {
  setupTestConfig();
  fs.writeFileSync(configFile, '{ bad json !!!', 'utf-8');
  var result = server.brainConfigWrite({ key: 'learning.confidence_initial', value: 0.5 });
  assert(!result.ok);
  assert(result.error.indexOf('not found') === -1, 'Should not say not found: ' + result.error);
  assert(result.error.indexOf('Failed to read') !== -1, 'Should say Failed to read: ' + result.error);
  setupTestConfig(); // restore
});

// ---------------------------------------------------------------------------
// 2c — _template section
// ---------------------------------------------------------------------------

test('brain_config_read: _template returns default config structure', function () {
  var result = server.brainConfigRead({ section: '_template' });
  assert(result.ok, 'Expected ok, got: ' + result.error);
  assert(result.data.version !== undefined, 'Expected version in template');
  assert(result.data.hooks !== undefined, 'Expected hooks in template');
  assert(result.data.resilience !== undefined, 'Expected resilience in template');
});

test('brain_config_read: _template returns error when template file missing', function () {
  var templatePath = path.join(__dirname, '..', 'templates', 'brain', 'brain.config.json');
  var tmpPath = templatePath + '.bak';
  var existed = false;
  try {
    fs.renameSync(templatePath, tmpPath);
    existed = true;
  } catch (e) { /* file may not exist in test env */ }

  try {
    var result = server.brainConfigRead({ section: '_template' });
    assert(!result.ok, 'Expected error when template file is missing, got: ' + JSON.stringify(result));
    assert(
      result.error.indexOf('not found') !== -1 || result.error.indexOf('Failed to read') !== -1,
      'Expected error about missing/unreadable template, got: ' + result.error
    );
  } finally {
    if (existed) {
      fs.renameSync(tmpPath, templatePath);
    }
  }
});

// ---------------------------------------------------------------------------
// Tests: brain_health_check
// ---------------------------------------------------------------------------

test('brain_health_check: returns ok with version and region_count', function () {
  setupTestConfig();
  var result = server.brainHealthCheck({});
  assert(result.ok);
  assertEqual(result.data.version, '0.6.0');
  assertEqual(result.data.region_count, 4);
  assert(typeof result.data.brain_id === 'string');
  assert(Array.isArray(result.data.regions));
});

test('brain_health_check: errors when config missing', function () {
  try { fs.unlinkSync(configFile); } catch {}
  var result = server.brainHealthCheck({});
  assert(!result.ok);
  assert(result.error.indexOf('not found') !== -1);
  setupTestConfig();
});

test('CLI: brain_health_check via subprocess', function () {
  setupTestConfig();
  var serverPath = path.join(__dirname, '..', 'mcp', 'brain-config-server.js');
  var input = JSON.stringify({ tool: 'brain_health_check', args: {} });
  var result = execFileSync('node', [serverPath], {
    input: input, cwd: tmpDir, encoding: 'utf-8', timeout: 5000
  });
  var parsed = JSON.parse(result.trim());
  assert(parsed.ok);
  assertEqual(parsed.data.region_count, 4);
});

// ---------------------------------------------------------------------------
// Cleanup and run
// ---------------------------------------------------------------------------

process.on('exit', function () {
  process.cwd = originalCwd;
  cleanupTestConfig();
});

runTests();
