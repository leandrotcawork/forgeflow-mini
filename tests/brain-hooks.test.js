#!/usr/bin/env node

/**
 * Tests for hooks/brain-hooks.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-hooks.test.js
 *
 * Uses temporary directories to test all operations without touching real files.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');

var mod = require('../hooks/brain-hooks.js');

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
  console.log('Running brain-hooks tests...\n');

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
// Helpers — temp directory with .brain structure
// ---------------------------------------------------------------------------

function makeTempBrain() {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-hooks-test-'));
  var brainDir = path.join(tmp, '.brain');
  var progressDir = path.join(brainDir, 'progress');
  var wmDir = path.join(brainDir, 'working-memory');
  fs.mkdirSync(progressDir, { recursive: true });
  fs.mkdirSync(wmDir, { recursive: true });
  return { root: tmp, brainDir: brainDir, progressDir: progressDir, wmDir: wmDir };
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
// circuitBreakerCheck tests
// ===========================================================================

test('circuitBreakerCheck: closed state returns ok', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.progressDir, 'brain-project-state.json'), {
    circuit_breaker: { state: 'closed', failure_count: 0, last_failure_at: null, cooldown_until: null }
  });
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.continue, true, 'should continue');
  assert(!result.decision, 'should not block');
  cleanup(tmp.root);
});

test('circuitBreakerCheck: open + cooldown NOT expired returns block', function () {
  var tmp = makeTempBrain();
  // Set cooldown far in the future
  var futureDate = new Date(Date.now() + 3600000).toISOString();
  writeJSONFile(path.join(tmp.progressDir, 'brain-project-state.json'), {
    circuit_breaker: { state: 'open', failure_count: 5, last_failure_at: new Date().toISOString(), cooldown_until: futureDate }
  });
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.decision, 'block', 'should block');
  assertContains(result.reason, 'CIRCUIT BREAKER OPEN', 'reason should mention circuit breaker');
  assertContains(result.reason, '5 consecutive failures', 'reason should mention failure count');
  assertContains(result.reason, futureDate, 'reason should mention cooldown_until');
  cleanup(tmp.root);
});

test('circuitBreakerCheck: open + cooldown expired returns ok with context', function () {
  var tmp = makeTempBrain();
  // Set cooldown in the past
  var pastDate = new Date(Date.now() - 3600000).toISOString();
  writeJSONFile(path.join(tmp.progressDir, 'brain-project-state.json'), {
    circuit_breaker: { state: 'open', failure_count: 3, last_failure_at: new Date().toISOString(), cooldown_until: pastDate }
  });
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.continue, true, 'should continue');
  assertContains(result.additionalContext, 'HALF-OPEN', 'should mention half-open transition');
  assertContains(result.additionalContext, 'probe', 'should mention probe');
  cleanup(tmp.root);
});

test('circuitBreakerCheck: half-open state returns ok with context', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.progressDir, 'brain-project-state.json'), {
    circuit_breaker: { state: 'half-open', failure_count: 3, last_failure_at: new Date().toISOString(), cooldown_until: null }
  });
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.continue, true, 'should continue');
  assertContains(result.additionalContext, 'HALF-OPEN', 'should mention half-open');
  assertContains(result.additionalContext, 'probe', 'should mention probe');
  cleanup(tmp.root);
});

test('circuitBreakerCheck: missing state file returns ok', function () {
  var tmp = makeTempBrain();
  // Do NOT write brain-project-state.json
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.continue, true, 'should continue on missing file');
  assert(!result.decision, 'should not block on missing file');
  cleanup(tmp.root);
});

test('circuitBreakerCheck: corrupt state file returns ok', function () {
  var tmp = makeTempBrain();
  fs.writeFileSync(path.join(tmp.progressDir, 'brain-project-state.json'), 'NOT VALID JSON!!!');
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.continue, true, 'should continue on corrupt file');
  cleanup(tmp.root);
});

test('circuitBreakerCheck: missing circuit_breaker key returns ok', function () {
  var tmp = makeTempBrain();
  writeJSONFile(path.join(tmp.progressDir, 'brain-project-state.json'), {
    total_tasks: 5
  });
  var result = withCwd(tmp.root, function () {
    return mod.circuitBreakerCheck({});
  });
  assertEqual(result.continue, true, 'should continue when circuit_breaker key missing');
  cleanup(tmp.root);
});

// ===========================================================================
// pruneConsultAuditFiles tests
// ===========================================================================

test('pruneConsultAuditFiles: TTL only — deletes old files', function () {
  var tmp = makeTempBrain();
  var now = new Date();
  var nowIso = now.toISOString();

  // Create 3 consult files: 2 old (10 days), 1 recent (1 day)
  var oldFile1 = path.join(tmp.wmDir, 'consult-old1.json');
  var oldFile2 = path.join(tmp.wmDir, 'consult-old2.json');
  var newFile = path.join(tmp.wmDir, 'consult-new.json');
  fs.writeFileSync(oldFile1, '{}');
  fs.writeFileSync(oldFile2, '{}');
  fs.writeFileSync(newFile, '{}');

  // Set old mtimes (10 days ago)
  var oldTime = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  fs.utimesSync(oldFile1, oldTime, oldTime);
  fs.utimesSync(oldFile2, oldTime, oldTime);

  var result = mod.pruneConsultAuditFiles(tmp.wmDir, nowIso, 7, 100);
  assertEqual(result.deleted_for_ttl, 2, 'should delete 2 old files');
  assertEqual(result.deleted_for_cap, 0, 'no cap deletions');
  assertEqual(result.remaining, 1, 'should have 1 remaining');

  assert(!fs.existsSync(oldFile1), 'old file 1 should be gone');
  assert(!fs.existsSync(oldFile2), 'old file 2 should be gone');
  assert(fs.existsSync(newFile), 'new file should remain');
  cleanup(tmp.root);
});

test('pruneConsultAuditFiles: cap only — deletes oldest above cap', function () {
  var tmp = makeTempBrain();
  var now = new Date();
  var nowIso = now.toISOString();

  // Create 5 recent consult files with staggered mtimes, cap = 3
  var files = [];
  for (var i = 0; i < 5; i++) {
    var f = path.join(tmp.wmDir, 'consult-cap' + i + '.json');
    fs.writeFileSync(f, '{}');
    var t = new Date(now.getTime() - (5 - i) * 60000); // oldest first
    fs.utimesSync(f, t, t);
    files.push(f);
  }

  var result = mod.pruneConsultAuditFiles(tmp.wmDir, nowIso, 30, 3);
  assertEqual(result.deleted_for_ttl, 0, 'no TTL deletions');
  assertEqual(result.deleted_for_cap, 2, 'should delete 2 over cap');
  assertEqual(result.remaining, 3, 'should have 3 remaining');

  // Oldest 2 should be deleted
  assert(!fs.existsSync(files[0]), 'oldest file should be gone');
  assert(!fs.existsSync(files[1]), 'second oldest should be gone');
  assert(fs.existsSync(files[2]), 'third should remain');
  assert(fs.existsSync(files[3]), 'fourth should remain');
  assert(fs.existsSync(files[4]), 'newest should remain');
  cleanup(tmp.root);
});

test('pruneConsultAuditFiles: both TTL and cap', function () {
  var tmp = makeTempBrain();
  var now = new Date();
  var nowIso = now.toISOString();

  // 2 old files (TTL), 4 recent files, cap = 2 → TTL deletes 2, then cap deletes 2
  for (var i = 0; i < 2; i++) {
    var oldF = path.join(tmp.wmDir, 'consult-old' + i + '.json');
    fs.writeFileSync(oldF, '{}');
    var oldT = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldF, oldT, oldT);
  }
  for (var j = 0; j < 4; j++) {
    var newF = path.join(tmp.wmDir, 'consult-recent' + j + '.json');
    fs.writeFileSync(newF, '{}');
    var newT = new Date(now.getTime() - (4 - j) * 60000);
    fs.utimesSync(newF, newT, newT);
  }

  var result = mod.pruneConsultAuditFiles(tmp.wmDir, nowIso, 7, 2);
  assertEqual(result.deleted_for_ttl, 2, 'TTL should delete 2');
  assertEqual(result.deleted_for_cap, 2, 'cap should delete 2');
  assertEqual(result.remaining, 2, 'should have 2 remaining');
  cleanup(tmp.root);
});

test('pruneConsultAuditFiles: non-consult files are untouched', function () {
  var tmp = makeTempBrain();
  var now = new Date();
  var nowIso = now.toISOString();

  // Create a consult file and a non-consult file, both old
  var consultFile = path.join(tmp.wmDir, 'consult-target.json');
  var otherFile = path.join(tmp.wmDir, 'brain-state.json');
  var txtFile = path.join(tmp.wmDir, 'consult-log.txt'); // wrong extension
  fs.writeFileSync(consultFile, '{}');
  fs.writeFileSync(otherFile, '{}');
  fs.writeFileSync(txtFile, '{}');

  var oldT = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  fs.utimesSync(consultFile, oldT, oldT);
  fs.utimesSync(otherFile, oldT, oldT);
  fs.utimesSync(txtFile, oldT, oldT);

  var result = mod.pruneConsultAuditFiles(tmp.wmDir, nowIso, 7, 100);
  assertEqual(result.deleted_for_ttl, 1, 'only consult .json should be deleted');
  assert(!fs.existsSync(consultFile), 'consult file should be deleted');
  assert(fs.existsSync(otherFile), 'non-consult file should remain');
  assert(fs.existsSync(txtFile), 'non-.json consult file should remain');
  cleanup(tmp.root);
});

test('pruneConsultAuditFiles: missing directory returns no-op', function () {
  var result = mod.pruneConsultAuditFiles('/nonexistent/path/that/does/not/exist', new Date().toISOString(), 7, 50);
  assertEqual(result.deleted_for_ttl, 0, 'no TTL deletions');
  assertEqual(result.deleted_for_cap, 0, 'no cap deletions');
  assertEqual(result.remaining, 0, 'no remaining');
});

// ===========================================================================
// sessionEnd integration — verify consult_cleanup is present
// ===========================================================================

test('sessionEnd: returns consult_cleanup in result', function () {
  var tmp = makeTempBrain();
  // Create working-memory with brain-state.json
  writeJSONFile(path.join(tmp.wmDir, 'brain-state.json'), { session_id: 'test' });

  var result = withCwd(tmp.root, function () {
    return mod.sessionEnd({});
  });
  assertEqual(result.continue, true, 'should continue');
  assertContains(result.reason, 'brain-state.json saved', 'should mention save');
  assert(result.consult_cleanup !== undefined, 'should have consult_cleanup');
  assertEqual(result.consult_cleanup.deleted_for_ttl, 0, 'no TTL deletions on empty');
  assertEqual(result.consult_cleanup.deleted_for_cap, 0, 'no cap deletions on empty');
  cleanup(tmp.root);
});

// ===========================================================================
// HOOKS registry — verify circuitBreakerCheck is registered
// ===========================================================================

test('HOOKS registry: circuitBreakerCheck is tier 1', function () {
  var entry = mod.HOOKS.circuitBreakerCheck;
  assert(entry, 'circuitBreakerCheck should be in HOOKS');
  assertEqual(entry.tier, 1, 'should be tier 1');
  assertEqual(typeof entry.fn, 'function', 'should have a function');
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

runTests();
