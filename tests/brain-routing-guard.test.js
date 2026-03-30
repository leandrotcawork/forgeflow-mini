#!/usr/bin/env node

/**
 * Tests for routingGuard hook in hooks/brain-hooks.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-routing-guard.test.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');

var mod = require('../hooks/brain-hooks.js');

// ---------------------------------------------------------------------------
// Test harness (same pattern as brain-hooks.test.js)
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
  console.log('Running brain-routing-guard tests...\n');

  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      t.fn();
      passed++;
      console.log('  PASS: ' + t.name);
    } catch (err) {
      failed++;
      console.log('  FAIL: ' + t.name);
      console.log('        ' + err.message);
    }
  }

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  if (failed > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempBrain() {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-routing-test-'));
  var brainDir = path.join(tmp, '.brain');
  var wmDir = path.join(brainDir, 'working-memory');
  var progressDir = path.join(brainDir, 'progress');
  fs.mkdirSync(wmDir, { recursive: true });
  fs.mkdirSync(progressDir, { recursive: true });
  return { root: tmp, brainDir: brainDir, wmDir: wmDir, progressDir: progressDir };
}

function writeJSONFile(filePath, data) {
  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function withCwd(dir, fn) {
  var original = process.cwd();
  try {
    process.chdir(dir);
    return fn();
  } finally {
    process.chdir(original);
  }
}

function cleanup(tmp) {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

// ===========================================================================
// routingGuard tests
// ===========================================================================

test('routingGuard: allows write when current_skill is brain-task', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-task'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow');
  assert(!result.decision, 'should not block');
  cleanup(tmp.root);
});

test('routingGuard: allows write when current_skill is brain-plan', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-plan'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow');
  cleanup(tmp.root);
});

test('routingGuard: allows write when current_skill is null', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: null
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow on null skill');
  cleanup(tmp.root);
});

test('routingGuard: allows write when brain-state.json missing', function () {
  var tmp = makeTempBrain();
  // Do NOT write brain-state.json
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.continue, true, 'should allow on missing state');
  cleanup(tmp.root);
});

test('routingGuard: blocks source write when current_skill is brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'src/auth.js' });
  });
  assertEqual(result.decision, 'block', 'should block');
  assertContains(result.reason, 'brain-routing-guard', 'reason should name the hook');
  assertContains(result.reason, 'brain-dev', 'reason should name the skill');
  assertContains(result.reason, 'router', 'reason should say router');
  cleanup(tmp.root);
});

test('routingGuard: blocks source write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: 'scripts/new-feature.js' });
  });
  assertEqual(result.decision, 'block', 'should block');
  assertContains(result.reason, 'brain-consult', 'reason should name the skill');
  cleanup(tmp.root);
});

test('routingGuard: allows dev-context write when current_skill is brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/dev-context-2026-03-29-test.md' });
  });
  assertEqual(result.continue, true, 'should allow dev-context write');
  cleanup(tmp.root);
});

test('routingGuard: allows brain-state.json write when current_skill is brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/brain-state.json' });
  });
  assertEqual(result.continue, true, 'should allow brain-state write');
  cleanup(tmp.root);
});

test('routingGuard: allows consult JSON write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/consult-2026-03-29T10-30-00Z.json' });
  });
  assertEqual(result.continue, true, 'should allow consult JSON write');
  cleanup(tmp.root);
});

test('routingGuard: allows consult-log.md write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/progress/consult-log.md' });
  });
  assertEqual(result.continue, true, 'should allow consult-log write');
  cleanup(tmp.root);
});

test('routingGuard: handles backslash paths (Windows)', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain\\working-memory\\dev-context-test.md' });
  });
  assertEqual(result.continue, true, 'should allow with backslash path');
  cleanup(tmp.root);
});

test('routingGuard: allows episode-consult write when current_skill is brain-consult', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-consult'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/episode-consult-2026-03-29T10-30-00Z.md' });
  });
  assertEqual(result.continue, true, 'should allow episode-consult write');
  cleanup(tmp.root);
});

test('routingGuard: blocks non-allowlist .brain write when brain-dev', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), {
    current_skill: 'brain-dev'
  });
  var result = withCwd(tmp.root, function () {
    return mod.routingGuard({ file_path: '.brain/working-memory/context-packet-test.md' });
  });
  assertEqual(result.decision, 'block', 'should block context-packet from brain-dev');
  cleanup(tmp.root);
});

// ===========================================================================
// HOOKS registry
// ===========================================================================

test('HOOKS registry: routingGuard is tier 1', function () {
  var entry = mod.HOOKS.routingGuard;
  assert(entry, 'routingGuard should be in HOOKS');
  assertEqual(entry.tier, 1, 'should be tier 1');
  assertEqual(typeof entry.fn, 'function', 'should have a function');
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

runTests();
