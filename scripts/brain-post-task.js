#!/usr/bin/env node

/**
 * brain-post-task.js — Post-task operations for brain-task Steps 4+5+6.2+6.4+6.5
 *
 * Replaces 7-11 LLM tool calls with a single script invocation.
 * Zero external dependencies. JSON stdout, stderr diagnostics.
 *
 * Usage:
 *   node scripts/brain-post-task.js \
 *     --task-id <id> --status <success|failure> --model <haiku|sonnet|codex|opus> \
 *     --domain <backend|frontend|database|infra|analytics|cross-domain> \
 *     --score <int> --files-changed '["a.ts"]' --sinapses-loaded '["s-1"]' \
 *     --lessons-loaded '["l-1"]' [--brain-path .brain] [--task-description "..."] \
 *     [--tests-summary "..."] [--short-description "..."] [--now 2026-03-27T12:00:00Z]
 *
 * Exit codes: 0=success, 2=invalid args, 3=filesystem/state error
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

var fs = require('fs');
var path = require('path');

// ---------------------------------------------------------------------------
// Helpers (same pattern as hooks/brain-hooks.js)
// ---------------------------------------------------------------------------

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

function writeJSON(filePath, data) {
  try {
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return true;
  } catch (_) {
    return false;
  }
}

function writeFile(filePath, content) {
  try {
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (_) {
    return false;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (_) {
    return null;
  }
}

function diag(msg) {
  process.stderr.write('[brain-post-task] ' + msg + '\n');
}

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

var VALID_STATUSES = ['success', 'failure'];
var VALID_MODELS = ['haiku', 'sonnet', 'codex', 'opus'];
var VALID_DOMAINS = ['backend', 'frontend', 'database', 'infra', 'analytics', 'cross-domain'];

function parseArgs(argv) {
  var args = {
    taskId: null,
    status: null,
    model: null,
    domain: null,
    score: null,
    filesChanged: [],
    sinapsesLoaded: [],
    lessonsLoaded: [],
    brainPath: '.brain',
    taskDescription: '',
    testsSummary: '',
    shortDescription: '',
    now: null
  };

  var errors = [];
  var i = 0;
  while (i < argv.length) {
    var key = argv[i];
    var val = argv[i + 1];
    switch (key) {
      case '--task-id':
        args.taskId = val; i += 2; break;
      case '--status':
        args.status = val; i += 2; break;
      case '--model':
        args.model = val; i += 2; break;
      case '--domain':
        args.domain = val; i += 2; break;
      case '--score':
        args.score = val; i += 2; break;
      case '--files-changed':
        args.filesChanged = val; i += 2; break;
      case '--sinapses-loaded':
        args.sinapsesLoaded = val; i += 2; break;
      case '--lessons-loaded':
        args.lessonsLoaded = val; i += 2; break;
      case '--brain-path':
        args.brainPath = val; i += 2; break;
      case '--task-description':
        args.taskDescription = val; i += 2; break;
      case '--tests-summary':
        args.testsSummary = val; i += 2; break;
      case '--short-description':
        args.shortDescription = val; i += 2; break;
      case '--now':
        args.now = val; i += 2; break;
      default:
        errors.push('Unknown argument: ' + key);
        i += 1;
        break;
    }
  }

  // Required fields
  if (!args.taskId) errors.push('--task-id is required');
  if (!args.status) errors.push('--status is required');
  if (!args.model) errors.push('--model is required');
  if (!args.domain) errors.push('--domain is required');
  if (args.score === null || args.score === undefined) errors.push('--score is required');

  // Validate status
  if (args.status && VALID_STATUSES.indexOf(args.status) === -1) {
    errors.push('--status must be one of: ' + VALID_STATUSES.join(', '));
  }

  // Validate model
  if (args.model && VALID_MODELS.indexOf(args.model) === -1) {
    errors.push('--model must be one of: ' + VALID_MODELS.join(', '));
  }

  // Validate domain
  if (args.domain && VALID_DOMAINS.indexOf(args.domain) === -1) {
    errors.push('--domain must be one of: ' + VALID_DOMAINS.join(', '));
  }

  // Parse score
  if (args.score !== null && args.score !== undefined) {
    var parsed = parseInt(args.score, 10);
    if (isNaN(parsed)) {
      errors.push('--score must be an integer');
    } else {
      args.score = parsed;
    }
  }

  // Parse JSON arrays
  var arrayFields = [
    { key: 'filesChanged', flag: '--files-changed' },
    { key: 'sinapsesLoaded', flag: '--sinapses-loaded' },
    { key: 'lessonsLoaded', flag: '--lessons-loaded' }
  ];
  for (var j = 0; j < arrayFields.length; j++) {
    var field = arrayFields[j];
    var raw = args[field.key];
    if (typeof raw === 'string') {
      try {
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) {
          errors.push(field.flag + ' must be a JSON array');
        } else {
          args[field.key] = arr;
        }
      } catch (_) {
        errors.push(field.flag + ' must be valid JSON');
      }
    }
  }

  // Parse --now
  if (args.now) {
    var d = new Date(args.now);
    if (isNaN(d.getTime())) {
      errors.push('--now must be a valid ISO date');
    } else {
      args.now = d;
    }
  } else {
    args.now = new Date();
  }

  if (errors.length > 0) {
    return { args: null, errors: errors };
  }
  return { args: args, errors: [] };
}

// ---------------------------------------------------------------------------
// Step 4: Write task-completion record
// ---------------------------------------------------------------------------

function writeTaskCompletionRecord(brainPath, args) {
  var taskId = args.taskId;
  var now = args.now.toISOString();

  var frontmatter = [
    '---',
    'task_id: ' + taskId,
    'status: ' + args.status,
    'model: ' + args.model,
    'domain: ' + args.domain,
    'score: ' + args.score,
    'files_count: ' + args.filesChanged.length,
    'sinapses_count: ' + args.sinapsesLoaded.length,
    'created_at: ' + now,
    '---'
  ].join('\n');

  var sections = [
    '',
    '# Task Completion: ' + taskId,
    '',
    '## Task',
    '',
    args.taskDescription || '(no description)',
    '',
    '## Files Changed',
    ''
  ];

  if (args.filesChanged.length === 0) {
    sections.push('(none)');
  } else {
    for (var i = 0; i < args.filesChanged.length; i++) {
      sections.push('- ' + args.filesChanged[i]);
    }
  }

  sections.push('');
  sections.push('## Tests');
  sections.push('');
  sections.push(args.testsSummary || '(no test summary)');
  sections.push('');
  sections.push('## Sinapses Referenced');
  sections.push('');

  if (args.sinapsesLoaded.length === 0) {
    sections.push('(none)');
  } else {
    for (var j = 0; j < args.sinapsesLoaded.length; j++) {
      sections.push('- ' + args.sinapsesLoaded[j]);
    }
  }

  sections.push('');
  sections.push('## Lessons');
  sections.push('');

  if (args.lessonsLoaded.length === 0) {
    sections.push('(none)');
  } else {
    for (var k = 0; k < args.lessonsLoaded.length; k++) {
      sections.push('- ' + args.lessonsLoaded[k]);
    }
  }

  sections.push('');

  var content = frontmatter + '\n' + sections.join('\n');
  var filePath = path.join(brainPath, 'working-memory', 'task-completion-' + taskId + '.md');

  var success = writeFile(filePath, content);
  if (!success) {
    throw new Error('Failed to write task-completion record: ' + filePath);
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// Step 5: Append activity row
// ---------------------------------------------------------------------------

function appendActivityRow(brainPath, args) {
  var activityPath = path.join(brainPath, 'progress', 'activity.md');
  var timestamp = args.now.toISOString();
  var desc = args.shortDescription || args.taskDescription || args.taskId;
  var filesCount = args.filesChanged.length;
  var sinapsesCount = args.sinapsesLoaded.length;

  var row = '| ' + timestamp + ' | ' + args.taskId + ' | ' + desc +
    ' | ' + args.model + ' | ' + args.status + ' | ' + filesCount +
    ' | ' + sinapsesCount + ' |';

  var existing = readFile(activityPath);
  if (existing === null) {
    // Create the file with header
    var header = [
      '# Brain Activity Log',
      '<!-- Auto-appended by brain-task Step 5 after each task. Used by brain-consolidate to batch sinapse updates. -->',
      '<!-- consolidation-checkpoint: (updated by brain-consolidate after each cycle) -->',
      '',
      '| timestamp | task_id | description | model | status | files | sinapses |',
      '|-----------|---------|-------------|-------|--------|-------|----------|',
      row,
      ''
    ].join('\n');
    var ok1 = writeFile(activityPath, header);
    if (!ok1) {
      throw new Error('Failed to create activity.md: ' + activityPath);
    }
  } else {
    // Append row — O(1), no full-file rewrite
    try {
      var suffix = existing.endsWith('\n') ? '' : '\n';
      fs.appendFileSync(activityPath, suffix + row + '\n', 'utf-8');
    } catch (_) {
      throw new Error('Failed to append to activity.md: ' + activityPath);
    }
  }

  return activityPath;
}

// ---------------------------------------------------------------------------
// Step 6.2: Archive context artifacts
// ---------------------------------------------------------------------------

function archiveContextArtifacts(brainPath, args) {
  var taskId = args.taskId;
  var model = args.model;
  var wmDir = path.join(brainPath, 'working-memory');
  var archiveDir = path.join(brainPath, 'progress', 'completed-contexts');

  // Map of source filename -> destination filename
  var fileMap = [
    {
      from: 'context-packet-' + taskId + '.md',
      to: taskId + '-context-packet.md'
    },
    {
      from: model + '-context-' + taskId + '.md',
      to: taskId + '-' + model + '-context.md'
    },
    {
      from: 'codex-review-' + taskId + '.md',
      to: 'codex-review-' + taskId + '.md'
    },
    {
      from: 'implementation-plan-' + taskId + '.md',
      to: taskId + '-implementation-plan.md'
    }
  ];

  var archived = [];

  for (var i = 0; i < fileMap.length; i++) {
    var entry = fileMap[i];
    var srcPath = path.join(wmDir, entry.from);
    var dstPath = path.join(archiveDir, entry.to);

    if (!fs.existsSync(srcPath)) {
      diag('Archive skip (not found): ' + entry.from);
      continue;
    }

    try {
      // Ensure archive dir exists
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      fs.renameSync(srcPath, dstPath);
      archived.push({ from: srcPath, to: dstPath });
      diag('Archived: ' + entry.from + ' -> ' + entry.to);
    } catch (err) {
      diag('Archive failed for ' + entry.from + ': ' + err.message);
      // Graceful: skip, do not error
    }
  }

  return archived;
}

// ---------------------------------------------------------------------------
// Step 6.4: Count tasks since last consolidation
// ---------------------------------------------------------------------------

function countTasksSinceConsolidation(brainPath) {
  var activityPath = path.join(brainPath, 'progress', 'activity.md');
  var content = readFile(activityPath);
  if (!content) {
    return 0;
  }

  // Find the last consolidation-checkpoint marker
  var checkpointPattern = /<!-- consolidation-checkpoint:/g;
  var lastIdx = -1;
  var match;
  while ((match = checkpointPattern.exec(content)) !== null) {
    lastIdx = match.index;
  }

  // Get content after the last checkpoint (or all content if no checkpoint)
  var searchArea = lastIdx >= 0
    ? content.substring(lastIdx)
    : content;

  // Count pipe-delimited rows (lines starting with |, excluding header rows)
  var lines = searchArea.split('\n');
  var count = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    // A data row starts with | and is not the header separator (|---|) or header (| timestamp |)
    if (line.charAt(0) === '|' &&
        line.indexOf('---') === -1 &&
        line.indexOf('timestamp') === -1) {
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Lesson trigger computation
// ---------------------------------------------------------------------------

function computeLessonTrigger(status, brainState, taskId) {
  var attempts = 0;
  if (brainState && brainState.strategy_rotation && brainState.strategy_rotation.attempts) {
    // Only count attempts for the CURRENT task — stale attempts from a previous task must not trigger
    if (brainState.strategy_rotation.task_id === taskId) {
      attempts = brainState.strategy_rotation.attempts.length || 0;
    }
  }
  if (attempts >= 2) return 'full';    // struggled (success or failure) — rich context available
  if (status === 'failure') return 'draft';  // simple failure — raw data only
  return null;                               // clean success — no episode
}

// ---------------------------------------------------------------------------
// Step 6.5: Circuit breaker state computation
// ---------------------------------------------------------------------------

function computeCircuitBreakerNextState(currentCB, status, now, config) {
  var cb = {
    state: (currentCB && currentCB.state) || 'closed',
    failure_count: (currentCB && currentCB.failure_count) || 0,
    last_failure_at: (currentCB && currentCB.last_failure_at) || null,
    cooldown_until: (currentCB && currentCB.cooldown_until) || null
  };

  var failureThreshold = (config && config.failure_threshold) || 3;
  var cooldownSeconds = (config && config.cooldown_seconds) || 300;
  var windowSeconds = (config && config.window_seconds) || 600;

  var message = null;

  if (status === 'success') {
    // Success resets the breaker
    cb.state = 'closed';
    cb.failure_count = 0;
    cb.last_failure_at = null;
    cb.cooldown_until = null;
  } else {
    // Failure
    // Check if previous failure was outside the window — if so, reset count first
    if (currentCB && currentCB.last_failure_at) {
      var lastFailureTime = new Date(currentCB.last_failure_at).getTime();
      var elapsed = (now.getTime() - lastFailureTime) / 1000;
      if (elapsed > windowSeconds) {
        cb.failure_count = 0;
      }
    }

    cb.failure_count += 1;
    cb.last_failure_at = now.toISOString();

    if (cb.state === 'half-open') {
      // Probe failed, re-open
      cb.state = 'open';
      cb.cooldown_until = new Date(now.getTime() + cooldownSeconds * 1000).toISOString();
      message = 'CIRCUIT BREAKER RE-OPENED: Probe task failed. Cooldown extended.';
    } else if (cb.failure_count >= failureThreshold) {
      cb.state = 'open';
      cb.cooldown_until = new Date(now.getTime() + cooldownSeconds * 1000).toISOString();
      message = 'CIRCUIT BREAKER OPENED: ' + failureThreshold +
        ' consecutive failures in ' + Math.floor(windowSeconds / 60) +
        ' min. Pipeline blocked for ' + Math.floor(cooldownSeconds / 60) + ' min.';
    }
  }

  return { state: cb, message: message };
}

// ---------------------------------------------------------------------------
// State updates
// ---------------------------------------------------------------------------

function updateBrainState(brainPath, args) {
  var statePath = path.join(brainPath, 'working-memory', 'brain-state.json');
  var state = readJSON(statePath) || {
    session_id: null,
    started_at: null,
    last_task_id: null,
    current_pipeline_step: 0,
    tasks_completed_this_session: 0,
    tasks_since_consolidate: 0,
    consecutive_failures: 0,
    strategy_rotation: { task_id: null, current_strategy: 0, attempts: [] },
    context_pressure: 'low',
    active_context_files: [],
    subagents_dispatched: [],
    snapshot_reason: null
  };

  // Reset pipeline, increment tasks completed, clear context
  state.current_pipeline_step = 0;
  state.tasks_completed_this_session = (state.tasks_completed_this_session || 0) + 1;
  state.active_context_files = [];
  state.last_task_id = args.taskId;

  // Increment session-level tasks_since_consolidate
  state.tasks_since_consolidate = (state.tasks_since_consolidate || 0) + 1;

  // Update consecutive failures
  if (args.status === 'success') {
    state.consecutive_failures = 0;
  } else {
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
  }

  state.snapshot_reason = 'pipeline complete, state reset';

  var success = writeJSON(statePath, state);
  if (!success) {
    throw new Error('Failed to update brain-state.json');
  }
}

function updateProjectState(brainPath, args, cbResult) {
  var projectStatePath = path.join(brainPath, 'progress', 'brain-project-state.json');
  var projectState = readJSON(projectStatePath) || {
    version: '0.7.0',
    total_tasks_completed: 0,
    total_consolidation_cycles: 0,
    last_consolidation_at: null,
    tasks_since_last_consolidation: 0,
    model_usage: { haiku: 0, sonnet: 0, codex: 0, opus: 0 },
    subagent_usage: { dispatched: 0, succeeded: 0, failed_with_fallback: 0, by_model: {} },
    escalation_velocity: 0.0,
    avg_task_tokens: 0,
    circuit_breaker: { state: 'closed', failure_count: 0, last_failure_at: null, cooldown_until: null }
  };

  // Increment counters
  projectState.total_tasks_completed = (projectState.total_tasks_completed || 0) + 1;
  projectState.tasks_since_last_consolidation = (projectState.tasks_since_last_consolidation || 0) + 1;

  // Increment model usage
  if (!projectState.model_usage) {
    projectState.model_usage = { haiku: 0, sonnet: 0, codex: 0, opus: 0 };
  }
  projectState.model_usage[args.model] = (projectState.model_usage[args.model] || 0) + 1;

  // Update circuit breaker
  projectState.circuit_breaker = cbResult.state;

  var success = writeJSON(projectStatePath, projectState);
  if (!success) {
    throw new Error('Failed to update brain-project-state.json');
  }

  return projectState;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(argv) {
  // Parse arguments
  var result = parseArgs(argv || process.argv.slice(2));
  if (result.errors.length > 0) {
    diag('Invalid arguments:');
    for (var i = 0; i < result.errors.length; i++) {
      diag('  - ' + result.errors[i]);
    }
    process.exitCode = 2;
    return { error: 'Invalid arguments', details: result.errors };
  }

  var args = result.args;
  var brainPath = args.brainPath;

  try {
    // Step 4: Write task-completion record
    diag('Step 4: Writing task-completion record...');
    var taskCompletionFile = writeTaskCompletionRecord(brainPath, args);
    diag('  -> ' + taskCompletionFile);

    // Step 5: Append activity row
    diag('Step 5: Appending activity row...');
    appendActivityRow(brainPath, args);
    diag('  -> activity.md updated');

    // Step 6.2: Archive context artifacts
    diag('Step 6.2: Archiving context artifacts...');
    var archivedFiles = archiveContextArtifacts(brainPath, args);
    diag('  -> ' + archivedFiles.length + ' files archived');

    // Step 6.4: Consolidation check
    diag('Step 6.4: Checking consolidation status...');
    var tasksSinceConsolidation = countTasksSinceConsolidation(brainPath);
    var consolidationNeeded = tasksSinceConsolidation >= 5;
    if (consolidationNeeded) {
      diag('  -> BRAIN: ' + tasksSinceConsolidation + ' tasks accumulated -- run /brain-consolidate');
    } else {
      diag('  -> ' + tasksSinceConsolidation + ' tasks since last consolidation');
    }

    // Step 6.5: Circuit breaker update
    diag('Step 6.5: Updating circuit breaker...');
    var projectStatePath = path.join(brainPath, 'progress', 'brain-project-state.json');
    var projectState = readJSON(projectStatePath) || {};
    var currentCB = projectState.circuit_breaker || {
      state: 'closed', failure_count: 0, last_failure_at: null, cooldown_until: null
    };

    // Read circuit breaker config
    var brainConfig = readJSON(path.join(brainPath, 'brain.config.json'));
    var cbConfig = (brainConfig && brainConfig.resilience && brainConfig.resilience.circuit_breaker) || {};

    var cbResult = computeCircuitBreakerNextState(currentCB, args.status, args.now, cbConfig);
    if (cbResult.message) {
      diag('  -> ' + cbResult.message);
    }
    diag('  -> circuit_breaker.state=' + cbResult.state.state + ', failure_count=' + cbResult.state.failure_count);

    // Lesson trigger — read brain state BEFORE updateBrainState() modifies it
    var brainStateForLesson = readJSON(path.join(brainPath, 'working-memory', 'brain-state.json')) || {};
    var lessonTrigger = computeLessonTrigger(args.status, brainStateForLesson, args.taskId);
    var lessonContext = null;
    if (lessonTrigger) {
      var attempts = (brainStateForLesson.strategy_rotation && brainStateForLesson.strategy_rotation.attempts) || [];
      lessonContext = {
        error_summary: attempts.length > 0 ? (attempts[attempts.length - 1].error || '') : '',
        strategies_tried: attempts.map(function(a) { return a.strategy || ''; }),
        consecutive_failures: brainStateForLesson.consecutive_failures || 0
      };
    }

    // Update state files
    diag('Updating brain-state.json...');
    updateBrainState(brainPath, args);

    diag('Updating brain-project-state.json...');
    updateProjectState(brainPath, args, cbResult);

    // Build output
    var output = {
      task_completion_file: taskCompletionFile,
      archived_files: archivedFiles,
      consolidation_needed: consolidationNeeded,
      tasks_since_consolidation: tasksSinceConsolidation,
      circuit_breaker_state: cbResult.state,
      lesson_trigger: lessonTrigger,
      lesson_context: lessonContext
    };

    if (cbResult.message) {
      output.circuit_breaker_message = cbResult.message;
    }

    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    return output;

  } catch (err) {
    diag('Error: ' + err.message);
    process.exitCode = 3;
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Module exports (for testing) + CLI entry point
// ---------------------------------------------------------------------------

module.exports = {
  parseArgs: parseArgs,
  writeTaskCompletionRecord: writeTaskCompletionRecord,
  appendActivityRow: appendActivityRow,
  archiveContextArtifacts: archiveContextArtifacts,
  countTasksSinceConsolidation: countTasksSinceConsolidation,
  computeCircuitBreakerNextState: computeCircuitBreakerNextState,
  computeLessonTrigger: computeLessonTrigger,
  main: main
};

if (require.main === module) {
  main();
}
