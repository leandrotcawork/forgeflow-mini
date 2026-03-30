# Quick Mode Reference

## When to Use

- Simple factual questions about the project: "where is X?", "what does Y do?"
- Internal knowledge recall: "remind me how we handle Z"
- Quick clarifications: "which file has the auth middleware?"
- No external research needed -- answer lives in brain context.

## Context Loading (Tier 1 Only)

**Budget:** ~1500 tokens context, ~2500 tokens total response.

1. Read `.brain/hippocampus/architecture.md` -- condense to key patterns (~300 chars).
2. Read `.brain/hippocampus/conventions.md` -- condense to relevant rules (~300 chars).
3. Read active task summary from `brain-state.json` (if pipeline active).
4. Include thread context from prior `consult-*.json` (if within 10 min, same domain).

**Tier 1B expansion** (if confidence is low):
- Triggered when: sinapse domain mismatch, keywords not in hippocampus, or question references prior work with no thread context.
- Load last 3 entries from `.brain/progress/consult-log.md`.

## Process

1. Parse question, infer domain.
2. Load Tier 1A context (expand to 1B if low confidence).
3. Answer directly with sinapse references.
4. If confidence remains low after 1B expansion, offer upgrade: "Want me to re-run as Research mode for deeper context?"

## Output Format

```
[Brain] Consult (quick) | Domain: {domain}

{Direct answer}

Per [[sinapse-id]]: {how this applies}

---
Brain context: Tier {1A|1A+1B} ({N} sinapses, domain: {domain})
```
