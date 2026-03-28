# brain-dev Flow Architecture (v0.9.0 — current vs proposed)

## Current Flow (with issues highlighted)

```mermaid
flowchart TB
    DEV["/brain-dev<br/>Developer says anything"]

    subgraph PHASE1["Phase 1: Classify + Evaluate (silent)"]
        CLASSIFY["Classify intent<br/>build | fix | debug | review | question | refactor"]
        SCORE["Calculate complexity score<br/>15 + domain + risk + type"]
        MODEL["Select model<br/>debug → Opus (override)<br/>&lt;20 → Haiku | 20-39 → Sonnet<br/>40-74 → Codex | 75+ → Codex+plan"]
        SINAPSE["⚠️ Query brain.db<br/>SELECT sinapses WHERE region LIKE domain<br/>LIMIT 5"]
        EVAL["⚠️ Silent evaluation<br/>Check conflicts, missing deps"]
        DEVCTX["Write dev-context-task_id.md<br/>classification + sinapses + concerns"]
    end

    subgraph PHASE2["Phase 2: Route"]
        ROUTE{"Route by intent + score"}
    end

    subgraph BUILD_PATH["Build / Refactor Path"]
        BP["brain-plan<br/>Phase 0: Q&A (1-3 questions)<br/>Phase 0c: 2 approach proposals<br/>Wait for approval"]
        BP_STAGE1["brain-plan Stage 1-5<br/>Generate TDD micro-steps"]
        PLAN_FILE["📄 implementation-plan-task_id.md<br/>Format: Micro-Step M1, M2..."]
    end

    subgraph DISPATCH["Phase 3: Subagent Dispatch"]
        PARSE["⚠️ brain-parse-plan.js<br/>Expects: Task N headers<br/>Gets: Micro-Step MN headers<br/>Files: expects bullets, gets table<br/>Steps: expects Step N, gets acceptance gates"]
        TODO["Create TodoWrite entries"]

        subgraph LOOP["Per Task (sequential)"]
            IMPL["🤖 Implementer subagent<br/>Receives: full task text"]
            SPEC["🤖 Spec reviewer (Haiku)<br/>⚠️ Full spec pasted again"]
            QUAL["🤖 Quality reviewer (Haiku)<br/>⚠️ Full spec pasted again"]
        end
    end

    subgraph CONSULT_PATH["Fix / Debug / Review / Question Path"]
        BC["brain-consult<br/>⚠️ Pre-Step: pipeline check<br/>⚠️ Step 1a: pipeline check AGAIN<br/>Loads OWN sinapses from brain.db"]
    end

    subgraph TASK_PATH["brain-task (all paths converge here)"]
        BT_CASE["CASE A: flags present<br/>CASE B: no flags (defaults)"]
        BT_STEP1["Step 1: Load Context<br/>Calls brain-map → queries brain.db<br/>⚠️ THIRD sinapse load for build path<br/>Writes context-packet-task_id.md"]
        BT_STEP2["Step 2: Generate model context<br/>⚠️ LLM reformats packet (extra pass)"]
        BT_STEP3["Step 3: Implement + verify"]
        POST["brain-post-task.js<br/>Record, activity log, archive"]
    end

    DEV --> CLASSIFY --> SCORE --> MODEL --> SINAPSE --> EVAL --> DEVCTX --> ROUTE

    ROUTE -->|"build/refactor<br/>score ≥ 20"| BP
    ROUTE -->|"build/refactor<br/>score < 20"| BT_CASE
    ROUTE -->|"fix (symptom)<br/>debug, review, question"| BC
    ROUTE -->|"fix (known)"| BT_CASE

    BP --> BP_STAGE1 --> PLAN_FILE --> PARSE --> TODO --> IMPL
    IMPL --> SPEC --> QUAL --> TODO

    BC -->|"fix confirmed"| BT_CASE

    BT_CASE --> BT_STEP1 --> BT_STEP2 --> BT_STEP3 --> POST

    style SINAPSE fill:#ff6b6b,color:#fff
    style EVAL fill:#ff6b6b,color:#fff
    style PARSE fill:#ff6b6b,color:#fff
    style SPEC fill:#ffa94d,color:#000
    style QUAL fill:#ffa94d,color:#000
    style BT_STEP2 fill:#ffa94d,color:#000
```

### Issues visible in the diagram:

| Color | Meaning | Where |
|-------|---------|-------|
| 🔴 Red | Broken or redundant | brain-dev sinapse loading (redundant), brain-parse-plan.js (can't parse actual format) |
| 🟠 Orange | Token waste | Spec pasted twice per task, LLM reformat pass, duplicate pipeline check |

---

## Proposed Flow (clean architecture)

```mermaid
flowchart TB
    DEV["/brain-dev<br/>Developer says anything"]

    subgraph PHASE1["Phase 1: Classify (fast, ~500 tokens, no DB)"]
        CLASSIFY["Classify intent<br/>build | fix-investigate | fix-known | debug<br/>review | question | refactor"]
        SCORE["Calculate complexity score"]
        MODEL["Select model<br/>debug → Opus (override)<br/>score-based for rest"]
        DEVCTX["Write dev-context-task_id.md<br/>ONLY: intent, domain, score,<br/>model, plan_mode, original request"]
    end

    subgraph PHASE2["Phase 2: Route (one line shown to dev)"]
        ROUTE{"Route by intent + score"}
    end

    subgraph BUILD_PATH["Build / Refactor Path"]
        BP["brain-plan<br/>Phase 0: Read dev-context<br/>Q&A (1-3 questions)<br/>2 approach proposals<br/>Wait for approval"]
        BP_GEN["brain-plan Stage 1-5<br/>Context loaded HERE via brain-map<br/>(single owner, one DB hit)<br/>Generate TDD plan"]
        PLAN_FILE["📄 implementation-plan-task_id.md"]
    end

    subgraph DISPATCH["Phase 3: Subagent Dispatch"]
        PARSE["brain-parse-plan.js<br/>Extracts: task number + title + fullText<br/>No file/step parsing needed"]
        TODO["Create TodoWrite entries"]

        subgraph LOOP["Per Task (sequential)"]
            IMPL["🤖 Implementer subagent<br/>Receives: fullText block"]
            SPEC["🤖 Spec reviewer (Haiku)<br/>Reads git diff, not re-pasted spec"]
            QUAL["🤖 Quality reviewer (Haiku)<br/>Reads git diff only"]
        end
    end

    subgraph CONSULT_PATH["Fix (investigate) / Debug / Review / Question"]
        BC["brain-consult<br/>Single pipeline check (Pre-Step)<br/>Loads own sinapses<br/>(one DB hit, targeted)"]
    end

    subgraph TASK_PATH["brain-task (worker)"]
        BT_CTX["Step 1: Load Context via brain-map<br/>Single DB hit<br/>Writes context-packet"]
        BT_IMPL["Step 2-3: Implement + verify"]
        POST["brain-post-task.js<br/>Record, archive"]
    end

    DEV --> CLASSIFY --> SCORE --> MODEL --> DEVCTX --> ROUTE

    ROUTE -->|"build/refactor ≥ 20"| BP
    ROUTE -->|"build/refactor < 20<br/>fix-known"| BT_CTX
    ROUTE -->|"fix-investigate<br/>debug, review, question"| BC

    BP --> BP_GEN --> PLAN_FILE --> PARSE --> TODO --> IMPL
    IMPL --> SPEC --> QUAL --> TODO

    BC -->|"fix identified"| BT_CTX

    BT_CTX --> BT_IMPL --> POST

    style CLASSIFY fill:#51cf66,color:#000
    style DEVCTX fill:#51cf66,color:#000
    style PARSE fill:#51cf66,color:#000
    style BP_GEN fill:#339af0,color:#fff
    style BT_CTX fill:#339af0,color:#fff
    style BC fill:#339af0,color:#fff
```

### What changed (proposed):

| Problem | Current | Proposed |
|---------|---------|----------|
| brain-dev queries brain.db | Yes (Phase 1e, 5 sinapses) | No — pure classifier, 0 DB hits |
| Context loading | 2-3 times (brain-dev + brain-map + brain-plan) | Once (brain-map via brain-task only) |
| brain-parse-plan.js | Parses files + steps (broken) | Extracts title + fullText only (robust) |
| Reviewer subagents | Full spec pasted per reviewer | Read git diff instead |
| "fix" routing | Ambiguous single intent | Split: fix-investigate vs fix-known |
| Pipeline check | 3x in brain-consult | 1x in Pre-Step only |
| brain-decision | Parallel router (contradicts brain-dev) | Retired — stub only |
| brain-task Step 2 | LLM reformats context packet | Removed — use packet directly |

---

## Data Flow: What gets written and read

```mermaid
flowchart LR
    subgraph FILES["Artifacts on disk"]
        DC["dev-context-id.md<br/>intent, domain, score,<br/>model, plan_mode,<br/>original request"]
        CP["context-packet-id.md<br/>Tier 1+2 sinapses,<br/>project structure,<br/>relevant files"]
        IP["implementation-plan-id.md<br/>Micro-steps with<br/>specs + implementation"]
        BS["brain-state.json<br/>pipeline step,<br/>task_id, timestamps"]
    end

    BD["brain-dev"] -->|writes| DC
    BP["brain-plan"] -->|reads| DC
    BP -->|writes| IP
    BM["brain-map"] -->|writes| CP
    BT["brain-task"] -->|calls| BM
    BT -->|reads| CP
    BT -->|reads/writes| BS
    PARSE["brain-parse-plan.js"] -->|reads| IP
    BD -->|calls| PARSE

    style DC fill:#51cf66,color:#000
    style CP fill:#339af0,color:#fff
    style IP fill:#be4bdb,color:#fff
    style BS fill:#ffa94d,color:#000
```
