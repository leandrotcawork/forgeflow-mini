# Routing Rules Reference

## Intent Classification

| Intent | Keywords / Signals | Route | Complexity Range |
|---|---|---|---|
| **build** | "implement", "add", "create", "build", "make" | brain-map + brain-plan (score >= 20) or brain-task (score < 20) | 15-100 |
| **refactor** | "refactor", "clean up", "improve", "optimise", "restructure" | brain-map + brain-plan (score >= 20) or brain-task (score < 20) | 15-100 |
| **fix** | specific change described: "fix X in Y", "change X to Y" | brain-task directly | 0-39 |
| **investigate** | symptom: "not working", "getting error", "fails", "broken" | brain-consult | 15-74 |
| **question** | "how does", "explain", "what is", "can we" | brain-consult | 0-39 |
| **review** | "is this right", "should we", "best approach", "review" | brain-consult | 0-39 |
| **debug** | "why is", "trace", "debug", "investigate", "isn't working" | brain-consult | 15-100 |

## Complexity Scoring

```
score = 15 (baseline)
  + domain:  cross-domain +30 | backend +10 | other +0
  + risk:    critical +35 | high +20 | medium +5 | low +0
  + type:    architectural +20 | debugging +15 | unknown_pattern +10
  = min(total, 100)
```

| Range | Label | Typical Route |
|---|---|---|
| 0-15 | Trivial | brain-task inline (no plan) |
| 16-39 | Simple | brain-task or brain-map + brain-plan |
| 40-74 | Medium | brain-map + brain-plan |
| 75-100 | Complex | brain-map + brain-plan (plan mode) |

## Routing Decision Tree

```
1. Is intent question / investigate / review / debug?
   YES -> brain-consult (done)
   NO  -> continue

2. Is intent fix (known, specific change)?
   YES -> brain-task directly (done)
   NO  -> continue

3. Is intent build or refactor?
   score < 20  -> brain-task inline (no plan)
   score >= 20 -> brain-map then brain-plan
```

## Keyword Extraction Rules

- Pick 3-5 nouns and domain terms, not verbs
  - "fix the auth token refresh" -> ["auth", "token", "refresh"]
- Max 5 keywords — more dilutes retrieval precision
- Vague requests ("it's broken") -> use domain as keyword (e.g., ["backend"])
- Prefer specific module/file names when mentioned
