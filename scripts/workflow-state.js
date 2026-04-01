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

var PHASES = {
  SPEC_PENDING:   'SPEC_PENDING',
  SPEC_REVIEW:    'SPEC_REVIEW',
  SPEC_APPROVAL:  'SPEC_APPROVAL',
  PLAN_PENDING:   'PLAN_PENDING',
  IMPLEMENTING:   'IMPLEMENTING',
  REVIEWING:      'REVIEWING',
  VERIFYING:      'VERIFYING',
  DOCUMENTING:    'DOCUMENTING',
  COMPLETED:      'COMPLETED'
};

function createState(overrides) {
  var state = {
    task_id:             null,
    worktree_name:       null,
    branch_name:         null,
    intent:              null,
    phase:               PHASES.SPEC_PENDING,
    spec_status:         'pending',
    plan_status:         'pending',
    review_status:       'pending',
    verify_status:       'pending',
    allowed_files:       [],
    needs_user_approval: true,
    commit_sha:          null,
    last_error:          null
  };

  if (!overrides) return state;

  var copy = clone(state);
  var keys = Object.keys(overrides);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'allowed_files') {
      copy[key] = toStringArray(overrides[key]);
    } else {
      copy[key] = overrides[key];
    }
  }
  copy.allowed_files = toStringArray(copy.allowed_files);
  if (copy.phase == null)               copy.phase = PHASES.SPEC_PENDING;
  if (copy.spec_status == null)         copy.spec_status = 'pending';
  if (copy.plan_status == null)         copy.plan_status = 'pending';
  if (copy.review_status == null)       copy.review_status = 'pending';
  if (copy.verify_status == null)       copy.verify_status = 'pending';
  if (copy.needs_user_approval == null) copy.needs_user_approval = true;
  if (copy.last_error == null)          copy.last_error = null;
  if (copy.commit_sha == null)          copy.commit_sha = null;
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

  try {
    switch (action) {

      case 'open_spec':
        if (nextState.phase !== PHASES.SPEC_PENDING) {
          fail(nextState, 'open_spec requires phase = SPEC_PENDING');
        }
        nextState.phase = PHASES.SPEC_REVIEW;
        nextState.spec_status = 'reviewing';
        nextState.last_error = null;
        return nextState;

      case 'submit_spec_review':
        if (nextState.phase !== PHASES.SPEC_REVIEW) {
          fail(nextState, 'submit_spec_review requires phase = SPEC_REVIEW');
        }
        nextState.phase = PHASES.SPEC_APPROVAL;
        nextState.last_error = null;
        return nextState;

      case 'approve_spec':
        if (nextState.phase !== PHASES.SPEC_APPROVAL) {
          fail(nextState, 'approve_spec requires phase = SPEC_APPROVAL');
        }
        nextState.spec_status = 'approved';
        nextState.phase = PHASES.PLAN_PENDING;
        nextState.last_error = null;
        return nextState;

      case 'reject_spec':
        if (nextState.phase !== PHASES.SPEC_APPROVAL) {
          fail(nextState, 'reject_spec requires phase = SPEC_APPROVAL');
        }
        nextState.spec_status = 'rejected';
        nextState.phase = PHASES.SPEC_PENDING;
        nextState.last_error = null;
        return nextState;

      case 'approve_plan':
        if (nextState.spec_status !== 'approved') {
          fail(nextState, 'approve_plan requires approved spec');
        }
        nextState.plan_status = 'approved';
        nextState.phase = PHASES.IMPLEMENTING;
        if (data.allowed_files != null) {
          nextState.allowed_files = toStringArray(data.allowed_files);
        }
        nextState.last_error = null;
        return nextState;

      case 'complete_task':
        if (nextState.phase !== PHASES.IMPLEMENTING) {
          fail(nextState, 'complete_task requires phase = IMPLEMENTING');
        }
        nextState.phase = PHASES.REVIEWING;
        nextState.last_error = null;
        return nextState;

      case 'pass_review':
        if (nextState.plan_status !== 'approved') {
          fail(nextState, 'pass_review requires plan_status = approved');
        }
        nextState.review_status = 'passed';
        nextState.phase = PHASES.VERIFYING;
        nextState.last_error = null;
        return nextState;

      case 'fail_review':
        if (nextState.phase !== PHASES.REVIEWING) {
          fail(nextState, 'fail_review requires phase = REVIEWING');
        }
        nextState.review_status = 'failed';
        nextState.phase = PHASES.IMPLEMENTING;
        nextState.last_error = null;
        return nextState;

      case 'pass_verify':
        if (nextState.review_status !== 'passed') {
          fail(nextState, 'pass_verify requires review_status = passed');
        }
        nextState.verify_status = 'passed';
        nextState.phase = PHASES.DOCUMENTING;
        nextState.last_error = null;
        return nextState;

      case 'fail_verify':
        nextState.verify_status = 'failed';
        nextState.phase = PHASES.VERIFYING;
        nextState.last_error = null;
        return nextState;

      case 'complete':
        if (nextState.verify_status !== 'passed') {
          fail(nextState, 'complete requires verify_status = passed');
        }
        nextState.phase = PHASES.COMPLETED;
        if (data.commit_sha != null) {
          nextState.commit_sha = data.commit_sha;
        }
        nextState.last_error = null;
        return nextState;

      default:
        fail(nextState, 'Unknown workflow transition: ' + action);
    }
  } catch (err) {
    if (err && err.state == null) err.state = nextState;
    throw err;
  }
}

module.exports = {
  WorkflowStateError: WorkflowStateError,
  PHASES: PHASES,
  createState: createState,
  transition: transition
};

if (require.main === module) {
  process.stdout.write(JSON.stringify(createState(), null, 2) + '\n');
}
