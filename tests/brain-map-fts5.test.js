'use strict';

/**
 * Regression test: FTS5 keyword sanitization.
 * Hyphenated keywords like "health-check" must be quoted
 * or stripped of operators before use in FTS5 MATCH queries.
 *
 * Run: node tests/brain-map-fts5.test.js
 */

var passed = 0;
var failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + (msg || ''));
}

/**
 * Sanitize keywords for FTS5 MATCH.
 * Rules:
 * - Wrap each term in double quotes to escape operators (-, *, :, etc.)
 * - Deduplicate
 * - Join with OR
 */
function sanitizeFts5Keywords(keywords) {
  return keywords
    .map(function (k) { return '"' + k.replace(/"/g, '') + '"'; })
    .filter(function (k, i, arr) { return arr.indexOf(k) === i; })
    .join(' OR ');
}

console.log('\nRunning brain-map FTS5 sanitization tests...\n');

test('plain keyword is quoted', function () {
  var result = sanitizeFts5Keywords(['endpoint']);
  assert(result === '"endpoint"', 'got: ' + result);
});

test('hyphenated keyword is quoted (not subtracted)', function () {
  var result = sanitizeFts5Keywords(['health-check']);
  assert(result === '"health-check"', 'got: ' + result);
});

test('multiple keywords joined with OR', function () {
  var result = sanitizeFts5Keywords(['health-check', 'endpoint', 'version']);
  assert(result === '"health-check" OR "endpoint" OR "version"', 'got: ' + result);
});

test('existing quotes in keyword are stripped', function () {
  var result = sanitizeFts5Keywords(['"bad"keyword']);
  assert(result === '"badkeyword"', 'got: ' + result);
});

test('duplicates are removed', function () {
  var result = sanitizeFts5Keywords(['mcp', 'mcp', 'server']);
  assert(result === '"mcp" OR "server"', 'got: ' + result);
});

test('wildcard operator is quoted (not expanded)', function () {
  var result = sanitizeFts5Keywords(['brain*']);
  assert(result === '"brain*"', 'got: ' + result);
});

console.log('\n' + (passed + failed) + ' tests, ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
