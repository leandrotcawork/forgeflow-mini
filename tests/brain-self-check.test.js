#!/usr/bin/env node

/**
 * Tests for scripts/brain-self-check.js
 *
 * Pure Node.js — zero test framework dependencies.
 * Run: node tests/brain-self-check.test.js
 */

'use strict';

var mod = require('../scripts/brain-self-check.js');

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
  for (var i = 0; i < tests.length; i++) {
    try {
      tests[i].fn();
      passed++;
      console.log('  PASS  ' + tests[i].name);
    } catch (err) {
      failed++;
      console.log('  FAIL  ' + tests[i].name);
      console.log('        ' + err.message);
    }
  }
  console.log('\n' + (passed + failed) + ' tests, ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// computeConfidence tests
// ---------------------------------------------------------------------------

test('confidence is high when 0 warnings', function () {
  var result = mod.computeConfidence({
    testsSummary: '8 passed, 0 failed, 0 skipped',
    hasUncommittedFiles: false,
    commitFound: true
  });
  assertEqual(result.confidence, 'high');
  assertEqual(result.warnings.length, 0);
});

test('confidence is medium when 1 warning (skipped tests)', function () {
  var result = mod.computeConfidence({
    testsSummary: '6 passed, 0 failed, 2 skipped',
    hasUncommittedFiles: false,
    commitFound: true
  });
  assertEqual(result.confidence, 'medium');
  assert(result.warnings.length === 1, 'should have 1 warning');
  assert(result.warnings[0].includes('skipped'), 'warning should mention skipped');
});

test('confidence is low when tests missing', function () {
  var result = mod.computeConfidence({
    testsSummary: '',
    hasUncommittedFiles: false,
    commitFound: true
  });
  assertEqual(result.confidence, 'low');
  assert(result.warnings.length >= 1, 'should have warnings');
  assert(result.warnings[0].includes('no tests'), 'warning should mention no tests');
});

test('confidence is low when 3 warnings', function () {
  var result = mod.computeConfidence({
    testsSummary: '3 passed, 0 failed, 2 skipped',
    hasUncommittedFiles: true,
    commitFound: false
  });
  assertEqual(result.confidence, 'low');
  assertEqual(result.warnings.length, 3, 'should have 3 warnings');
});

runTests();
