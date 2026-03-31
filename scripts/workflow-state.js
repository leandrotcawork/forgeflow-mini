#!/usr/bin/env node
/*
 * workflow-state.js
 *
 * Small workflow state machine for ForgeFlow v3.
 * Pure Node.js, no dependencies.
 */

'use strict';

function WorkflowStateError(message) {
  Error.call(this);
  this.name = 'WorkflowStateError';
  this.message = message;
  this.state = null;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, WorkflowStateError);
  }
}

WorkflowStateError.prototype = Object.create(Error.prototype);
WorkflowStateError.prototype.constructor = WorkflowStateError;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(function (item) {
      return typeof item === 'string' && item.length > 0;
    }).slice();
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }
  return [];
}

function createState(overrides) {
  var state = {
    task_id: null,
    intent: null,
    phase: 'spec',
    spec_status: 'pending',
    plan_status: 'pending',
    review_status: 'pending',
    verify_status: 'pending',
    allowed_files: [],
    needs_user_validation: false,
    verify_commands: [],
    last_error: null
  };

  if (!overrides) {
    return state;
  }

  var copy = clone(state);
  var keys = Object.keys(overrides);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'allowed_files' || key === 'verify_commands') {
      copy[key] = toStringArray(overrides[key]);
    } else {
      copy[key] = overrides[key];
    }
  }
  copy.allowed_files = toStringArray(copy.allowed_files);
  copy.verify_commands = toStringArray(copy.verify_commands);
  if (copy.phase == null) copy.phase = 'spec';
  if (copy.spec_status == null) copy.spec_status = 'pending';
  if (copy.plan_status == null) copy.plan_status = 'pending';
  if (copy.review_status == null) copy.review_status = 'pending';
  if (copy.verify_status == null) copy.verify_status = 'pending';
  if (copy.needs_user_validation == null) copy.needs_user_validation = false;
  if (copy.last_error == null) copy.last_error = null;
  return copy;
}

function fail(nextState, message) {
  var err = new WorkflowStateError(message);
  nextState.last_error = message;
  err.state = nextState;
  throw err;
}

function transition(state, action, payload) {
  var nextState = createState(state);
  var data = payload || {};
  var allowedFiles;

  try {
    switch (action) {
      case 'approve_spec':
        nextState.spec_status = 'approved';
        nextState.phase = 'plan';
        nextState.last_error = null;
        return nextState;

      case 'approve_plan':
        if (nextState.spec_status !== 'approved') {
          fail(nextState, 'approve_plan requires approved spec');
        }
        allowedFiles = data.allowed_files != null ? data.allowed_files : nextState.allowed_files;
        nextState.plan_status = 'approved';
        nextState.allowed_files = toStringArray(allowedFiles);
        nextState.phase = 'review';
        nextState.last_error = null;
        return nextState;

      case 'approve_review':
        if (nextState.plan_status !== 'approved') {
          fail(nextState, 'approve_review requires approved plan');
        }
        if (nextState.phase !== 'review' && nextState.phase !== 'plan') {
          fail(nextState, 'approve_review requires review phase');
        }
        nextState.review_status = 'approved';
        nextState.phase = 'verify';
        nextState.last_error = null;
        return nextState;

      case 'pass_verify':
        if (nextState.review_status !== 'approved') {
          fail(nextState, 'pass_verify requires approved review');
        }
        nextState.verify_status = 'passed';
        if (data.verify_commands != null) {
          nextState.verify_commands = toStringArray(data.verify_commands);
        }
        nextState.phase = 'verify';
        nextState.last_error = null;
        return nextState;

      case 'start_document':
        if (nextState.verify_status !== 'passed') {
          fail(nextState, 'start_document requires verify to pass');
        }
        nextState.phase = 'document';
        nextState.last_error = null;
        return nextState;

      default:
        fail(nextState, 'Unknown workflow transition: ' + action);
    }
  } catch (err) {
    if (err && err.state == null) {
      err.state = nextState;
    }
    throw err;
  }
}

module.exports = {
  WorkflowStateError: WorkflowStateError,
  createState: createState,
  transition: transition
};

if (require.main === module) {
  process.stdout.write(JSON.stringify(createState(), null, 2) + '\n');
}
