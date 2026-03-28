#!/usr/bin/env node
/**
 * brain-parse-plan.js — Parse implementation plan MD → JSON task array
 *
 * Usage: node scripts/brain-parse-plan.js <plan-file.md>
 * Output: JSON array of { task, title, files, steps } to stdout
 * Exit:  0=success, 2=invalid args, 3=parse/read error
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse plan markdown content into a task array.
 * @param {string} content - raw markdown content of the plan file
 * @returns {{ task: number, title: string, files: Array<{action:string,path:string}>, steps: string[] }[]}
 */
function parsePlan(content) {
  const tasks = [];

  // Split on task headers: ### Task N: Title or ### Micro-Step MN: Title
  // Use a regex that matches at the start of a line
  const blocks = content.split(/(?=^### (?:Task \d+|Micro-Step M\d+):)/m);

  for (const block of blocks) {
    const titleMatch = block.match(/^### (?:Task (\d+)|Micro-Step M(\d+)): (.+)$/m);
    if (!titleMatch) continue;

    const taskNum = parseInt(titleMatch[1] || titleMatch[2], 10);
    const title = (titleMatch[3] || '').trim();

    // Extract files block: between **Files:** and the first checkbox or separator
    const files = [];
    const filesMatch = block.match(/\*\*Files:\*\*\n([\s\S]*?)(?=\n- \[ \]|\n---|\n### |\n## |$)/);
    if (filesMatch) {
      const fileLines = filesMatch[1].match(/- (Create|Modify|Test): `([^`]+)`/g) || [];
      for (const line of fileLines) {
        const m = line.match(/- (Create|Modify|Test): `([^`]+)`/);
        if (m) {
          files.push({ action: m[1].toLowerCase(), path: m[2] });
        }
      }
    }

    // Extract checkbox steps: lines matching - [ ] **Step N: ...**
    const stepMatches = block.match(/^- \[ \] \*\*Step \d+: [^*]+\*\*/gm) || [];

    const steps = stepMatches.map(function (s) {
      return s.replace(/^- \[ \] \*\*/, '').replace(/\*\*$/, '').trim();
    });

    tasks.push({ task: taskNum, title: title, files: files, steps: steps });
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
