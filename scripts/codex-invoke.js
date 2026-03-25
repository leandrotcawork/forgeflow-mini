#!/usr/bin/env node

/**
 * ⚠️  [STUB] — Workflow Reference Only
 *
 * This script demonstrates the intended Codex MCP invocation flow but does NOT
 * actually call any MCP server. It reads the context file, validates it, and
 * returns a placeholder response.
 *
 * In production, brain-task handles Codex invocation directly through the
 * Claude Code MCP tool interface. See: skills/brain-task/SKILL.md → Step 3.
 */

/**
 * codex-invoke.js
 *
 * Invokes Codex via MCP server (codex-cli) with prepared context
 * Called by brain-task.md Step 3 after codex-context.md is generated
 *
 * Usage:
 *   node scripts/codex-invoke.js --context-file working-memory/codex-context.md --task-id [uuid]
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      result[key] = args[i + 1];
      i++;
    }
  }

  return result;
}

// Validate context file exists and is well-formed
function validateContextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[Error] Context file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('---') || !content.includes('model: codex')) {
    throw new Error(`[Error] Context file missing YAML frontmatter or model: codex`);
  }

  return content;
}

// Extract metadata from context file
function extractMetadata(content) {
  const match = content.match(/---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('[Error] Could not parse YAML frontmatter');
  }

  const metadata = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      metadata[key.trim()] = rest.join(':').trim();
    }
  });

  return metadata;
}

// Read context file and prepare for MCP call
function prepareContext(filePath) {
  const content = validateContextFile(filePath);
  const metadata = extractMetadata(content);

  return {
    file_path: filePath,
    metadata: metadata,
    content: content,
    task_id: metadata.task_id,
    complexity_score: metadata.complexity_score,
    domain: metadata.domain,
    created_at: metadata.created_at
  };
}

// Format output message
function formatOutput(status, data) {
  const statusSymbol = status === 'success' ? '[OK]' : '[Error]';
  const timestamp = new Date().toISOString();

  console.log(`${statusSymbol} [${timestamp}] Codex Invocation`);

  if (data.task_id) {
    console.log(`  Task ID: ${data.task_id}`);
  }

  if (data.domain) {
    console.log(`  Domain: ${data.domain}`);
  }

  if (data.complexity_score) {
    console.log(`  Complexity: ${data.complexity_score}/100`);
  }

  if (data.message) {
    console.log(`  Message: ${data.message}`);
  }

  if (data.files_affected && data.files_affected.length > 0) {
    console.log(`  Files Targeted:`);
    data.files_affected.forEach(f => console.log(`    - ${f}`));
  }

  if (data.explanation) {
    console.log(`\n  Explanation:\n${data.explanation}`);
  }

  return timestamp;
}

// Main workflow
async function main() {
  try {
    const args = parseArgs();

    if (!args['context-file']) {
      throw new Error('Missing required argument: --context-file');
    }

    const contextFile = args['context-file'];
    const taskId = args['task-id'] || 'unknown';

    console.log('[Brain] Invoking Codex via MCP server...\n');

    // Step 1: Validate and prepare context
    const context = prepareContext(contextFile);

    formatOutput('prepare', {
      task_id: context.task_id,
      domain: context.domain,
      complexity_score: context.complexity_score,
      message: 'Context file validated'
    });

    console.log('\n[Brain] Calling codex-cli MCP server...');
    console.log(`  Context: ${contextFile}`);
    console.log(`  Task ID: ${context.task_id}`);
    console.log(`  Domain: ${context.domain}`);

    // Step 2: Invoke Codex via MCP
    // NOTE: This is a placeholder showing the workflow
    // In real execution, this would use the actual MCP server API

    const result = {
      status: 'success',
      task_id: context.task_id,
      domain: context.domain,
      message: 'Context prepared and ready for Codex extension',
      next_step: 'Open working-memory/codex-context.md in VSCode and invoke @context with Codex extension',
      files_affected: [
        'working-memory/codex-context.md'
      ],
      explanation: `Context file generated with:
  - Sinapses: From Tier 1+2 loaded by brain-map
  - Code examples: Real patterns from your codebase
  - Common mistakes: Extracted from conventions
  - Lessons: Domain-specific lessons loaded

Next step: Use Codex VSCode extension with @context on this file`
    };

    // Step 3: Format output
    const timestamp = formatOutput('success', result);

    // Step 4: Create response file for brain-task to read
    const responseFile = path.join(path.dirname(contextFile), 'codex-invoke-response.json');
    fs.writeFileSync(responseFile, JSON.stringify(result, null, 2));

    console.log(`\n[Brain] Response saved to: ${responseFile}`);
    console.log(`\n[Brain] Codex invocation complete at ${timestamp}`);

  } catch (error) {
    console.error(`\n[Error] ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
