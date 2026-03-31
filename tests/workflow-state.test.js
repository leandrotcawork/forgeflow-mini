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

test('createState starts in spec with empty workflow fields', function () {
  var state = mod.createState();
  assertEqual(state.phase, 'spec', 'phase should start in spec');
  assertEqual(state.spec_status, 'pending', 'spec_status should start pending');
  assertEqual(state.plan_status, 'pending', 'plan_status should start pending');
  assertEqual(state.review_status, 'pending', 'review_status should start pending');
  assertEqual(state.verify_status, 'pending', 'verify_status should start pending');
  assertEqual(state.allowed_files, [], 'allowed_files should start empty');
  assertEqual(state.needs_user_validation, false, 'needs_user_validation should start false');
  assertEqual(state.verify_commands, [], 'verify_commands should start empty');
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
  assertEqual(state.phase, 'review', 'phase should advance to review');
  assertEqual(state.last_error, null, 'last_error should clear on success');
});

test('start_document fails if verify did not pass', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState({ spec_status: 'approved' }), 'start_document');
  }, 'start_document should throw');

  assertEqual(err.message, 'start_document requires verify to pass', 'should explain verify gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'start_document requires verify to pass', 'state should capture last_error');
});

test('approve_review fails without approved plan', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState({ spec_status: 'approved' }), 'approve_review');
  }, 'approve_review should throw');

  assertEqual(err.message, 'approve_review requires approved plan', 'should explain plan gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'approve_review requires approved plan', 'state should capture last_error');
});

test('pass_verify fails without approved review', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState({ spec_status: 'approved', plan_status: 'approved' }), 'pass_verify');
  }, 'pass_verify should throw');

  assertEqual(err.message, 'pass_verify requires approved review', 'should explain review gate');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'pass_verify requires approved review', 'state should capture last_error');
});

test('unknown transition fails', function () {
  var err = assertThrows(function () {
    mod.transition(mod.createState(), 'not_a_real_transition');
  }, 'unknown transition should throw');

  assertEqual(err.message, 'Unknown workflow transition: not_a_real_transition', 'should explain unknown transition');
  assert(err.state, 'error should include state snapshot');
  assertEqual(err.state.last_error, 'Unknown workflow transition: not_a_real_transition', 'state should capture last_error');
});

test('start_document succeeds only after verify passes', function () {
  var state = mod.createState({ spec_status: 'approved' });
  state = mod.transition(state, 'approve_plan', {
    allowed_files: ['scripts/workflow-state.js']
  });
  state = mod.transition(state, 'approve_review');
  state = mod.transition(state, 'pass_verify', {
    verify_commands: ['node tests/workflow-state.test.js']
  });
  state = mod.transition(state, 'start_document');

  assertEqual(state.verify_status, 'passed', 'verify should be passed');
  assertEqual(state.verify_commands, ['node tests/workflow-state.test.js'], 'verify_commands should be retained');
  assertEqual(state.phase, 'document', 'phase should advance to document');
  assertEqual(state.last_error, null, 'last_error should clear on success');
});

test('templates expose the workflow state contract', function () {
  var workflowTemplate = readJSON('templates/brain/working-memory/workflow-state.json');
  var brainStateTemplate = readJSON('templates/brain/working-memory/brain-state.json');

  assertEqual(workflowTemplate.phase, 'spec', 'workflow template should start in spec');
  assert('task_id' in workflowTemplate, 'workflow template should include task_id');
  assert('intent' in workflowTemplate, 'workflow template should include intent');
  assert('spec_status' in workflowTemplate, 'workflow template should include spec_status');
  assert('plan_status' in workflowTemplate, 'workflow template should include plan_status');
  assert('review_status' in workflowTemplate, 'workflow template should include review_status');
  assert('verify_status' in workflowTemplate, 'workflow template should include verify_status');
  assert('allowed_files' in workflowTemplate, 'workflow template should include allowed_files');
  assert('needs_user_validation' in workflowTemplate, 'workflow template should include needs_user_validation');
  assert('verify_commands' in workflowTemplate, 'workflow template should include verify_commands');
  assert('last_error' in workflowTemplate, 'workflow template should include last_error');
  assertEqual(brainStateTemplate.workflow_state_file, '.brain/working-memory/workflow-state.json', 'brain-state template should point to workflow_state_file');
});

runTests();
