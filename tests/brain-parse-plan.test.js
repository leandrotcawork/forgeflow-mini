'use strict';

var parsePlan = require('../scripts/brain-parse-plan.js').parsePlan;
var assert = require('node:assert/strict');
var test = require('node:test');

test.describe('parsePlan', function () {

  test.it('returns empty array for content with no task headers', function () {
    var result = parsePlan('# Just a header\n\nSome text.');
    assert.deepStrictEqual(result, []);
  });

  test.it('captures fullText for a single task', function () {
    var md = [
      '### Task 1: Fix Something',
      '',
      '**Files:**',
      '- Create: `src/foo.js`',
      '',
      '- [ ] **Step 1: Write the test**',
      '- [ ] **Step 2: Implement**',
      ''
    ].join('\n');
    var result = parsePlan(md);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].task, 1);
    assert.strictEqual(result[0].title, 'Fix Something');
    assert.ok(result[0].fullText.includes('**Files:**'));
    assert.ok(result[0].fullText.includes('Step 1: Write the test'));
    assert.ok(result[0].fullText.includes('src/foo.js'));
  });

  test.it('splits multiple tasks without bleeding fullText', function () {
    var md = [
      '### Task 1: First',
      '',
      'Content of task 1.',
      '',
      '### Task 2: Second',
      '',
      'Content of task 2.',
      ''
    ].join('\n');
    var result = parsePlan(md);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].title, 'First');
    assert.ok(result[0].fullText.includes('Content of task 1'));
    assert.ok(!result[0].fullText.includes('Content of task 2'));
    assert.strictEqual(result[1].title, 'Second');
    assert.ok(result[1].fullText.includes('Content of task 2'));
    assert.ok(!result[1].fullText.includes('Content of task 1'));
  });

  test.it('parses Micro-Step MN format', function () {
    var md = [
      '### Micro-Step M3: Write auth handler',
      '',
      '| File | Action |',
      '| src/auth.js | create |',
      '',
      '- [ ] Spec: test auth returns 200',
      ''
    ].join('\n');
    var result = parsePlan(md);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].task, 3);
    assert.strictEqual(result[0].title, 'Write auth handler');
    assert.ok(result[0].fullText.includes('| src/auth.js | create |'));
  });

  test.it('preserves code blocks tables and blank lines in fullText', function () {
    var md = [
      '### Task 1: Complex content',
      '',
      '```javascript',
      'function foo() { return 42; }',
      '```',
      '',
      '| Col1 | Col2 |',
      '|------|------|',
      '| a    | b    |',
      '',
      'Final paragraph.',
      ''
    ].join('\n');
    var result = parsePlan(md);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].fullText.includes('function foo() { return 42; }'));
    assert.ok(result[0].fullText.includes('| Col1 | Col2 |'));
    assert.ok(result[0].fullText.includes('Final paragraph.'));
  });

});
