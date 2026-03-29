#!/usr/bin/env node
/**
 * brain-self-check.js — Post-task mechanical quality check
 *
 * Checks for skipped tests, missing tests, uncommitted files,
 * and missing commit. Zero LLM cost.
 *
 * Usage: node scripts/brain-self-check.js --task-id <id> --tests-summary <summary>
 * Output: JSON { confidence, warnings } to stdout
 * Exit:  0=success, 1=error
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

var childProcess = require('child_process');

function computeConfidence(checks) {
  var warnings = [];
  var gitAvailable = checks.gitAvailable !== false;

  // Check 1: Tests skipped
  var summary = (checks.testsSummary || '').toLowerCase();
  var skippedMatch = summary.match(/(\d+)\s*skipped/);
  var pendingMatch = summary.match(/(\d+)\s*pending/);
  var todoMatch = summary.match(/(\d+)\s*todo/);
  var skipped = 0;
  if (skippedMatch) skipped += parseInt(skippedMatch[1], 10);
  if (pendingMatch) skipped += parseInt(pendingMatch[1], 10);
  if (todoMatch) skipped += parseInt(todoMatch[1], 10);
  if (skipped > 0) {
    warnings.push(skipped + ' tests skipped');
  }

  // Check 2: Tests missing
  var testsMissing = !summary || summary === 'no tests' || summary === 'none' ||
    summary.includes('no test runner') || summary.includes('no test summary');
  if (testsMissing) {
    warnings.push('no tests found for this task');
  }

  // Check 3: Uncommitted files
  if (gitAvailable && checks.hasUncommittedFiles) {
    warnings.push('uncommitted files in working directory');
  }

  // Check 4: Commit not found
  if (gitAvailable && !checks.commitFound) {
    warnings.push('no commit found matching task');
  }

  var confidence;
  if (testsMissing || (gitAvailable && checks.hasUncommittedFiles) || warnings.length >= 3) {
    confidence = 'low';
  } else if (warnings.length === 0) {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }

  return { confidence: confidence, warnings: warnings };
}

function gatherChecks(taskId, testsSummary) {
  var gitAvailable = true;
  var hasUncommitted = false;
  try {
    var statusOutput = childProcess.execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    hasUncommitted = statusOutput.length > 0;
  } catch {
    gitAvailable = false;
  }

  var commitFound = false;
  if (gitAvailable) {
    try {
      var slug = taskId.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      var logOutput = childProcess.execFileSync('git', ['log', '-5', '--oneline'], {
        encoding: 'utf-8',
        timeout: 5000
      });
      commitFound = logOutput.includes(slug) || logOutput.includes(taskId);
    } catch {
      commitFound = false;
    }
  }

  return {
    testsSummary: testsSummary,
    gitAvailable: gitAvailable,
    hasUncommittedFiles: hasUncommitted,
    commitFound: commitFound
  };
}

function main() {
  var taskId = '';
  var testsSummary = '';

  for (var i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
      case '--task-id':
        taskId = process.argv[++i] || '';
        break;
      case '--tests-summary':
        testsSummary = process.argv[++i] || '';
        break;
    }
  }

  var checks = gatherChecks(taskId, testsSummary);
  var result = computeConfidence(checks);

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = { computeConfidence: computeConfidence };

if (require.main === module) {
  main();
}
