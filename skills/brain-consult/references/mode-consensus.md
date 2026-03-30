# Consensus Mode Reference

## When to Use

- High-stakes architectural decisions: "should we adopt X for our stack?"
- Technology selection: "Redis vs Memcached for our caching layer?"
- Major refactoring decisions: "monolith split strategy?"
- Any question where independent multi-model validation adds confidence.
- Only activated via explicit `--consensus` flag. Never auto-selected.

## Process

1. **Load context** -- same as Research mode (Tier 1 + Tier 2 FTS5 + external research).
2. **Primary answer** -- Claude forms its answer first using all loaded context.
3. **Dispatch Codex** -- send question + project context to Codex for independent analysis using [consensus-reviewer.md](../prompts/consensus-reviewer.md).
4. **Compare** -- identify areas of agreement and divergence between Claude and Codex.
5. **Synthesize** -- produce unified recommendation (if aligned) or present both perspectives (if divergent).

## Strategic Decision Scoring (from McKinsey Layer)

For architectural/strategic decisions, score the recommendation on 4 axes:

| Axis | Weight | What It Measures |
|------|--------|-----------------|
| Business Impact | 40% | Advances product goals? Cost at scale? Customer impact? |
| Tech Risk | 20% (inverted) | Maturity in codebase? Team skills? Recovery plan? |
| Effort | 20% (inverted) | Story points? Phased approach? Blockers? |
| Strategic Alignment | 20% | Aligns with existing ADRs? Increases/decreases debt? |

**Composite score = (business * 0.4) + (risk_inv * 0.2) + (effort_inv * 0.2) + (alignment * 0.2)**

When scoring, generate 3 alternatives:
- **Option A (Recommended):** Best composite score from internal + external analysis.
- **Option B (Conservative):** Proven, lower risk, potentially lower impact.
- **Option C (Radical):** Future-proof, higher risk, potentially highest reward.

## Codex Dispatch

```
mcp__codex__codex(
  prompt: "{consensus-reviewer.md template filled with project context and question}",
  sandbox: "read-only"
)
```

If Codex is unavailable or times out: proceed Claude-only, note `[Codex unavailable -- single-model response]`.

## Budget

**Total:** ~12000 tokens.
- Context loading: ~4000 tokens (Tier 1 + Tier 2 + external).
- Claude analysis: ~3000 tokens.
- Codex analysis: ~3000 tokens.
- Synthesis: ~2000 tokens.

## Output Format

```
[Brain] Consult (consensus) | Domain: {domain} | Models: Claude + Codex

### Claude Assessment (with brain context)
{Claude's answer referencing sinapses}

### Codex Assessment
{Codex's independent analysis}

### Synthesis
- **Consensus level:** {aligned | partial | divergent}
- **Agreement:** {areas where both models align}
- **Divergence:** {areas of disagreement, if any}
- **Recommendation:** {synthesized recommendation with reasoning}
- **Strategic Score:** {composite}/10 (if architectural decision)

---
Brain context: Tier 1+2 ({N} sinapses) | Consensus: {aligned|partial|divergent}
```
