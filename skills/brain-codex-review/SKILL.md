---
name: brain-codex-review
description: Codex code review agent — validates implementation, finds bugs, checks conventions
---

# brain-codex-review Skill — Codex Quality Gate

**Purpose:** Post-implementation code review by Codex. Validates implementation against conventions, tests, and patterns before brain-document stage.

**Token Budget:** 20k in / 8k out

**Trigger:** Automatic after Step 2 (Codex implement) OR manual via `/brain-codex-review`

---

## Pipeline Position

```
brain-decision → brain-map → brain-task → [brain-codex-review] → [TaskCompleted hook] → brain-document → brain-consolidate
                                           ↑ you are here
```

---

## When Codex Reviews (Step 3.5)

After Codex completes implementation (Step 3), run automatic review:

```
Step 3: Codex executes implementation
        ↓
Step 3.5: brain-codex-review runs automatically (Codex path only)
        ├─ Check: conventions followed
        ├─ Check: tests passing
        ├─ Check: no obvious bugs
        ├─ Check: error handling complete
        ├─ Check: security (tenant isolation, input validation)
        ├─ Check: performance (no N+1 queries, efficient loops)
        └─ Check: matches sinapses patterns
        ↓
        If issues found:
        ├─ Codex fixes automatically
        ├─ Re-run tests
        └─ Return to review (until clean)
        ↓
[TaskCompleted hook]: documentation → archival → commit (only after review passes)
```

---

## Review Checklist (Codex Validates)

### Code Quality
- [ ] No syntax errors
- [ ] Compiles/lints clean
- [ ] Follows project conventions (naming, structure)
- [ ] No dead code left behind
- [ ] Comments explain "why", not "what"

### Testing
- [ ] All tests passing
- [ ] New tests added for new functionality
- [ ] Edge cases covered
- [ ] Error paths tested

### Security & Compliance
- [ ] No hardcoded secrets/credentials
- [ ] Tenant isolation enforced (if applicable)
- [ ] Input validation present
- [ ] Error messages don't leak internals
- [ ] SQL injection/XSS/CSRF risks mitigated

### Architecture & Patterns
- [ ] Follows sinapses patterns documented
- [ ] No breaking changes to public API
- [ ] Backward compatible (or documented breaking change)
- [ ] Performance acceptable (no obvious N+1, efficient algorithms)

### Documentation
- [ ] Code is self-documenting
- [ ] Complex logic has comments
- [ ] Function signatures clear
- [ ] Examples provided if API new

---

## Codex Review Output

Generate: `working-memory/codex-review-{task_id}.md`

```markdown
---
review_id: [uuid]
task_id: YYYY-MM-DD-<slug>
timestamp: [ISO8601]
implementation_quality: [pass | pass_with_fixes | fail]
---

# Codex Code Review

## Summary
- Lines changed: N
- Files modified: N
- Issues found: N
- Auto-fixes applied: N

## Findings

### ✅ Strengths
- [Strength 1]: [why this is good]
- [Strength 2]: [why this is good]

### ⚠️ Issues Found & Fixed
- [Issue 1]: [found] → [fixed]
- [Issue 2]: [found] → [fixed]

### 🔴 Issues Requiring Manual Fix (if any)
- [Issue 1]: [description] → [how to fix]

## Quality Score
- Code Quality: 9/10
- Test Coverage: 8/10
- Security: 9/10
- Architecture: 9/10
- **Overall: 8.75/10** [pass ✓]

## Recommendation
- **Status:** Ready for brain-document stage
- **Next:** Deploy to staging for QA verification

---
```

---

## Integration with brain-task

### In brain-task Step 3:

```markdown
## Step 3: Execute Implementation — Model Execution (60-150k tokens)

### Codex Path (Primary)
1. Codex executes implementation
2. Codex runs internal tests
3. **→ Step 3.5: brain-codex-review validates**
   - Validates conventions
   - Checks for bugs, security, performance
   - Auto-fixes issues found
   - Returns pass/fail verdict
4. If pass: signal completion → TaskCompleted hook fires
5. If fail: Codex re-implements until review passes
```

---

## Why Codex Reviews?

| Challenge | How Codex Solves It |
|-----------|---|
| "I forgot to validate input" | Codex checks all entry points |
| "Are we leaking tenant data?" | Codex validates tenant isolation on every query |
| "Did I handle the error?" | Codex scans all return paths |
| "Is this efficient?" | Codex spots N+1 queries, inefficient loops |
| "Does this match our patterns?" | Codex compares against sinapses patterns |

---

## When Review Fails (Rare)

If Codex can't fix issue automatically:

```
1. Codex documents issue in codex-review.md
2. Marks: "Issues Requiring Manual Fix"
3. Halts workflow (doesn't proceed to brain-document)
4. Developer gets summary:
   - What's wrong
   - Why it's wrong
   - How to fix it
5. Developer fixes
6. Re-run: /brain-codex-review
```

---

## Manual Invocation

Developer can request review anytime:

```
/brain-codex-review [--file path/to/file.go] [--module module-name]

Codex reviews specified code and returns verdict.
Useful for pre-commit checks or reviewing existing code.
```

---

## Cost-Benefit

| Aspect | Value |
|--------|-------|
| Cost per review | 20k tokens (~$0.05-0.08) |
| Time to review | 3-5 minutes |
| Bugs caught (typical) | 2-3 per implementation |
| False positives (typical) | ~5% |
| Prevention value | High (catch issues before deploy) |

**ROI:** 20k tokens to prevent 1-2 bugs saves 50-100k tokens in debugging/refactor. **Break-even at first bug caught.**

---

## Configuration

In `brain.config.json`:

```json
{
  "codex_review_enabled": true,
  "codex_review_auto": true,
  "codex_review_checks": [
    "syntax",
    "conventions",
    "tests",
    "security",
    "performance",
    "patterns"
  ],
  "codex_review_auto_fix": true,
  "codex_review_fail_threshold": "blocker"
}
```

---

## Testing Checklist

Codex review is working when:

- [ ] After Codex implements, review runs automatically
- [ ] codex-review.md generated with findings
- [ ] Simple issues (lint, missing test) auto-fixed
- [ ] Security issues (validation, isolation) caught
- [ ] Performance issues (N+1) detected
- [ ] Review passes → proceed to brain-document
- [ ] Review fails → halt with manual fix instructions
- [ ] `/brain-codex-review` manual invocation works
- [ ] Quality score calculated (0-10)

---

## Sonnet-Implemented Tasks

For Sonnet-implemented tasks (score 20-39), brain-codex-review does NOT auto-trigger. Sonnet tasks rely on test results as the primary quality gate. If additional review is desired, invoke manually: `/brain-codex-review --file [path]`.

---

**Created:** 2026-03-25 | **Status:** Ready for integration

