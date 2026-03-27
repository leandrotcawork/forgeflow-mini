'use strict';

const { parsePlan } = require('../scripts/brain-parse-plan.js');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('parsePlan', function () {

  it('returns empty array for content with no task headers', function () {
    const result = parsePlan('# Just a header\n\nSome text.');
    assert.deepStrictEqual(result, []);
  });

  it('parses a single task with title, files, and steps', function () {
    const md = `
### Task 1: Fix Something

**Files:**
- Create: \`src/foo.js\`
- Test: \`tests/foo.test.js\`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Implement the fix**
- [ ] **Step 3: Commit**
`;
    const result = parsePlan(md);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].task, 1);
    assert.strictEqual(result[0].title, 'Fix Something');
    assert.strictEqual(result[0].files.length, 2);
    assert.strictEqual(result[0].files[0].action, 'create');
    assert.strictEqual(result[0].files[0].path, 'src/foo.js');
    assert.strictEqual(result[0].files[1].action, 'test');
    assert.strictEqual(result[0].steps.length, 3);
    assert.strictEqual(result[0].steps[0], 'Step 1: Write the failing test');
    assert.strictEqual(result[0].steps[2], 'Step 3: Commit');
  });

  it('parses multiple tasks independently', function () {
    const md = `
### Task 1: First

**Files:**
- Create: \`a.js\`

- [ ] **Step 1: Do A**

### Task 2: Second

**Files:**
- Modify: \`b.js\`

- [ ] **Step 1: Do B**
- [ ] **Step 2: Commit**
`;
    const result = parsePlan(md);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].task, 1);
    assert.strictEqual(result[0].title, 'First');
    assert.strictEqual(result[0].files[0].action, 'create');
    assert.strictEqual(result[1].task, 2);
    assert.strictEqual(result[1].title, 'Second');
    assert.strictEqual(result[1].files[0].action, 'modify');
    assert.strictEqual(result[1].steps.length, 2);
  });

  it('returns empty files array when no Files section present', function () {
    const md = `
### Task 1: No Files

- [ ] **Step 1: Just a step**
`;
    const result = parsePlan(md);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].files, []);
  });

  it('returns empty steps array when no checkbox steps present', function () {
    const md = `
### Task 1: No Steps

**Files:**
- Create: \`x.js\`
`;
    const result = parsePlan(md);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].steps, []);
  });

  it('handles Modify file action correctly', function () {
    const md = `
### Task 1: Modifies

**Files:**
- Modify: \`src/existing.js:10-20\`

- [ ] **Step 1: Edit the file**
`;
    const result = parsePlan(md);
    assert.strictEqual(result[0].files[0].action, 'modify');
    assert.strictEqual(result[0].files[0].path, 'src/existing.js:10-20');
  });

  it('task numbers are parsed as integers, not strings', function () {
    const md = `
### Task 42: Big Number

- [ ] **Step 1: Do it**
`;
    const result = parsePlan(md);
    assert.strictEqual(typeof result[0].task, 'number');
    assert.strictEqual(result[0].task, 42);
  });

});
