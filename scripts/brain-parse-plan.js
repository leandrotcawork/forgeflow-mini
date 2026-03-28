#!/usr/bin/env node
/**
 * brain-parse-plan.js — Parse implementation plan MD → JSON task array
 *
 * Usage: node scripts/brain-parse-plan.js <plan-file.md>
 * Output: JSON array of { task, title, fullText } to stdout
 * Exit:  0=success, 2=invalid args, 3=parse/read error
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

var fs = require('fs');
var path = require('path');

/**
 * Parse plan markdown content into a task array.
 * @param {string} content - raw markdown content of the plan file
 * @returns {{ task: number, title: string, fullText: string }[]}
 */
function parsePlan(content) {
  var tasks = [];
  var blocks = content.split(/(?=^### (?:Task \d+|Micro-Step M\d+):)/m);

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var titleMatch = block.match(/^### (?:Task (\d+)|Micro-Step M(\d+)): (.+)$/m);
    if (!titleMatch) continue;

    var taskNum = parseInt(titleMatch[1] || titleMatch[2], 10);
    var title = (titleMatch[3] || '').trim();
    var fullText = block.trim();

    tasks.push({ task: taskNum, title: title, fullText: fullText });
  }

  return tasks;
}

function main() {
  var filePath = process.argv[2];

  if (!filePath) {
    process.stderr.write('Usage: node scripts/brain-parse-plan.js <plan-file.md>\n');
    process.stderr.write('Output: JSON array of tasks to stdout\n');
    process.exit(2);
  }

  var absPath = path.resolve(filePath);

  var content;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch (err) {
    process.stderr.write('[brain-parse-plan] Error reading file: ' + err.message + '\n');
    process.exit(3);
  }

  try {
    var tasks = parsePlan(content);
    process.stdout.write(JSON.stringify(tasks, null, 2) + '\n');
  } catch (err) {
    process.stderr.write('[brain-parse-plan] Error parsing plan: ' + err.message + '\n');
    process.exit(3);
  }
}

module.exports = { parsePlan: parsePlan };

if (require.main === module) {
  main();
}
