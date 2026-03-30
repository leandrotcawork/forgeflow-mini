#!/usr/bin/env node

/**
 * ForgeFlow Mini — Central Hook Runner
 *
 * Inspired by ECC's run-with-flags.js pattern.
 * Reads JSON from stdin (Claude Code tool context), dispatches to the
 * appropriate hook handler, and prints a JSON result to stdout.
 *
 * Environment variables:
 *   BRAIN_HOOK_PROFILE    — "minimal" (tier 1), "standard" (tier 1+2, default), "strict" (all)
 *   BRAIN_DISABLED_HOOKS  — comma-separated hook names to skip
 *
 * Usage:
 *   echo '{"tool_name":"Write","file_path":"src/foo.js"}' | node hooks/brain-hooks.js <hookName>
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the .brain directory relative to cwd.
 */
function brainRoot() {
  return path.join(process.cwd(), '.brain');
}

/**
 * Safely read and parse a JSON file. Returns null on any failure.
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Safely write a JSON file, creating parent directories as needed.
 */
function writeJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Path to brain-state.json.
 */
function brainStatePath() {
  return path.join(brainRoot(), 'working-memory', 'brain-state.json');
}

/**
 * Path to brain.config.json.
 */
function brainConfigPath() {
  return path.join(brainRoot(), 'brain.config.json');
}

/**
 * Build a "continue" result.
 */
function ok(extra) {
  return Object.assign({ continue: true }, extra || {});
}

/**
 * Build a "block" result.
 */
function block(reason) {
  return { decision: 'block', reason: reason };
}

// ---------------------------------------------------------------------------
// Tier 1 — minimal
// ---------------------------------------------------------------------------

/**
 * stateRestore — reads brain-state.json and outputs a BRAIN_STATE summary
 * as additionalContext so Claude sees it at session start.
 */
function stateRestore(/* input */) {
  const state = readJSON(brainStatePath());
  if (!state) {
    return ok({ additionalContext: 'BRAIN_STATE: No prior state found (fresh session).' });
  }

  const lines = [
    'BRAIN_STATE summary:',
    '  session_id:              ' + (state.session_id || 'none'),
    '  current_skill:           ' + (state.current_skill || 'none'),
    '  current_pipeline_step:   ' + (state.current_pipeline_step || 0),
    '  tasks_completed:         ' + (state.tasks_completed_this_session || 0),
    '  consecutive_failures:    ' + (state.consecutive_failures || 0),
    '  context_pressure:        ' + (state.context_pressure || 'low'),
    '  tasks_since_consolidate: ' + (state.tasks_since_consolidate || 0),
  ];

  return ok({ additionalContext: lines.join('\n') });
}

/**
 * hippocampusGuard — blocks any write whose file_path touches .brain/hippocampus/.
 */
function hippocampusGuard(input) {
  var toolInput = (input && input.tool_input) || input || {};
  var filePath = (toolInput.file_path || toolInput.filePath) || '';
  // Normalise to forward slashes for cross-platform matching
  filePath = filePath.replace(/\\/g, '/');

  if (filePath.indexOf('.brain/hippocampus/') !== -1) {
    return block(
      'Hippocampus files are immutable — they can only be changed via /brain-consolidate with developer approval.'
    );
  }
  return ok();
}

/**
 * routingGuard — enforces that router skills (brain-dev, brain-consult)
 * can only write to their allowlisted files. All other writes are blocked.
 *
 * Allowlist when current_skill is "brain-dev" or "brain-consult":
 *   - .brain/working-memory/dev-context-*.md
 *   - .brain/working-memory/brain-state.json
 *   - .brain/working-memory/consult-*.json
 *   - .brain/progress/consult-log.md
 *
 * If current_skill is null, missing, or any other skill → ALLOW all writes.
 */
function routingGuard(input) {
  var state = readJSON(brainStatePath());
  var currentSkill = state && state.current_skill;

  // No state, null skill, or non-router skill → allow
  if (!currentSkill) return ok();
  if (currentSkill !== 'brain-dev' && currentSkill !== 'brain-consult') return ok();

  var toolInput = (input && input.tool_input) || input || {};
  var filePath = (toolInput.file_path || toolInput.filePath) || '';
  // Normalise to forward slashes for cross-platform matching
  filePath = filePath.replace(/\\/g, '/');

  // Allowlist patterns
  if (filePath.indexOf('.brain/working-memory/dev-context-') !== -1) return ok();
  if (filePath.indexOf('.brain/working-memory/brain-state.json') !== -1) return ok();
  if (filePath.indexOf('.brain/working-memory/consult-') !== -1 && filePath.endsWith('.json')) return ok();
  if (filePath.indexOf('.brain/working-memory/episode-consult-') !== -1 && filePath.endsWith('.md')) return ok();
  if (filePath.indexOf('.brain/progress/consult-log.md') !== -1) return ok();

  return block(
    'brain-routing-guard: ' + currentSkill + ' is a router, not a worker. ' +
    'Blocked write to: ' + filePath + '. ' +
    'Route to brain-plan (planning) or brain-task (implementation).'
  );
}

/**
 * configProtection — blocks writes to linter/formatter config files when the
 * change REMOVES rules or WEAKENS severity (error -> warn/off, warn -> off).
 */
function configProtection(input) {
  var toolInput = (input && input.tool_input) || input || {};
  var filePath = (toolInput.file_path || toolInput.filePath) || '';
  var basename = path.basename(filePath);

  var protectedFiles = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.prettierrc', '.prettierrc.json', 'biome.json', 'tsconfig.json'];
  var match = protectedFiles.some(function (f) {
    return basename === f || basename.startsWith(f);
  });
  if (!match) return ok();

  var content = (toolInput.content) || '';
  if (!content) return ok();

  // Heuristic: look for patterns that weaken config
  var weakenPatterns = [
    /"error"\s*:\s*"(warn|off)"/,
    /"warn"\s*:\s*"off"/,
    /"severity"\s*:\s*"(warn|off)"/,
    /"rules"\s*:\s*\{\s*\}/,
  ];

  // Also check if rules were removed entirely (content is shorter and has fewer rule keys)
  // This is a best-effort heuristic, not a full AST comparison.
  for (var i = 0; i < weakenPatterns.length; i++) {
    if (weakenPatterns[i].test(content)) {
      return block(
        'Config change to ' + basename + ' appears to REMOVE rules or WEAKEN severity. ' +
        'If intentional, disable the configProtection hook via BRAIN_DISABLED_HOOKS=configProtection.'
      );
    }
  }

  return ok();
}

/**
 * Path to brain-project-state.json.
 */
function brainProjectStatePath() {
  return path.join(brainRoot(), 'progress', 'brain-project-state.json');
}

/**
 * circuitBreakerCheck — reads brain-project-state.json and checks the
 * circuit breaker state before allowing tool execution.
 */
function circuitBreakerCheck(/* input */) {
  var projectState = readJSON(brainProjectStatePath());
  if (!projectState) return ok();

  var cb = projectState.circuit_breaker;
  if (!cb || !cb.state) return ok();

  if (cb.state === 'closed') return ok();

  if (cb.state === 'open') {
    var now = new Date().toISOString();
    if (cb.cooldown_until && now < cb.cooldown_until) {
      return block(
        'CIRCUIT BREAKER OPEN: Pipeline blocked until ' + cb.cooldown_until +
        '. Reason: ' + (cb.failure_count || 0) + ' consecutive failures. ' +
        'Try a different approach or wait for cooldown. Episodes are auto-captured.'
      );
    }
    // Cooldown expired — transition to half-open
    return ok({
      additionalContext:
        'CIRCUIT BREAKER: Cooldown expired. Transitioning to HALF-OPEN. ' +
        'This execution is a probe — if it succeeds the breaker will close, ' +
        'if it fails the breaker will re-open with a longer cooldown.',
    });
  }

  if (cb.state === 'half-open') {
    return ok({
      additionalContext:
        'CIRCUIT BREAKER HALF-OPEN: This execution is a probe task. ' +
        'Success will close the breaker; failure will re-open it.',
    });
  }

  // Unknown state — never block on unexpected data
  return ok();
}

/**
 * pruneConsultAuditFiles — deletes stale consult-*.json files from the
 * working-memory directory based on age (TTL) and a maximum file cap.
 *
 * Returns { deleted_for_ttl, deleted_for_cap, remaining }.
 */
function pruneConsultAuditFiles(wmDir, nowIso, maxAgeDays, maxFiles) {
  var result = { deleted_for_ttl: 0, deleted_for_cap: 0, remaining: 0 };
  var entries;
  try {
    entries = fs.readdirSync(wmDir);
  } catch {
    // Missing directory — no-op
    return result;
  }

  var consultFiles = entries.filter(function (f) {
    return f.startsWith('consult-') && f.endsWith('.json');
  });

  var nowMs = new Date(nowIso).getTime();
  var maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // Gather mtime info
  var fileInfos = [];
  for (var i = 0; i < consultFiles.length; i++) {
    var fullPath = path.join(wmDir, consultFiles[i]);
    try {
      var stat = fs.statSync(fullPath);
      fileInfos.push({ name: consultFiles[i], path: fullPath, mtime: stat.mtimeMs });
    } catch {
      // skip files we can't stat
    }
  }

  // Phase 1: delete files older than maxAgeDays
  var remaining = [];
  for (var j = 0; j < fileInfos.length; j++) {
    var ageMs = nowMs - fileInfos[j].mtime;
    if (ageMs > maxAgeMs) {
      try {
        fs.unlinkSync(fileInfos[j].path);
        result.deleted_for_ttl++;
      } catch {
        // If delete fails, keep in remaining
        remaining.push(fileInfos[j]);
      }
    } else {
      remaining.push(fileInfos[j]);
    }
  }

  // Phase 2: if remaining > maxFiles, sort by mtime ascending and delete oldest
  if (remaining.length > maxFiles) {
    remaining.sort(function (a, b) { return a.mtime - b.mtime; });
    var toDelete = remaining.length - maxFiles;
    var survivors = [];
    for (var k = 0; k < remaining.length; k++) {
      if (k < toDelete) {
        try {
          fs.unlinkSync(remaining[k].path);
          result.deleted_for_cap++;
        } catch {
          // Delete failed — keep in survivors so remaining count is accurate
          survivors.push(remaining[k]);
        }
      } else {
        survivors.push(remaining[k]);
      }
    }
    remaining = survivors;
  }

  result.remaining = remaining.length;
  return result;
}

/**
 * sessionEnd — writes brain-state.json to disk with current timestamp.
 */
function sessionEnd(/* input */) {
  var state = readJSON(brainStatePath()) || {
    session_id: null,
    current_skill: null,
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
    snapshot_reason: null,
  };

  state.current_skill = null;
  state.snapshot_reason = 'session_end';
  state.ended_at = new Date().toISOString();

  writeJSON(brainStatePath(), state);

  // Prune stale consult audit files (failure must never block session end)
  var pruneResult = { deleted_for_ttl: 0, deleted_for_cap: 0, remaining: 0 };
  var episodesSwept;
  var wmDir = path.join(brainRoot(), 'working-memory');
  try {
    pruneResult = pruneConsultAuditFiles(wmDir, state.ended_at, 7, 50);
  } catch {
    // Never block session end on cleanup failure
  }

  // Sweep stale episode files (30-day TTL)
  try {
    var episodeFiles = fs.readdirSync(wmDir).filter(function(f) { return f.startsWith('episode-') && f.endsWith('.md'); });
    var thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    episodesSwept = 0;
    for (var i = 0; i < episodeFiles.length; i++) {
      var epPath = path.join(wmDir, episodeFiles[i]);
      var stat = fs.statSync(epPath);
      if (Date.now() - stat.mtimeMs > thirtyDaysMs) {
        fs.unlinkSync(epPath);
        episodesSwept++;
      }
    }
  } catch {
    // Never block session end on cleanup failure
  }

  return ok({
    reason: 'brain-state.json saved at session end.',
    consult_cleanup: pruneResult,
    episodes_swept: episodesSwept || 0,
  });
}

// ---------------------------------------------------------------------------
// Tier 2 — standard
// ---------------------------------------------------------------------------

/**
 * strategyRotation — if consecutive_failures >= 2, suggest rotating strategy.
 */
function strategyRotation(/* input */) {
  var state = readJSON(brainStatePath());
  if (!state) return ok();

  var failures = state.consecutive_failures || 0;
  if (failures < 2) return ok();

  var strategyIndex = (state.strategy_rotation && state.strategy_rotation.current_strategy) || 0;
  var strategies = [
    'Try a different algorithmic approach (e.g. iterative instead of recursive).',
    'Simplify: break the task into smaller sub-tasks and solve them individually.',
    'Search for existing patterns in the codebase — the solution may already exist.',
    'Step back: re-read the requirements and hippocampus/conventions.md.',
  ];
  var advice = strategies[strategyIndex % strategies.length];

  return ok({
    additionalContext:
      'STRATEGY ROTATION ADVICE (' + failures + ' consecutive failures):\n' +
      advice + '\n' +
      'Episode will be auto-captured when this task completes.',
  });
}

/**
 * qualityGate — after a file write, check if the file has an associated
 * linter command defined in brain.config.json.
 */
function qualityGate(input) {
  var toolInput = (input && input.tool_input) || input || {};
  var filePath = (toolInput.file_path || toolInput.filePath) || '';
  if (!filePath) return ok();

  var config = readJSON(brainConfigPath());
  if (!config) return ok();

  // brain.config.json may include a "linters" map (extension -> command)
  // This is an optional field; if absent, we silently continue.
  var linters = config.linters;
  if (!linters || typeof linters !== 'object') return ok();

  var ext = path.extname(filePath).toLowerCase();
  if (ext && linters[ext]) {
    return ok({
      additionalContext:
        'QUALITY GATE: File ' + path.basename(filePath) +
        ' has an associated linter. Consider running: ' + linters[ext],
    });
  }

  return ok();
}

/**
 * taskSafetyNet — if current_pipeline_step > 3 but no task-completion file
 * exists, warn about potential stalled task.
 */
function taskSafetyNet(/* input */) {
  var state = readJSON(brainStatePath());
  if (!state) return ok();

  var step = state.current_pipeline_step || 0;
  if (step <= 3) return ok();

  // Check for task-completion marker — look in working-memory for any file
  // whose name starts with "task-completion"
  var wmDir = path.join(brainRoot(), 'working-memory');
  try {
    var files = fs.readdirSync(wmDir);
    var hasCompletion = files.some(function (f) {
      return f.startsWith('task-completion');
    });
    if (hasCompletion) return ok();
  } catch {
    // working-memory dir may not exist yet
    return ok();
  }

  return ok({
    additionalContext:
      'SAFETY NET WARNING: Pipeline step is ' + step +
      ' but no task-completion file found in working-memory/. ' +
      'The current task may be stalled. Consider running /brain-status.',
  });
}

// ---------------------------------------------------------------------------
// Tier 3 — strict
// ---------------------------------------------------------------------------

/**
 * activityObserver — appends the modified file path to
 * .brain/working-memory/modified-files.json.
 */
function activityObserver(input) {
  var toolInput = (input && input.tool_input) || input || {};
  var filePath = (toolInput.file_path || toolInput.filePath) || '';
  if (!filePath) return ok();

  var modifiedFilesPath = path.join(brainRoot(), 'working-memory', 'modified-files.json');
  var existing = readJSON(modifiedFilesPath) || { files: [], updated_at: null };

  // Normalize to relative path from cwd
  var relative = filePath;
  try {
    relative = path.relative(process.cwd(), filePath);
  } catch {
    // keep as-is
  }

  if (existing.files.indexOf(relative) === -1) {
    existing.files.push(relative);
  }
  existing.updated_at = new Date().toISOString();

  writeJSON(modifiedFilesPath, existing);
  return ok();
}

// ---------------------------------------------------------------------------
// Hook registry and tier mapping
// ---------------------------------------------------------------------------

var HOOKS = {
  stateRestore:      { fn: stateRestore,      tier: 1 },
  hippocampusGuard:  { fn: hippocampusGuard,   tier: 1 },
  routingGuard:      { fn: routingGuard,       tier: 1 },
  configProtection:      { fn: configProtection,      tier: 1 },
  circuitBreakerCheck:   { fn: circuitBreakerCheck,    tier: 1 },
  sessionEnd:            { fn: sessionEnd,             tier: 1 },
  strategyRotation:  { fn: strategyRotation,   tier: 2 },
  qualityGate:       { fn: qualityGate,        tier: 2 },
  taskSafetyNet:     { fn: taskSafetyNet,      tier: 2 },
  activityObserver:  { fn: activityObserver,    tier: 3 },
};

var PROFILES = {
  minimal:  1,
  standard: 2,
  strict:   3,
};

// ---------------------------------------------------------------------------
// Main — read stdin JSON, dispatch hook, write stdout JSON
// ---------------------------------------------------------------------------

function main() {
  var hookName = process.argv[2];
  if (!hookName) {
    process.stdout.write(JSON.stringify(block('brain-hooks: no hook name provided as argument')) + '\n');
    process.exit(1);
  }

  // Resolve profile
  var profileName = (process.env.BRAIN_HOOK_PROFILE || 'standard').toLowerCase();
  var maxTier = PROFILES[profileName];
  if (maxTier === undefined) {
    maxTier = PROFILES.standard;
  }

  // Check disabled hooks
  var disabledRaw = process.env.BRAIN_DISABLED_HOOKS || '';
  var disabled = disabledRaw
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  // Validate hook exists
  var hookEntry = HOOKS[hookName];
  if (!hookEntry) {
    process.stdout.write(JSON.stringify(ok({ reason: 'Unknown hook: ' + hookName + '. Skipping.' })) + '\n');
    process.exit(0);
  }

  // Check tier eligibility
  if (hookEntry.tier > maxTier) {
    process.stdout.write(
      JSON.stringify(ok({ reason: hookName + ' skipped (tier ' + hookEntry.tier + ' > profile ' + profileName + ').' })) + '\n'
    );
    process.exit(0);
  }

  // Check disabled list
  if (disabled.indexOf(hookName) !== -1) {
    process.stdout.write(
      JSON.stringify(ok({ reason: hookName + ' disabled via BRAIN_DISABLED_HOOKS.' })) + '\n'
    );
    process.exit(0);
  }

  // Read stdin (Claude Code passes tool context as JSON)
  var chunks = [];
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', function (chunk) {
    chunks.push(chunk);
  });
  process.stdin.on('end', function () {
    var rawInput = chunks.join('');
    var input = {};
    if (rawInput.trim()) {
      try {
        input = JSON.parse(rawInput);
      } catch {
        // If stdin is not valid JSON, proceed with empty input
        input = {};
      }
    }

    try {
      var result = hookEntry.fn(input);
      process.stdout.write(JSON.stringify(result) + '\n');
      process.exit(result.decision === 'block' ? 1 : 0);
    } catch (err) {
      // Hooks must never crash — always continue on unexpected errors
      process.stdout.write(
        JSON.stringify(ok({ reason: 'Hook ' + hookName + ' threw: ' + (err.message || err) + '. Continuing safely.' })) + '\n'
      );
      process.exit(0);
    }
  });

  // Handle case where stdin is already closed (no piped input)
  process.stdin.resume();
}

// ---------------------------------------------------------------------------
// Module exports (for testing) + CLI entry point
// ---------------------------------------------------------------------------

module.exports = {
  stateRestore: stateRestore,
  hippocampusGuard: hippocampusGuard,
  routingGuard: routingGuard,
  configProtection: configProtection,
  circuitBreakerCheck: circuitBreakerCheck,
  sessionEnd: sessionEnd,
  strategyRotation: strategyRotation,
  qualityGate: qualityGate,
  taskSafetyNet: taskSafetyNet,
  activityObserver: activityObserver,
  pruneConsultAuditFiles: pruneConsultAuditFiles,
  HOOKS: HOOKS,
  PROFILES: PROFILES,
};

if (require.main === module) {
  main();
}
