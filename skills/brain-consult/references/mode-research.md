# Research Mode Reference

## When to Use

- Questions about external libraries, frameworks, APIs.
- "How to" with a specific technology: "how to configure Prisma cascade deletes?"
- Error investigation: "why is this 401 error happening?"
- Best practices: "what's the recommended pattern for X?"
- Documentation lookups: "what does the API say about rate limits?"

## Context Loading (Tier 1 + Tier 2 + External)

**Budget:** ~6000 tokens total.

**Tier 1 (always):**
1. `architecture.md` + `conventions.md` from hippocampus (~600 tokens condensed).
2. Thread context from prior `consult-*.json` (if within 10 min, same domain).

**Tier 2 via FTS5 (~2000 tokens additional):**
3. Extract 2-3 keywords from question.
4. Query `brain.db` FTS5 for matching sinapses (max 3, weighted 60% sinapse weight + 40% relevance).
5. Fallback to `LIKE` query on tags + region if FTS5 unavailable.
6. Track Hebbian usage: update `last_accessed` and `usage_count` for loaded sinapses.

**External research (max 3 MCP calls):**
7. Decision tree:
   - Specific library/framework mentioned? -> Context7 (`resolve-library-id` then `query-docs`).
   - API endpoints, error codes, versions? -> WebSearch.
   - Best practices or patterns? -> WebSearch with `"{topic} best practices 2026"`.
   - Stop as soon as the question is answered.

## External Tools

| Tool | Use Case | Priority |
|------|----------|----------|
| Context7 | Library/framework documentation | First (authoritative) |
| WebSearch | API info, error codes, best practices | Second (broad) |

## Process

1. Parse question, infer domain.
2. Load Tier 1 context.
3. Query FTS5 Tier 2 sinapses.
4. Run external research (if needed, max 3 calls).
5. Synthesize brain knowledge + external findings.
6. Answer with sources cited.
7. Write audit JSON + log entry.

## Output Format

```
[Brain] Consult (research) | Domain: {domain}

{Answer synthesizing brain + external research}

### From Brain Context
- [[sinapse-id]]: {relevant pattern}

### From External Documentation
- {Finding 1} -- source: {Context7 library / WebSearch URL}

---
Brain context: Tier 1+2 ({N} sinapses) + {K} external lookups
```
