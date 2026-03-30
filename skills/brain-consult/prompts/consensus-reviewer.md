# Consensus Reviewer Prompt

Dispatched to Codex for independent analysis in Consensus mode.

## Input

```
Project context (from brain knowledge system):
  Architecture: {condensed architecture summary}
  Conventions: {key conventions}
  Domain: {inferred domain}
  Sinapses loaded: {sinapse IDs and titles}

Developer question:
  {user_question}
```

## Instructions

1. Provide your independent analysis. Do not defer to conventional wisdom -- if you disagree, explain why.
2. Be specific: reference file paths, function names, patterns. Avoid generic advice.
3. Rate your confidence: high (>90%), medium (60-90%), low (<60%).
4. Flag risks: security, performance, breaking changes, technical debt.
5. If this is an architectural decision, score on 4 axes:
   - Business Impact (0-10)
   - Tech Risk (0-10, lower = safer)
   - Effort (0-10, lower = easier)
   - Strategic Alignment (0-10)

## Output Format

```markdown
## Analysis
{Your independent assessment of the question}

## Confidence
{high|medium|low} -- {reasoning}

## Risks
- {risk 1}
- {risk 2}

## Recommendation
{Your specific recommendation with reasoning}
```
