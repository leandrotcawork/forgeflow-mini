#!/usr/bin/env node

/**
 * Tests for scripts/brain-post-task.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-post-task.test.js
 *
 * Uses temporary directories to test all operations without touching real files.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');

var mod = require('../scripts/brain-post-task.js');

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

function assertContains(haystack, needle, message) {
  if (haystack.indexOf(needle) === -1) {
    throw new Error(
      (message || 'assertContains') + ': expected string to contain "' + needle + '", got: ' + haystack.substring(0, 200)
    );
  }
}

function runTests() {
  console.log('Running brain-post-task tests...\n');

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
// Helpers
// ---------------------------------------------------------------------------

function makeTmpBrain() {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-post-task-test-'));
  var brainDir = path.join(tmpDir, '.brain');
  fs.mkdirSync(path.join(brainDir, 'working-memory'), { recursive: true });
  fs.mkdirSync(path.join(brainDir, 'progress', 'completed-contexts'), { recursive: true });
  return brainDir;
}

function makeDefaultArgs(brainDir, overrides) {
  var base = {
    taskId: 'TSK-001',
    status: 'success',
    model: 'codex',
    domain: 'backend',
    score: 55,
    filesChanged: ['src/a.ts', 'src/b.ts'],
    sinapsesLoaded: ['sinapse-auth'],
    lessonsLoaded: ['lesson-1'],
    brainPath: brainDir,
    taskDescription: 'Implement auth middleware',
    testsSummary: '5 passed, 0 failed',
    shortDescription: 'Auth middleware',
    now: new Date('2026-03-27T12:00:00Z')
  };
  if (overrides) {
    var keys = Object.keys(overrides);
    for (var i = 0; i < keys.length; i++) {
      base[keys[i]] = overrides[keys[i]];
    }
  }
  return base;
}

// ---------------------------------------------------------------------------
// parseArgs tests
// ---------------------------------------------------------------------------

test('parseArgs: valid full args', function () {
  var result = mod.parseArgs([
    '--task-id', 'TSK-001',
    '--status', 'success',
    '--model', 'codex',
    '--domain', 'backend',
    '--score', '55',
    '--files-changed', '["a.ts","b.ts"]',
    '--sinapses-loaded', '["sinapse-1"]',
    '--lessons-loaded', '["lesson-1"]',
    '--brain-path', '/tmp/.brain',
    '--task-description', 'Test task',
    '--tests-summary', '3 passed',
    '--short-description', 'test',
    '--now', '2026-03-27T12:00:00Z'
  ]);
  assertEqual(result.errors.length, 0, 'no errors');
  assertEqual(result.args.taskId, 'TSK-001', 'taskId');
  assertEqual(result.args.status, 'success', 'status');
  assertEqual(result.args.model, 'codex', 'model');
  assertEqual(result.args.domain, 'backend', 'domain');
  assertEqual(result.args.score, 55, 'score');
  assertEqual(result.args.filesChanged, ['a.ts', 'b.ts'], 'filesChanged');
  assertEqual(result.args.sinapsesLoaded, ['sinapse-1'], 'sinapsesLoaded');
  assertEqual(result.args.lessonsLoaded, ['lesson-1'], 'lessonsLoaded');
  assertEqual(result.args.brainPath, '/tmp/.brain', 'brainPath');
});

test('parseArgs: missing required args', function () {
  var result = mod.parseArgs([]);
  assert(result.errors.length >= 5, 'should have 5+ errors for missing required args');
  assert(result.args === null, 'args should be null');
});

test('parseArgs: invalid status', function () {
  var result = mod.parseArgs([
    '--task-id', 'T1', '--status', 'unknown', '--model', 'codex',
    '--domain', 'backend', '--score', '50',
    '--files-changed', '[]', '--sinapses-loaded', '[]', '--lessons-loaded', '[]'
  ]);
  assert(result.errors.length > 0, 'should have errors');
  assertContains(result.errors.join(' '), 'status', 'error mentions status');
});

test('parseArgs: invalid model', function () {
  var result = mod.parseArgs([
    '--task-id', 'T1', '--status', 'success', '--model', 'gpt4',
    '--domain', 'backend', '--score', '50',
    '--files-changed', '[]', '--sinapses-loaded', '[]', '--lessons-loaded', '[]'
  ]);
  assert(result.errors.length > 0, 'should have errors');
  assertContains(result.errors.join(' '), 'model', 'error mentions model');
});

test('parseArgs: invalid score (not a number)', function () {
  var result = mod.parseArgs([
    '--task-id', 'T1', '--status', 'success', '--model', 'codex',
    '--domain', 'backend', '--score', 'abc',
    '--files-changed', '[]', '--sinapses-loaded', '[]', '--lessons-loaded', '[]'
  ]);
  assert(result.errors.length > 0, 'should have errors');
  assertContains(result.errors.join(' '), 'integer', 'error mentions integer');
});

test('parseArgs: invalid JSON in --files-changed', function () {
  var result = mod.parseArgs([
    '--task-id', 'T1', '--status', 'success', '--model', 'codex',
    '--domain', 'backend', '--score', '50',
    '--files-changed', 'not-json', '--sinapses-loaded', '[]', '--lessons-loaded', '[]'
  ]);
  assert(result.errors.length > 0, 'should have errors');
  assertContains(result.errors.join(' '), 'files-changed', 'error mentions files-changed');
});

test('parseArgs: defaults for optional fields', function () {
  var result = mod.parseArgs([
    '--task-id', 'T1', '--status', 'success', '--model', 'haiku',
    '--domain', 'frontend', '--score', '10',
    '--files-changed', '[]', '--sinapses-loaded', '[]', '--lessons-loaded', '[]'
  ]);
  assertEqual(result.errors.length, 0, 'no errors');
  assertEqual(result.args.brainPath, '.brain', 'default brainPath');
  assertEqual(result.args.taskDescription, '', 'default taskDescription');
  assert(result.args.now instanceof Date, 'now should be a Date');
});

// ---------------------------------------------------------------------------
// writeTaskCompletionRecord tests
// ---------------------------------------------------------------------------

test('writeTaskCompletionRecord: creates file with frontmatter and sections', function () {
  var brainDir = makeTmpBrain();
  var args = makeDefaultArgs(brainDir);
  var filePath = mod.writeTaskCompletionRecord(brainDir, args);

  assert(fs.existsSync(filePath), 'file should exist');
  var content = fs.readFileSync(filePath, 'utf-8');

  assertContains(content, 'task_id: TSK-001', 'frontmatter task_id');
  assertContains(content, 'status: success', 'frontmatter status');
  assertContains(content, 'model: codex', 'frontmatter model');
  assertContains(content, 'domain: backend', 'frontmatter domain');
  assertContains(content, 'score: 55', 'frontmatter score');
  assertContains(content, 'files_count: 2', 'frontmatter files_count');
  assertContains(content, 'sinapses_count: 1', 'frontmatter sinapses_count');
  assertContains(content, '## Task', 'Task section');
  assertContains(content, 'Implement auth middleware', 'task description');
  assertContains(content, '## Files Changed', 'Files section');
  assertContains(content, '- src/a.ts', 'file listed');
  assertContains(content, '## Tests', 'Tests section');
  assertContains(content, '5 passed, 0 failed', 'test summary');
  assertContains(content, '## Sinapses Referenced', 'Sinapses section');
  assertContains(content, '- sinapse-auth', 'sinapse listed');
  assertContains(content, '## Lessons', 'Lessons section');
  assertContains(content, '- lesson-1', 'lesson listed');
});

test('writeTaskCompletionRecord: empty arrays show (none)', function () {
  var brainDir = makeTmpBrain();
  var args = makeDefaultArgs(brainDir, {
    filesChanged: [],
    sinapsesLoaded: [],
    lessonsLoaded: []
  });
  var filePath = mod.writeTaskCompletionRecord(brainDir, args);
  var content = fs.readFileSync(filePath, 'utf-8');

  // Count occurrences of (none) — should be 3
  var matches = content.match(/\(none\)/g);
  assertEqual(matches.length, 3, 'three (none) entries');
});

// ---------------------------------------------------------------------------
// appendActivityRow tests
// ---------------------------------------------------------------------------

test('appendActivityRow: creates new activity.md if missing', function () {
  var brainDir = makeTmpBrain();
  var activityPath = path.join(brainDir, 'progress', 'activity.md');

  // Remove if exists
  if (fs.existsSync(activityPath)) fs.unlinkSync(activityPath);

  var args = makeDefaultArgs(brainDir);
  mod.appendActivityRow(brainDir, args);

  assert(fs.existsSync(activityPath), 'activity.md should exist');
  var content = fs.readFileSync(activityPath, 'utf-8');
  assertContains(content, '# Brain Activity Log', 'has header');
  assertContains(content, 'consolidation-checkpoint', 'has checkpoint comment');
  assertContains(content, 'TSK-001', 'has task row');
  assertContains(content, 'codex', 'has model');
});

test('appendActivityRow: appends to existing activity.md', function () {
  var brainDir = makeTmpBrain();
  var activityPath = path.join(brainDir, 'progress', 'activity.md');

  // Write initial content
  var initial = [
    '# Brain Activity Log',
    '<!-- consolidation-checkpoint: 2026-03-20 -->',
    '',
    '| timestamp | task_id | description | model | status | files | sinapses |',
    '|-----------|---------|-------------|-------|--------|-------|----------|',
    '| 2026-03-25T10:00:00Z | TSK-000 | Old task | haiku | success | 1 | 0 |',
    ''
  ].join('\n');
  fs.writeFileSync(activityPath, initial, 'utf-8');

  var args = makeDefaultArgs(brainDir);
  mod.appendActivityRow(brainDir, args);

  var content = fs.readFileSync(activityPath, 'utf-8');
  assertContains(content, 'TSK-000', 'old row preserved');
  assertContains(content, 'TSK-001', 'new row appended');

  // Count data rows
  var lines = content.split('\n');
  var dataRows = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.charAt(0) === '|' && line.indexOf('---') === -1 && line.indexOf('timestamp') === -1) {
      dataRows++;
    }
  }
  assertEqual(dataRows, 2, 'two data rows');
});

test('appendActivityRow: does not corrupt content without trailing newline', function () {
  var brainDir = makeTmpBrain();
  var activityPath = path.join(brainDir, 'progress', 'activity.md');

  // Write content without trailing newline
  fs.writeFileSync(activityPath, '# Activity Log\n| old |', 'utf-8');

  var args = makeDefaultArgs(brainDir);
  mod.appendActivityRow(brainDir, args);

  var content = fs.readFileSync(activityPath, 'utf-8');
  // Should not have "| old || new..." merged on same line
  var lines = content.split('\n');
  var hasOldLine = false;
  var hasNewLine = false;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('| old |') !== -1 && lines[i].indexOf('TSK-001') === -1) hasOldLine = true;
    if (lines[i].indexOf('TSK-001') !== -1) hasNewLine = true;
  }
  assert(hasOldLine, 'old content on its own line');
  assert(hasNewLine, 'new content on separate line');
});

// ---------------------------------------------------------------------------
// archiveContextArtifacts tests
// ---------------------------------------------------------------------------

test('archiveContextArtifacts: moves existing files', function () {
  var brainDir = makeTmpBrain();
  var wmDir = path.join(brainDir, 'working-memory');

  // Create test context files
  fs.writeFileSync(path.join(wmDir, 'context-packet-TSK-001.md'), 'packet', 'utf-8');
  fs.writeFileSync(path.join(wmDir, 'codex-context-TSK-001.md'), 'context', 'utf-8');

  var args = makeDefaultArgs(brainDir);
  var archived = mod.archiveContextArtifacts(brainDir, args);

  assertEqual(archived.length, 2, 'two files archived');

  // Source files should be gone
  assert(!fs.existsSync(path.join(wmDir, 'context-packet-TSK-001.md')), 'source removed');
  assert(!fs.existsSync(path.join(wmDir, 'codex-context-TSK-001.md')), 'source removed');

  // Destination files should exist
  var archiveDir = path.join(brainDir, 'progress', 'completed-contexts');
  assert(fs.existsSync(path.join(archiveDir, 'TSK-001-context-packet.md')), 'dest exists');
  assert(fs.existsSync(path.join(archiveDir, 'TSK-001-codex-context.md')), 'dest exists');
});

test('archiveContextArtifacts: skips missing files gracefully', function () {
  var brainDir = makeTmpBrain();
  var args = makeDefaultArgs(brainDir);

  // No context files exist in working-memory
  var archived = mod.archiveContextArtifacts(brainDir, args);
  assertEqual(archived.length, 0, 'zero files archived');
});

test('archiveContextArtifacts: handles codex-review and implementation-plan', function () {
  var brainDir = makeTmpBrain();
  var wmDir = path.join(brainDir, 'working-memory');

  fs.writeFileSync(path.join(wmDir, 'codex-review-TSK-001.md'), 'review', 'utf-8');
  fs.writeFileSync(path.join(wmDir, 'implementation-plan-TSK-001.md'), 'plan', 'utf-8');

  var args = makeDefaultArgs(brainDir);
  var archived = mod.archiveContextArtifacts(brainDir, args);

  assertEqual(archived.length, 2, 'two files archived');
  var archiveDir = path.join(brainDir, 'progress', 'completed-contexts');
  assert(fs.existsSync(path.join(archiveDir, 'codex-review-TSK-001.md')), 'review archived');
  assert(fs.existsSync(path.join(archiveDir, 'TSK-001-implementation-plan.md')), 'plan archived');
});

// ---------------------------------------------------------------------------
// countTasksSinceConsolidation tests
// ---------------------------------------------------------------------------

test('countTasksSinceConsolidation: counts rows after checkpoint', function () {
  var brainDir = makeTmpBrain();
  var activityPath = path.join(brainDir, 'progress', 'activity.md');

  var content = [
    '# Brain Activity Log',
    '<!-- consolidation-checkpoint: 2026-03-20 -->',
    '',
    '| timestamp | task_id | description | model | status | files | sinapses |',
    '|-----------|---------|-------------|-------|--------|-------|----------|',
    '| 2026-03-21 | T1 | task1 | haiku | success | 1 | 0 |',
    '| 2026-03-22 | T2 | task2 | codex | success | 2 | 1 |',
    '| 2026-03-23 | T3 | task3 | opus | failure | 3 | 2 |',
    ''
  ].join('\n');
  fs.writeFileSync(activityPath, content, 'utf-8');

  var count = mod.countTasksSinceConsolidation(brainDir);
  assertEqual(count, 3, 'three tasks after checkpoint');
});

test('countTasksSinceConsolidation: counts all rows when no checkpoint', function () {
  var brainDir = makeTmpBrain();
  var activityPath = path.join(brainDir, 'progress', 'activity.md');

  var content = [
    '# Brain Activity Log',
    '',
    '| timestamp | task_id | description | model | status | files | sinapses |',
    '|-----------|---------|-------------|-------|--------|-------|----------|',
    '| 2026-03-21 | T1 | task1 | haiku | success | 1 | 0 |',
    '| 2026-03-22 | T2 | task2 | codex | success | 2 | 1 |',
    ''
  ].join('\n');
  fs.writeFileSync(activityPath, content, 'utf-8');

  var count = mod.countTasksSinceConsolidation(brainDir);
  assertEqual(count, 2, 'two tasks total');
});

test('countTasksSinceConsolidation: returns 0 for missing file', function () {
  var brainDir = makeTmpBrain();
  var count = mod.countTasksSinceConsolidation(brainDir);
  assertEqual(count, 0, 'zero for missing file');
});

test('countTasksSinceConsolidation: counts rows after LATEST checkpoint only', function () {
  var brainDir = makeTmpBrain();
  var activityPath = path.join(brainDir, 'progress', 'activity.md');

  var content = [
    '# Brain Activity Log',
    '<!-- consolidation-checkpoint: 2026-03-10 -->',
    '| timestamp | task_id | description | model | status | files | sinapses |',
    '|-----------|---------|-------------|-------|--------|-------|----------|',
    '| 2026-03-11 | T1 | old | haiku | success | 1 | 0 |',
    '| 2026-03-12 | T2 | old | codex | success | 1 | 0 |',
    '<!-- consolidation-checkpoint: 2026-03-15 -->',
    '| 2026-03-16 | T3 | new | opus | success | 1 | 0 |',
    ''
  ].join('\n');
  fs.writeFileSync(activityPath, content, 'utf-8');

  var count = mod.countTasksSinceConsolidation(brainDir);
  assertEqual(count, 1, 'only one task after latest checkpoint');
});

// ---------------------------------------------------------------------------
// computeCircuitBreakerNextState tests
// ---------------------------------------------------------------------------

test('computeCircuitBreakerNextState: success resets breaker', function () {
  var current = { state: 'closed', failure_count: 2, last_failure_at: '2026-03-27T11:00:00Z', cooldown_until: null };
  var result = mod.computeCircuitBreakerNextState(current, 'success', new Date('2026-03-27T12:00:00Z'), {});

  assertEqual(result.state.state, 'closed', 'state closed');
  assertEqual(result.state.failure_count, 0, 'count reset');
  assertEqual(result.state.last_failure_at, null, 'last_failure cleared');
  assertEqual(result.message, null, 'no message');
});

test('computeCircuitBreakerNextState: failure increments count', function () {
  var current = { state: 'closed', failure_count: 0, last_failure_at: null, cooldown_until: null };
  var now = new Date('2026-03-27T12:00:00Z');
  var result = mod.computeCircuitBreakerNextState(current, 'failure', now, {});

  assertEqual(result.state.state, 'closed', 'still closed');
  assertEqual(result.state.failure_count, 1, 'count incremented');
  assertEqual(result.state.last_failure_at, now.toISOString(), 'last_failure set');
});

test('computeCircuitBreakerNextState: opens after threshold', function () {
  var now = new Date('2026-03-27T12:05:00Z');
  var current = {
    state: 'closed',
    failure_count: 2,
    last_failure_at: '2026-03-27T12:02:00Z',  // 3 min ago, within 10 min window
    cooldown_until: null
  };
  var config = { failure_threshold: 3, cooldown_seconds: 300, window_seconds: 600 };
  var result = mod.computeCircuitBreakerNextState(current, 'failure', now, config);

  assertEqual(result.state.state, 'open', 'breaker opened');
  assertEqual(result.state.failure_count, 3, 'count at threshold');
  assert(result.message !== null, 'has message');
  assertContains(result.message, 'CIRCUIT BREAKER OPENED', 'message content');
});

test('computeCircuitBreakerNextState: half-open + success closes', function () {
  var current = { state: 'half-open', failure_count: 3, last_failure_at: '2026-03-27T11:00:00Z', cooldown_until: null };
  var result = mod.computeCircuitBreakerNextState(current, 'success', new Date('2026-03-27T12:00:00Z'), {});

  assertEqual(result.state.state, 'closed', 'closed after half-open success');
  assertEqual(result.state.failure_count, 0, 'count reset');
});

test('computeCircuitBreakerNextState: half-open + failure re-opens', function () {
  var now = new Date('2026-03-27T12:00:00Z');
  var current = { state: 'half-open', failure_count: 3, last_failure_at: '2026-03-27T11:55:00Z', cooldown_until: null };
  var config = { failure_threshold: 3, cooldown_seconds: 300, window_seconds: 600 };
  var result = mod.computeCircuitBreakerNextState(current, 'failure', now, config);

  assertEqual(result.state.state, 'open', 're-opened');
  assert(result.state.cooldown_until !== null, 'cooldown set');
  assertContains(result.message, 'RE-OPENED', 'message mentions re-opened');
});

test('computeCircuitBreakerNextState: failures outside window reset count', function () {
  var now = new Date('2026-03-27T12:30:00Z');
  var current = {
    state: 'closed',
    failure_count: 2,
    last_failure_at: '2026-03-27T12:00:00Z',  // 30 min ago, outside 10 min window
    cooldown_until: null
  };
  var config = { failure_threshold: 3, cooldown_seconds: 300, window_seconds: 600 };
  var result = mod.computeCircuitBreakerNextState(current, 'failure', now, config);

  assertEqual(result.state.state, 'closed', 'stays closed');
  assertEqual(result.state.failure_count, 1, 'count reset to 1 (new window)');
});

// ---------------------------------------------------------------------------
// main integration test
// ---------------------------------------------------------------------------

test('main: full success flow', function () {
  var brainDir = makeTmpBrain();
  var wmDir = path.join(brainDir, 'working-memory');

  // Create context files to archive
  fs.writeFileSync(path.join(wmDir, 'context-packet-TSK-INT.md'), 'packet', 'utf-8');
  fs.writeFileSync(path.join(wmDir, 'codex-context-TSK-INT.md'), 'context', 'utf-8');

  // Create brain-project-state.json
  fs.writeFileSync(path.join(brainDir, 'progress', 'brain-project-state.json'), JSON.stringify({
    version: '0.7.0',
    total_tasks_completed: 5,
    tasks_since_last_consolidation: 2,
    model_usage: { haiku: 1, sonnet: 2, codex: 2, opus: 0 },
    circuit_breaker: { state: 'closed', failure_count: 0, last_failure_at: null, cooldown_until: null }
  }, null, 2), 'utf-8');

  // Create brain-state.json
  fs.writeFileSync(path.join(wmDir, 'brain-state.json'), JSON.stringify({
    session_id: 'test-session',
    current_pipeline_step: 3,
    tasks_completed_this_session: 2,
    tasks_since_consolidate: 1,
    consecutive_failures: 0,
    active_context_files: ['context-packet-TSK-INT.md'],
    snapshot_reason: 'step 3 complete'
  }, null, 2), 'utf-8');

  // Suppress stdout for main
  var origWrite = process.stdout.write;
  var captured = '';
  process.stdout.write = function (s) { captured += s; };

  var output = mod.main([
    '--task-id', 'TSK-INT',
    '--status', 'success',
    '--model', 'codex',
    '--domain', 'backend',
    '--score', '55',
    '--files-changed', '["src/a.ts","src/b.ts"]',
    '--sinapses-loaded', '["sinapse-auth"]',
    '--lessons-loaded', '["lesson-1"]',
    '--brain-path', brainDir,
    '--task-description', 'Integration test task',
    '--tests-summary', '10 passed',
    '--short-description', 'Integration test',
    '--now', '2026-03-27T12:00:00Z'
  ]);

  process.stdout.write = origWrite;

  // Verify output structure
  assert(output.task_completion_file !== undefined, 'has task_completion_file');
  assert(Array.isArray(output.archived_files), 'has archived_files array');
  assertEqual(output.archived_files.length, 2, 'two files archived');
  assert(typeof output.consolidation_needed === 'boolean', 'has consolidation_needed');
  assert(typeof output.tasks_since_consolidation === 'number', 'has tasks_since_consolidation');
  assert(output.circuit_breaker_state !== undefined, 'has circuit_breaker_state');
  assertEqual(output.circuit_breaker_state.state, 'closed', 'breaker closed after success');
  assertEqual(output.circuit_breaker_state.failure_count, 0, 'no failures');

  // Verify task-completion file was created
  assert(fs.existsSync(output.task_completion_file), 'task-completion file exists');

  // Verify activity.md was updated
  var activityPath = path.join(brainDir, 'progress', 'activity.md');
  assert(fs.existsSync(activityPath), 'activity.md exists');
  var activityContent = fs.readFileSync(activityPath, 'utf-8');
  assertContains(activityContent, 'TSK-INT', 'activity has task');

  // Verify context files were archived
  assert(!fs.existsSync(path.join(wmDir, 'context-packet-TSK-INT.md')), 'source removed');
  assert(fs.existsSync(path.join(brainDir, 'progress', 'completed-contexts', 'TSK-INT-context-packet.md')), 'dest exists');

  // Verify brain-state.json was updated
  var brainState = JSON.parse(fs.readFileSync(path.join(wmDir, 'brain-state.json'), 'utf-8'));
  assertEqual(brainState.current_pipeline_step, 0, 'pipeline reset');
  assertEqual(brainState.tasks_completed_this_session, 3, 'tasks incremented');
  assertEqual(brainState.active_context_files.length, 0, 'context files cleared');
  assertEqual(brainState.consecutive_failures, 0, 'failures reset');

  // Verify brain-project-state.json was updated
  var projectState = JSON.parse(fs.readFileSync(path.join(brainDir, 'progress', 'brain-project-state.json'), 'utf-8'));
  assertEqual(projectState.total_tasks_completed, 6, 'total incremented');
  assertEqual(projectState.model_usage.codex, 3, 'codex usage incremented');
  assertEqual(projectState.tasks_since_last_consolidation, 3, 'consolidation counter incremented');
});

test('main: failure flow updates circuit breaker', function () {
  var brainDir = makeTmpBrain();
  var wmDir = path.join(brainDir, 'working-memory');

  // Create brain-project-state with 2 existing failures
  fs.writeFileSync(path.join(brainDir, 'progress', 'brain-project-state.json'), JSON.stringify({
    version: '0.7.0',
    total_tasks_completed: 3,
    tasks_since_last_consolidation: 1,
    model_usage: { haiku: 0, sonnet: 0, codex: 3, opus: 0 },
    circuit_breaker: {
      state: 'closed',
      failure_count: 2,
      last_failure_at: '2026-03-27T11:58:00Z',
      cooldown_until: null
    }
  }, null, 2), 'utf-8');

  // Create brain config with circuit breaker settings
  fs.writeFileSync(path.join(brainDir, 'brain.config.json'), JSON.stringify({
    resilience: {
      circuit_breaker: {
        failure_threshold: 3,
        cooldown_seconds: 300,
        window_seconds: 600
      }
    }
  }, null, 2), 'utf-8');

  // Create brain-state.json
  fs.writeFileSync(path.join(wmDir, 'brain-state.json'), JSON.stringify({
    current_pipeline_step: 3,
    tasks_completed_this_session: 1,
    consecutive_failures: 2
  }, null, 2), 'utf-8');

  var origWrite = process.stdout.write;
  var captured = '';
  process.stdout.write = function (s) { captured += s; };

  var output = mod.main([
    '--task-id', 'TSK-FAIL',
    '--status', 'failure',
    '--model', 'codex',
    '--domain', 'backend',
    '--score', '55',
    '--files-changed', '[]',
    '--sinapses-loaded', '[]',
    '--lessons-loaded', '[]',
    '--brain-path', brainDir,
    '--now', '2026-03-27T12:00:00Z'
  ]);

  process.stdout.write = origWrite;

  // Circuit breaker should be OPEN (3rd failure within window)
  assertEqual(output.circuit_breaker_state.state, 'open', 'breaker opened');
  assertEqual(output.circuit_breaker_state.failure_count, 3, 'failure count at 3');
  assert(output.circuit_breaker_state.cooldown_until !== null, 'cooldown set');
  assertContains(output.circuit_breaker_message, 'CIRCUIT BREAKER OPENED', 'has message');

  // Verify brain-state consecutive_failures incremented
  var brainState = JSON.parse(fs.readFileSync(path.join(wmDir, 'brain-state.json'), 'utf-8'));
  assertEqual(brainState.consecutive_failures, 3, 'consecutive failures at 3');
});

test('main: invalid args returns exit code 2', function () {
  var origWrite = process.stdout.write;
  process.stdout.write = function () {};
  var origExitCode = process.exitCode;

  var output = mod.main([]);

  process.stdout.write = origWrite;
  assertEqual(process.exitCode, 2, 'exit code 2');
  assert(output.error !== undefined, 'has error');

  // Restore
  process.exitCode = origExitCode;
});

test('main: consolidation_needed true when >= 5 tasks', function () {
  var brainDir = makeTmpBrain();
  var wmDir = path.join(brainDir, 'working-memory');

  // Create activity.md with 4 existing rows (5th will be added by this call)
  var rows = [];
  for (var i = 1; i <= 4; i++) {
    rows.push('| 2026-03-2' + i + ' | T' + i + ' | task' + i + ' | haiku | success | 1 | 0 |');
  }
  var activity = [
    '# Brain Activity Log',
    '<!-- consolidation-checkpoint: 2026-03-01 -->',
    '',
    '| timestamp | task_id | description | model | status | files | sinapses |',
    '|-----------|---------|-------------|-------|--------|-------|----------|'
  ].concat(rows).join('\n') + '\n';
  fs.writeFileSync(path.join(brainDir, 'progress', 'activity.md'), activity, 'utf-8');

  // Create minimal state files
  fs.writeFileSync(path.join(wmDir, 'brain-state.json'), '{}', 'utf-8');
  fs.writeFileSync(path.join(brainDir, 'progress', 'brain-project-state.json'), '{}', 'utf-8');

  var origWrite = process.stdout.write;
  process.stdout.write = function () {};

  var output = mod.main([
    '--task-id', 'T5',
    '--status', 'success',
    '--model', 'haiku',
    '--domain', 'frontend',
    '--score', '10',
    '--files-changed', '["x.ts"]',
    '--sinapses-loaded', '[]',
    '--lessons-loaded', '[]',
    '--brain-path', brainDir,
    '--now', '2026-03-27T12:00:00Z'
  ]);

  process.stdout.write = origWrite;

  assertEqual(output.consolidation_needed, true, 'consolidation needed');
  assert(output.tasks_since_consolidation >= 5, 'at least 5 tasks');
});

// ---------------------------------------------------------------------------
// computeLessonTrigger tests
// ---------------------------------------------------------------------------

test('computeLessonTrigger returns full when strategy_rotation has 2+ attempts for current task', function () {
  var result = mod.computeLessonTrigger('success', {
    strategy_rotation: { task_id: 'task-123', attempts: [{ strategy: 'retry' }, { strategy: 'different' }] }
  }, 'task-123');
  assertEqual(result, 'full');
});

test('computeLessonTrigger returns null when attempts are from a different task', function () {
  var result = mod.computeLessonTrigger('success', {
    strategy_rotation: { task_id: 'task-old', attempts: [{ strategy: 'retry' }, { strategy: 'different' }] }
  }, 'task-123');
  assertEqual(result, null);
});

test('computeLessonTrigger returns draft when status is failure and no strategy rotation', function () {
  var result = mod.computeLessonTrigger('failure', {}, 'task-123');
  assertEqual(result, 'draft');
});

test('computeLessonTrigger returns null when status is success and no attempts', function () {
  var result = mod.computeLessonTrigger('success', {}, 'task-123');
  assertEqual(result, null);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

runTests();
