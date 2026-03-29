#!/usr/bin/env node
/**
 * brain-migrate-lessons.js — One-time migration: lessons → sinapse ## Lessons Learned
 *
 * Reads lesson markdown files from cortex/<domain>/lessons/ and lessons/,
 * merges their Rule content into the target sinapse's ## Lessons Learned section.
 *
 * Usage: node scripts/brain-migrate-lessons.js --brain-path .brain/
 * Exit:  0=success, 1=error, 2=no lessons to migrate
 *
 * Pure Node.js — zero npm dependencies.
 */

'use strict';

var fs = require('fs');
var path = require('path');

function main() {
  var brainPath = null;
  for (var i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--brain-path' && process.argv[i + 1]) {
      brainPath = process.argv[i + 1];
      break;
    }
  }

  if (!brainPath) {
    process.stderr.write('Usage: node scripts/brain-migrate-lessons.js --brain-path .brain/\n');
    process.exit(1);
  }

  var absPath = path.resolve(brainPath);

  // Find all lesson files across cortex and lessons directories
  var lessonDirs = [];
  var cortexDir = path.join(absPath, 'cortex');
  if (fs.existsSync(cortexDir)) {
    var regions = fs.readdirSync(cortexDir);
    for (var r = 0; r < regions.length; r++) {
      var lessonsDir = path.join(cortexDir, regions[r], 'lessons');
      if (fs.existsSync(lessonsDir)) lessonDirs.push(lessonsDir);
    }
  }
  var crossDomain = path.join(absPath, 'lessons', 'cross-domain');
  if (fs.existsSync(crossDomain)) lessonDirs.push(crossDomain);
  var inbox = path.join(absPath, 'lessons', 'inbox');
  if (fs.existsSync(inbox)) lessonDirs.push(inbox);

  // Collect all lesson files
  var lessonFiles = [];
  for (var d = 0; d < lessonDirs.length; d++) {
    var files = fs.readdirSync(lessonDirs[d]).filter(function(f) {
      return f.startsWith('lesson-') && f.endsWith('.md');
    });
    for (var f = 0; f < files.length; f++) {
      lessonFiles.push(path.join(lessonDirs[d], files[f]));
    }
  }

  if (lessonFiles.length === 0) {
    process.stdout.write('[brain-migrate] No lesson files found. Nothing to migrate.\n');
    process.exit(2);
  }

  process.stdout.write('[brain-migrate] Found ' + lessonFiles.length + ' lesson files to migrate.\n');

  var migrated = 0;
  var skipped = 0;

  for (var l = 0; l < lessonFiles.length; l++) {
    var content = fs.readFileSync(lessonFiles[l], 'utf-8');

    // Extract frontmatter fields
    var statusMatch = content.match(/status:\s*(\w+)/);
    var status = statusMatch ? statusMatch[1] : 'draft';

    // Skip archived and superseded lessons
    if (status === 'archived' || status === 'superseded') {
      skipped++;
      continue;
    }

    // Skip draft lessons unless recurrence >= 2
    var recurrenceMatch = content.match(/recurrence_count:\s*(\d+)/);
    var recurrence = recurrenceMatch ? parseInt(recurrenceMatch[1], 10) : 0;
    if (status === 'draft' && recurrence < 2) {
      skipped++;
      continue;
    }

    // Extract the Rule section
    var ruleMatch = content.match(/## Rule\n([\s\S]*?)(?=\n## |\n---|$)/);
    var rule = ruleMatch ? ruleMatch[1].trim() : null;
    if (!rule) {
      // Try to extract from ## Correct as fallback
      var correctMatch = content.match(/## Correct\n([\s\S]*?)(?=\n## |\n---|$)/);
      rule = correctMatch ? correctMatch[1].trim() : null;
    }

    if (!rule) {
      skipped++;
      continue;
    }

    // Find target sinapse
    var parentMatch = content.match(/parent_synapse:\s*"?([^"\n]+)/);
    var domainMatch = content.match(/domain:\s*(\w+)/);
    var severityMatch = content.match(/severity:\s*(\w+)/);
    var titleMatch = content.match(/title:\s*"?([^"\n]+)/);
    var idMatch = content.match(/id:\s*(lesson-\S+)/);

    var parentSinapse = parentMatch ? parentMatch[1].trim() : null;
    var domain = domainMatch ? domainMatch[1] : 'cross-domain';
    var severity = severityMatch ? severityMatch[1] : 'medium';
    var title = titleMatch ? titleMatch[1].trim() : 'Unknown lesson';
    var lessonId = idMatch ? idMatch[1] : path.basename(lessonFiles[l], '.md');

    // Find the target sinapse file
    var targetFile = null;
    if (parentSinapse) {
      // Search for sinapse file by ID in cortex AND sinapses directories
      var sinapseFiles = [];
      findFiles(path.join(absPath, 'cortex'), sinapseFiles);
      findFiles(path.join(absPath, 'sinapses'), sinapseFiles);
      for (var s = 0; s < sinapseFiles.length; s++) {
        var sc = fs.readFileSync(sinapseFiles[s], 'utf-8');
        if (sc.includes('id: ' + parentSinapse) || sc.includes('id: "' + parentSinapse + '"')) {
          targetFile = sinapseFiles[s];
          break;
        }
      }
    }

    if (!targetFile) {
      // Fallback: find any sinapse in the same domain
      var domainDir = path.join(absPath, 'cortex', domain);
      if (fs.existsSync(domainDir)) {
        var domainFiles = fs.readdirSync(domainDir).filter(function(f) {
          return f.endsWith('.md') && !f.startsWith('lesson-');
        });
        if (domainFiles.length > 0) {
          targetFile = path.join(domainDir, domainFiles[0]);
        }
      }
    }

    if (!targetFile) {
      process.stderr.write('[brain-migrate] No target sinapse found for ' + lessonId + ' (domain: ' + domain + '). Skipping.\n');
      skipped++;
      continue;
    }

    // Append to sinapse's ## Lessons Learned section
    var sinapseContent = fs.readFileSync(targetFile, 'utf-8');
    var lessonBullet = '- **migrated:** ' + rule + '\n  Severity: ' + severity + ' | From: ' + lessonId + '\n';

    if (sinapseContent.includes('## Lessons Learned')) {
      // Append to existing section
      sinapseContent = sinapseContent.replace(
        '## Lessons Learned\n',
        '## Lessons Learned\n\n' + lessonBullet
      );
    } else {
      // Create new section at end of file
      sinapseContent = sinapseContent.trimEnd() + '\n\n## Lessons Learned\n\n' + lessonBullet;
    }

    fs.writeFileSync(targetFile, sinapseContent, 'utf-8');
    migrated++;
    process.stdout.write('[brain-migrate] ' + lessonId + ' → ' + path.basename(targetFile) + '\n');
  }

  process.stdout.write('\n[brain-migrate] Done. Migrated: ' + migrated + ', Skipped: ' + skipped + '\n');
  process.stdout.write('[brain-migrate] Run `python scripts/build_brain_db.py` to rebuild brain.db (lessons table will not be created).\n');
}

function findFiles(dir, result) {
  if (!fs.existsSync(dir)) return;
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      findFiles(full, result);
    } else if (entries[i].endsWith('.md')) {
      result.push(full);
    }
  }
}

main();
