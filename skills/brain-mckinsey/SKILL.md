---
name: brain-mckinsey
description: McKinsey Layer — Strategic intelligence for high-stakes decisions via internal scoring + external research
---

# brain-mckinsey Skill — McKinsey Layer

## Pipeline Position

brain-mckinsey is an optional branch invoked by brain-task for `architectural` type tasks. It provides strategic analysis (internal scoring + external research) before implementation proceeds. Not on the default pipeline path.

**Purpose:** For high-stakes architectural decisions only, perform rigorous strategic analysis combining internal scoring against product strategy with parallel external research. Produce a structured recommendation card with ROI estimate and risk assessment.

**Token Budget:** 20k in / 8k out (high-stakes decisions only)

## Trigger

Activated ONLY when:
- Task classification = "architectural" (new module, major refactor, tech selection, architecture choice)
- Developer invokes directly: `/brain-mckinsey "Should we adopt [technology/pattern]?"`
- brain-task detects major system boundary change

Do **not** activate for routine tasks (naming, minor refactors, field additions, CSS, single-component changes).

## Workflow

### Step 1: Load Strategic Context

From Brain:
- Read `hippocampus/strategy.md` — product goals, tech priorities, current phase, business constraints
- Read `hippocampus/decisions_log.md` — existing ADRs and frozen decisions
- Extract: what matters most? (reliability > correctness > maintainability > performance > DX?)

### Step 2: Internal Scoring

Score against **4 axes** (each 0–10):

1. **Business Impact** (weight 40%) — Advance product goals? Cost at scale? Customer impact?
2. **Tech Risk** (weight 20%, inverted) — Maturity in codebase? Team skills? Recovery plan?
3. **Effort** (weight 20%, inverted) — Story points? Phased approach? Blockers?
4. **Strategic Alignment** (weight 20%) — Aligns with existing decisions? Increases/decreases debt?

**Composite score = (business * 0.4) + (risk_inv * 0.2) + (effort_inv * 0.2) + (alignment * 0.2)**

### Step 3: External Research — Parallel Subagent Dispatch

Dispatch 2-3 research subagents in a **SINGLE message** (parallel execution):

**Agent 1 (best practices):**
```
Agent(
  model: "haiku",
  run_in_background: true,
  prompt: "Research best practices for {technology}. Use WebSearch.
           Return 3-5 findings with source URLs.
           Format: numbered list, each with: finding, source URL, relevance note."
)
```

**Agent 2 (benchmarks):**
```
Agent(
  model: "haiku",
  run_in_background: true,
  prompt: "Research how {companies} handled {decision}. Use WebSearch.
           Return 2-3 case studies.
           Format: company name, what they decided, outcome, source URL."
)
```

**Agent 3 (documentation, optional):**
```
Agent(
  model: "haiku",
  run_in_background: true,
  prompt: "Look up latest docs for {framework}. Use context7 or WebSearch.
           Return version info, stability assessment, migration complexity.
           Format: version, stability rating, breaking changes, upgrade path."
)
```

**After all subagents complete:**
1. Read each subagent's findings
2. Synthesize into `working-memory/mckinsey-output.md`
3. If any subagent returned nothing: mark that section as `[No external data found]`
4. If any subagent failed entirely: mark as `[Subagent failed — no external data]` and proceed with internal scoring only

Mark `[estimated]` if search returns nothing. Include contradictions between subagent findings.

### Step 4: Synthesis — 3 Alternatives

Generate 3 options:
- **Option A:** Recommended (internal + external)
- **Option B:** Conservative/proven
- **Option C:** Radical/future-proof

For each: score, pros (2–4), cons (2–4), time-to-production, reversibility, example company.

### Step 5: Output Card

Write `working-memory/mckinsey-output.md`:

```markdown
---
decision_id: [UUID]
timestamp: [ISO 8601]
requested_by: [user]
architecture: true
---

# Strategic Decision Card

## DECISION
[What is being decided in 1–2 sentences]

## BUSINESS IMPACT
**Score:** [score]/10
**Reasoning:** [From strategy.md, e.g., "Aligns with Phase 3A reliability priority. Cost: low."]

## EXTERNAL BENCHMARK
**Research Summary:**
[1–3 key findings from sub-agents. If none: "No external benchmarks found."]

**Sources:**
- [Finding 1 — URL]
- [Finding 2 — URL]

## ALTERNATIVES

### Option A: [Recommended] [Name]
**Composite Score:** [score]/10
**Pros:** [2–4 bullets]
**Cons:** [2–4 bullets]
**Time-to-production:** [weeks]
**Reversibility:** [easy/hard/very-hard]
**Example:** [Stripe/Google/similar]

### Option B: [Conservative] [Name]
[Same as Option A]

### Option C: [Radical] [Name]
[Same as Option A]

## RECOMMENDATION
**Option:** [A/B/C — name]
**Reasoning:** [Composite score + external findings justify choice. Note ADR conflicts.]

## ROI ESTIMATE
**Time Saved:** [e.g., "2 weeks per quarter on observability"]
**Probability of Success:** [e.g., "85% — team has experience"]
**ROI:** [e.g., "104 weeks saved over 2-year roadmap; net positive in week 3"]

## RISK FLAGS
- [Risk 1: e.g., "Requires 2-week training"]
- [Risk 2: e.g., "No rollback plan if adoption is low"]
- [Risk 3: e.g., "Conflicts with planned migration"]

## ADR CONFLICTS
[List conflicts with frozen ADRs. If none: "None."]

## NEXT STEPS
- [ ] Developer review this card
- [ ] Discuss trade-offs (if needed)
- [ ] ADR will be written at implementation (if approved)
```

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Activating for non-architectural tasks | Only activate when classification = "architectural" |
| Hallucinating external benchmarks | Only report what search returned; mark `[estimated]` otherwise |
| Forcing consensus from contradictory research | List conflicting findings; let developer decide |
| Blocking implementation while research runs | Surface results immediately; proceed with internal scoring if no external results |
| Recommending novelty over maturity | Bias toward proven options unless business case is compelling |
| Ignoring technical debt | Always check if recommendation increases/decreases debt |

## Failure Scenarios

| Scenario | Action |
|---|---|
| No external research results | Proceed with internal scoring only. Note "No external benchmarks found" in card. |
| Research contradicts internal scoring | List both findings. Let developer decide. Both are valid signals. |
| Unclear if decision is architectural | Ask developer: "Is this architectural or routine?" Offer escalation. |
| Recommendation conflicts with existing ADR | Flag in "ADR CONFLICTS". Do not override existing decisions. |
| Team lacks skills for all options | Note in "RISK FLAGS". Bias toward Option B (conservative). |

## Integration with brain-task

When brain-task invokes brain-mckinsey:
1. Task classification detected as "architectural"
2. brain-task calls `/brain-mckinsey` with decision description
3. Skill loads context, runs scoring, launches sub-agents
4. Returns `working-memory/mckinsey-output.md` for developer review
5. Developer approves/rejects recommendation
6. If approved, ADR is created at implementation time (not by mckinsey)
7. If rejected, developer documents rationale in task notes

**Token budget:** ~20–25k tokens typical (context + scoring + parallel sub-agents)
