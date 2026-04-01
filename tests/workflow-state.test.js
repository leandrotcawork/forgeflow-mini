#!/usr/bin/env node

'use strict';

var fs = require('fs');
var path = require('path');

var mod = require('../scripts/workflow-state.js');

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
    throw new Error((message || 'assertEqual') + ': expected ' + e + ', got ' + a);
  }
}

function assertThrows(fn, message) {
  var threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    return err;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw');
  }
}

function runTests() {
  console.log('Running workflow-state tests...\n');

  for (var i = 0; i < tests.length; i++) {
    try {
      tests[i].fn();
      passed++;
      console.log('  PASS: ' + tests[i].name);
    } catch (err) {
      failed++;
      console.log('  FAIL: ' + tests[i].name);
      console.log('        ' + err.message);
    }
  }

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  if (failed > 0) process.exit(1);
}

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relPath), 'utf-8'));
}

test('createState starts in SPEC_PENDING with empty workflow fields', function () {
  var state = mod.createState();
  assertEqual(state.phase, 'SPEC_PENDING', 'phase should start in SPEC_PENDING');
  assertEqual(state.spec_status, 'pending', 'spec_status should start pending');
  assertEqual(state.plan_status, 'pending', 'plan_status should start pending');
  assertEqual(state.review_status, 'pending', 'review_status should start pending');
  assertEqual(state.verify_status, 'pending', 'verify_status should start pending');
  assertEqual(state.allowed_files, [], 'allowed_files should start empty');
  assertEqual(state.needs_user_approval, false, 'needs_user_approval should start false');
  assertEqual(state.commit_sha, null, 'commit_sha should start null');
  assertEqual(state.last_error, null, 'last_error should start null');
});

test('approve_plan fails without approved spec', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState(), 'approve_plan', {
      allowed_files: ['scripts/workflow-state.js']
    });
  }, 'approve_plan should throw');

  assert(err instanceof Error, 'should throw an error');
  assertEqual(err.message, 'approve_plan requires approved spec', 'should explain spec gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'approve_plan requires approved spec', 'state should capture last_error');
});

test('approve_plan saves allowed_files after spec approval', function () {
  var state = mod.createState({ spec_status: 'approved' });
  state = mod.transition(state, 'approve_plan', {
    allowed_files: ['scripts/workflow-state.js', 'tests/workflow-state.test.js']
  });

  assertEqual(state.plan_status, 'approved', 'plan_status should be approved');
  assertEqual(state.allowed_files, ['scripts/workflow-state.js', 'tests/workflow-state.test.js'], 'allowed_files should be saved');
  assertEqual(state.phase, 'IMPLEMENTING', 'phase should advance to IMPLEMENTING');
  assertEqual(state.last_error, null, 'last_error should clear on success');
});

test('complete fails if verify did not pass', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState({ phase: 'DOCUMENTING', verify_status: 'pending' }), 'complete');
  }, 'complete should throw');

  assertEqual(err.message, 'complete requires verify_status = passed', 'should explain verify gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'complete requires verify_status = passed', 'state should capture last_error');
});

test('pass_review fails without approved plan', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState({ phase: 'REVIEWING', spec_status: 'approved' }), 'pass_review');
  }, 'pass_review should throw');

  assertEqual(err.message, 'pass_review requires plan_status = approved', 'should explain plan gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'pass_review requires plan_status = approved', 'state should capture last_error');
});

test('pass_verify fails without passed review', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState({ phase: 'VERIFYING', spec_status: 'approved', plan_status: 'approved' }), 'pass_verify');
  }, 'pass_verify should throw');

  assertEqual(err.message, 'pass_verify requires review_status = passed', 'should explain review gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'pass_verify requires review_status = passed', 'state should capture last_error');
});

test('unknown transition fails', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState(), 'not_a_real_transition');
  }, 'unknown transition should throw');

  assertEqual(err.message, 'Unknown workflow transition: not_a_real_transition', 'should explain unknown transition');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'Unknown workflow transition: not_a_real_transition', 'state should capture last_error');
});

test('full happy path: spec -> implementing -> reviewing -> verifying -> documenting', function () {
  var state = mod.createState({ spec_status: 'approved' });
  state = mod.transition(state, 'approve_plan', {
    allowed_files: ['scripts/workflow-state.js']
  });
  assertEqual(state.phase, 'IMPLEMENTING', 'approve_plan should advance to IMPLEMENTING');
  state = mod.transition(state, 'complete_task');
  assertEqual(state.phase, 'REVIEWING', 'complete_task should advance to REVIEWING');
  state = mod.transition(state, 'pass_review');
  assertEqual(state.phase, 'VERIFYING', 'pass_review should advance to VERIFYING');
  state = mod.transition(state, 'pass_verify');
  assertEqual(state.phase, 'DOCUMENTING', 'pass_verify should advance to DOCUMENTING');
  assertEqual(state.verify_status, 'passed', 'verify should be passed');
  assertEqual(state.last_error, null, 'last_error should clear on success');
});

test('templates expose the workflow state contract', function () {
  var workflowTemplate = readJSON('templates/brain/working-memory/workflow-state.json');
  var brainStateTemplate = readJSON('templates/brain/working-memory/brain-state.json');

  assertEqual(workflowTemplate.phase, 'SPEC_PENDING', 'workflow template should start in SPEC_PENDING');
  assert('task_id' in workflowTemplate, 'workflow template should include task_id');
  assert('worktree_name' in workflowTemplate, 'workflow template should include worktree_name');
  assert('branch_name' in workflowTemplate, 'workflow template should include branch_name');
  assert('intent' in workflowTemplate, 'workflow template should include intent');
  assert('spec_status' in workflowTemplate, 'workflow template should include spec_status');
  assert('plan_status' in workflowTemplate, 'workflow template should include plan_status');
  assert('review_status' in workflowTemplate, 'workflow template should include review_status');
  assert('verify_status' in workflowTemplate, 'workflow template should include verify_status');
  assert('allowed_files' in workflowTemplate, 'workflow template should include allowed_files');
  assert('needs_user_approval' in workflowTemplate, 'workflow template should include needs_user_approval');
  assert('commit_sha' in workflowTemplate, 'workflow template should include commit_sha');
  assert('last_error' in workflowTemplate, 'workflow template should include last_error');
  assertEqual(brainStateTemplate.workflow_state_file, '.brain/working-memory/workflow-state.json', 'brain-state template should point to workflow_state_file');
});

test('open_spec: SPEC_PENDING -> SPEC_REVIEW', function () {
  var s = mod.createState({ task_id: 'test-task' });
  var s2 = mod.transition(s, 'open_spec');
  assertEqual(s2.phase, 'SPEC_REVIEW');
  assertEqual(s2.spec_status, 'reviewing');
});

test('approve_spec: sets approved and PLAN_PENDING', function () {
  var s = mod.createState({ phase: 'SPEC_APPROVAL', spec_status: 'reviewing' });
  var s2 = mod.transition(s, 'approve_spec');
  assertEqual(s2.phase, 'PLAN_PENDING');
  assertEqual(s2.spec_status, 'approved');
});

test('approve_plan: PLAN_PENDING -> IMPLEMENTING, sets allowed_files', function () {
  var s = mod.createState({ phase: 'PLAN_PENDING', spec_status: 'approved' });
  var s2 = mod.transition(s, 'approve_plan', { allowed_files: ['src/foo.js'] });
  assertEqual(s2.phase, 'IMPLEMENTING');
  assertEqual(s2.plan_status, 'approved');
  assertEqual(s2.allowed_files, ['src/foo.js']);
});

test('approve_plan requires approved spec', function () {
  var s = mod.createState({ phase: 'PLAN_PENDING', spec_status: 'pending' });
  assertThrows(function () { mod.transition(s, 'approve_plan'); },
    'approve_plan should require approved spec');
});

test('pass_review: REVIEWING -> VERIFYING', function () {
  var s = mod.createState({ phase: 'REVIEWING', plan_status: 'approved' });
  var s2 = mod.transition(s, 'pass_review');
  assertEqual(s2.phase, 'VERIFYING');
  assertEqual(s2.review_status, 'passed');
});

test('fail_review: REVIEWING -> IMPLEMENTING (rework)', function () {
  var s = mod.createState({ phase: 'REVIEWING', plan_status: 'approved' });
  var s2 = mod.transition(s, 'fail_review');
  assertEqual(s2.phase, 'IMPLEMENTING');
  assertEqual(s2.review_status, 'failed');
});

test('pass_verify: VERIFYING -> DOCUMENTING', function () {
  var s = mod.createState({ phase: 'VERIFYING', review_status: 'passed' });
  var s2 = mod.transition(s, 'pass_verify');
  assertEqual(s2.phase, 'DOCUMENTING');
  assertEqual(s2.verify_status, 'passed');
});

test('pass_verify requires passed review', function () {
  var s = mod.createState({ phase: 'VERIFYING', review_status: 'pending' });
  assertThrows(function () { mod.transition(s, 'pass_verify'); },
    'pass_verify should require passed review');
});

test('complete: DOCUMENTING -> COMPLETED', function () {
  var s = mod.createState({ phase: 'DOCUMENTING', verify_status: 'passed' });
  var s2 = mod.transition(s, 'complete', { commit_sha: 'abc123' });
  assertEqual(s2.phase, 'COMPLETED');
  assertEqual(s2.commit_sha, 'abc123');
});

test('PHASES constants are exported', function () {
  assert(mod.PHASES, 'PHASES not exported');
  assertEqual(mod.PHASES.SPEC_PENDING, 'SPEC_PENDING');
  assertEqual(mod.PHASES.IMPLEMENTING, 'IMPLEMENTING');
  assertEqual(mod.PHASES.COMPLETED, 'COMPLETED');
});

test('createState defaults to SPEC_PENDING phase', function () {
  var s = mod.createState();
  assertEqual(s.phase, 'SPEC_PENDING');
  assertEqual(s.worktree_name, null);
  assertEqual(s.branch_name, null);
  assertEqual(s.commit_sha, null);
});

runTests();
