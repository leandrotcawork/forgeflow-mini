# ForgeFlow Mini v2.0 — Refatoração Completa

**Data:** 2026-03-30
**Status:** Aprovado para implementação
**Versão alvo:** 2.0.0 (major — breaking changes)

## Problema

Skills com ~400 linhas de média (pico de 945 em brain-task), múltiplas skills executadas em sequência acumulam ~2,658 linhas no contexto, 9 hooks pesados (678 linhas de JS), arquitetura stateful complexa. Resultado: agent success rate 0%, média de 11.4 erros por sessão, 25% das sessões sem commit.

Referência: Superpowers v5.0.6 — 14 skills com média de 240 linhas, 1 hook (58 linhas bash), zero estado persistente além de git+markdown, arquivos complementares (prompts, templates, references) carregados sob demanda.

## Decisões de Design

1. **Manter .brain/ como diferencial** — hippocampus, cortex, sinapses, episódios permanecem
2. **Modelo híbrido inline/subagente** — skills leves inline, implementação pesada via subagente isolado
3. **Reduzir hooks de 9 para 2** — session-start + hippocampus-guard
4. **Consolidar skills de 14 para 10** — merge de skills com overlap natural + diretório shared/
5. **brain-dev como atalho inteligente** — session-start injeta orientação, brain-dev é opcional
6. **Arquivos complementares** — prompts, templates, references como arquivos separados (padrão Superpowers)

---

## Arquitetura de Skills

### Princípio

Cada skill segue: **SKILL.md enxuto (orquestração) + arquivos complementares (conhecimento)**. O SKILL.md diz O QUE fazer e QUANDO. Os arquivos complementares dizem COMO. Complementares só entram no contexto quando a skill decide lê-los.

### Estrutura padrão de diretório

```
skills/brain-{name}/
├── SKILL.md              # Orquestrador enxuto (80-150 linhas)
├── prompts/              # Templates para subagentes
│   └── *.md
├── references/           # Guias técnicos e detalhes
│   └── *.md
└── templates/            # Formatos de output (planos, reports, etc.)
    └── *.md
```

### Mapa completo: 10 skills + shared/

#### Infraestrutura compartilhada

```
skills/shared/
├── brain-access-patterns.md      # Como ler .brain/ eficientemente
├── context-budget-guide.md       # Limites de tokens por etapa
├── output-format-standards.md    # Formatos padrão de output
└── anti-patterns.md              # Erros conhecidos com o brain system
```

#### Session Orientation (injetado via hook — NÃO invocável pelo usuário)

```
skills/brain-orientation/
└── SKILL.md                      # GPS do brain system (~100L)
```

**Nota:** brain-orientation NÃO aparece no plugin.json como skill invocável. É um arquivo de conteúdo lido pelo hook session-start e injetado automaticamente. Vive em `skills/` por organização, mas o usuário nunca roda `/brain-orientation`.

Conteúdo: o que é o brain, quais skills existem e quando usar cada um, pipeline padrão, onde está o conhecimento, regras inegociáveis.

#### Pipeline Skills (6)

```
brain-dev/                          (~100L)
├── SKILL.md                        # Classificador + atalho
└── references/
    └── routing-rules.md            # Tabela de classificação e keywords

brain-map/                          (~80L)
├── SKILL.md                        # Orquestrador de contexto
└── references/
    └── context-tiers.md            # Detalhes dos 3 tiers de carregamento

brain-plan/                         (~150L)
├── SKILL.md                        # Fluxo de planejamento com diálogo
├── templates/
│   └── plan-document.md            # Template do plano de implementação
└── references/
    └── tdd-micro-steps.md          # Guia de decomposição em micro-steps

brain-task/                         (~120L — despacha SUBAGENTE)
├── SKILL.md                        # Orquestrador de dispatch
├── prompts/
│   ├── implementer.md              # Prompt para subagente implementador
│   ├── spec-reviewer.md            # Prompt para reviewer de spec
│   └── code-reviewer.md            # Prompt para reviewer de qualidade
└── references/
    └── subagent-guidelines.md      # Regras de isolamento e contexto

brain-verify/                       (~80L)
├── SKILL.md                        # Checklist de 6 fases
└── references/
    └── verification-phases.md      # Detalhes de cada fase

brain-document/                     (~80L)
├── SKILL.md                        # Proposta de atualizações
└── templates/
    ├── sinapse-proposal.md         # Formato de proposta de sinapse
    └── episode-format.md           # Formato de episódio
```

#### Off-Pipeline Skills (3)

```
brain-consult/                      (~150L)
├── SKILL.md                        # Router de modos
├── prompts/
│   └── consensus-reviewer.md       # Prompt para review cross-model
└── references/
    ├── mode-quick.md               # Detalhes modo rápido
    ├── mode-research.md            # Detalhes modo research (+Context7)
    └── mode-consensus.md           # Detalhes modo consensus (+Codex)

brain-config/                       (~150L — merge de brain-init + brain-setup)
├── SKILL.md                        # Init + Setup unificado
├── templates/
│   └── brain-config-default.md     # Template padrão do brain.config.json
└── references/
    ├── init-wizard.md              # Steps do wizard de inicialização
    └── config-schema.md            # Schema e validações do config

brain-health/                       (~150L — merge de brain-consolidate + brain-status)
├── SKILL.md                        # Dashboard + Consolidação
├── templates/
│   └── health-report.md            # Formato do relatório de saúde
└── references/
    ├── consolidation-pipeline.md   # Passos da consolidação
    └── weight-decay-rules.md       # Regras de decay e promoção
```

### Orçamento de linhas

| Tipo | Linhas | Notas |
|------|--------|-------|
| 10 SKILL.md | ~1,160 | Orquestração apenas |
| ~24 arquivos complementares | ~1,500 | Só carregados sob demanda |
| 4 shared/ references | ~300 | Cross-skill, lidos quando necessário |
| **Total** | **~2,960** | vs 5,422 atual (apenas SKILL.md) |

---

## Hooks

### De 9 para 2

#### Removidos (lógica migrada para skills)

| Hook removido | Destino |
|---------------|---------|
| routing-guard | Desnecessário — skills enxutas não precisam de guarda |
| config-protection | Instrução no brain-config SKILL.md |
| circuit-breaker | Checklist no brain-dev (lê state.json, se OPEN → avisa) |
| strategy-rotation | Referência em shared/anti-patterns.md |
| quality-gate | Step no brain-verify |
| task-safety-net | Desnecessário — subagente tem escopo claro |
| activity-observer | Desnecessário — git log é a fonte de verdade |
| brain-session-end | Estado persistido pelo brain-document, não por hook |

#### Hook 1: brain-session-start

**Tipo:** SessionStart
**Implementação:** Bash script (~50 linhas)
**Responsabilidades:**
1. Ler `.brain/brain-project-state.json` (estado atual)
2. Ler `skills/brain-orientation/SKILL.md` (GPS do brain)
3. Injetar ambos como contexto da sessão

**Output:**
```json
{
  "result": "add_context",
  "context": "# Brain System\n[orientation]\n\n# Current State\n[state summary]"
}
```

#### Hook 2: hippocampus-guard

**Tipo:** PreToolUse (Write, Edit)
**Implementação:** Bash script (~25 linhas)
**Responsabilidade:** Bloquear SEMPRE que o path contém `.brain/hippocampus/`

**Comportamento:** O hook bloqueia incondicionalmente. Quando brain-health precisa persistir no hippocampus, o SKILL.md instrui o usuário: "O hippocampus-guard vai solicitar aprovação para cada escrita — revise e aprove." O usuário mantém controle explícito.

**Output (quando bloqueado):**
```json
{
  "result": "block",
  "reason": "Hippocampus é imutável. Se você está rodando /brain-health, revise e aprove a escrita."
}
```

#### hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "name": "brain-session-start",
        "command": "bash hooks/session-start.sh",
        "description": "Inject brain orientation + current state"
      }
    ],
    "PreToolUse": [
      {
        "name": "hippocampus-guard",
        "command": "bash hooks/hippocampus-guard.sh",
        "toolNames": ["Write", "Edit"],
        "description": "Block writes to .brain/hippocampus/"
      }
    ]
  }
}
```

#### Estrutura de hooks/

```
hooks/
├── hooks.json              # ~15 linhas
├── session-start.sh        # ~50 linhas
└── hippocampus-guard.sh    # ~25 linhas
```

**Total: ~90 linhas** (vs 752 atual = -88%)

---

## Fluxo de Execução

### Pipeline completo (feature típica)

```
Usuário: "Adiciona feature X"

[Sessão já tem ~100L de brain-orientation via hook]

→ brain-dev (~100L) classifica → invoca brain-map
→ brain-map (~80L) monta contexto do .brain/ → invoca brain-plan
→ brain-plan (~150L) dialoga com usuário → gera plano

[Até aqui: ~430L acumulados — leve, interativo]

→ brain-task (~120L) despacha SUBAGENTE ISOLADO
    ↳ Subagente recebe:
      - prompts/implementer.md (~100L)
      - O plano gerado
      - Contexto do .brain/ montado pelo brain-map
      - NÃO herda histórico da sessão
    ↳ Implementa
    ↳ Recebe review (prompts/code-reviewer.md ~60L)
    ↳ Retorna resultado

[Sessão principal continua limpa]

→ brain-verify (~80L) checklist de 6 fases
→ brain-document (~80L) propõe atualizações de sinapses
```

**Contexto sessão principal: ~890L total**
**Contexto subagente: ~260L (isolado, descartado)**

### Critério de dispatch do subagente

| Complexidade | Ação | Critério |
|-------------|------|----------|
| Trivial | inline | 1-2 arquivos, sem lógica nova |
| Normal | 1 subagente | Feature típica, múltiplos arquivos |
| Complexa | subagente + dual review | Feature grande, spec-reviewer + code-reviewer |

brain-task decide com base no escopo do plano gerado pelo brain-plan.

### Fluxo direto (usuário experiente)

Graças à orientation no session-start, atalhos diretos funcionam:

```
/brain-plan adiciona endpoint X    → pula brain-dev, vai direto
/brain-consult como funciona auth  → consulta sem pipeline
/brain-health                      → consolidação direta
```

### Fluxo de consolidação (off-pipeline)

```
/brain-health
→ brain-health (~150L)
→ Lê references/consolidation-pipeline.md quando necessário
→ Processa episódios → propõe atualizações
→ Usuário aprova → persiste no hippocampus
```

---

## Skills Aposentadas

| Skill atual | Destino |
|-------------|---------|
| brain-init (520L) | Mergeado em **brain-config** |
| brain-setup (515L) | Mergeado em **brain-config** |
| brain-consolidate (496L) | Mergeado em **brain-health** |
| brain-status (151L) | Mergeado em **brain-health** |
| brain-mckinsey (219L) | Modo dentro de **brain-consult** |
| brain-codex-review (288L) | Prompt em **brain-task/prompts/code-reviewer.md** |
| brain-eval (42L) | Referência em **brain-plan/references/tdd-micro-steps.md** |

---

## Métricas de Sucesso

| Métrica | Atual | Alvo v2.0 |
|---------|-------|-----------|
| Total linhas SKILL.md | 5,422 | ~1,160 (-79%) |
| Maior skill | 945L (brain-task) | ~150L (brain-plan/consult) |
| Hooks | 9 (752L) | 2 (~90L) (-88%) |
| Contexto pipeline completo | ~2,658L | ~890L sessão + ~260L subagente |
| Número de skills | 14 | 10 + shared/ |
| Agent success rate | 0% | >70% |
| Avg tool errors/session | 11.4 | <3 |

---

## Fora de Escopo

- Mudanças na estrutura .brain/ (hippocampus, cortex, sinapses permanecem como estão)
- Mudanças no brain.config.json schema (apenas reorganização de onde é lido)
- Novo sistema de persistência (SQLite FTS5 permanece se já existe)
- UI/visualização (brain-graph.html permanece como está)
