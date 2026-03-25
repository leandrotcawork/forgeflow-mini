# 📦 Como Instalar ForgeFlow-Mini via Marketplace

## ✅ Plugin.json Agora Está Correto!

O plugin.json foi corrigido para seguir o padrão oficial do Claude Code.

---

## 🎯 3 Opções de Instalação

### Opção 1: Usar Diretamente (Mais Rápido ⚡)

Se o plugin já está em `~/.claude/plugins/forgeflow-mini/`, ele será descoberto automaticamente:

```bash
# 1. Reiniciar Claude Code
# 2. Executar:
/reload-plugins

# 3. Usar os skills:
/forgeflow-mini:brain-init
/forgeflow-mini:brain-status
```

**Quando usar**: Desenvolvimento local, testes rápidos

---

### Opção 2: Publicar no GitHub Marketplace (Recomendado para Distribuição)

Para compartilhar com outras pessoas, publique no GitHub:

#### Passo 1: Criar Repositório GitHub

```bash
# 1. Crie um repositório em https://github.com/new
#    Nome: forgeflow-plugins
#    Descrição: Brain-driven development plugins for Claude Code

# 2. Clone localmente
git clone https://github.com/SEU_USERNAME/forgeflow-plugins.git
cd forgeflow-plugins

# 3. Copie o plugin para lá
cp -r ~/.claude/plugins/forgeflow-mini .

# 4. Crie a estrutura de marketplace:
mkdir -p .claude-plugins
```

#### Passo 2: Criar Marketplace Manifest

Crie `.claude-plugins/marketplace.json`:

```json
{
  "version": 1,
  "marketplaces": [
    {
      "name": "ForgeFlow Plugins",
      "plugins": [
        {
          "name": "forgeflow-mini",
          "version": "0.1.0",
          "description": "Brain-driven development plugin",
          "author": "ForgeFlow contributors",
          "license": "MIT",
          "repository": "https://github.com/SEU_USERNAME/forgeflow-plugins",
          "installPath": "./forgeflow-mini"
        }
      ]
    }
  ]
}
```

#### Passo 3: Push para GitHub

```bash
git add .
git commit -m "feat: add forgeflow-mini plugin"
git push origin main
```

#### Passo 4: Instalar via Marketplace

No Claude Code:

```bash
# Opção A: Via marketplace URL
/plugin install https://raw.githubusercontent.com/SEU_USERNAME/forgeflow-plugins/main/.claude-plugins/marketplace.json

# Opção B: Se registrar em um registry centralizado
/plugin install forgeflow-mini@github:SEU_USERNAME/forgeflow-plugins
```

---

### Opção 3: Submeter ao Marketplace Oficial do Claude Code

Para aparecer no marketplace oficial do Claude Code:

#### Passo 1: Preparar Repositório

Estruture seu repo assim:

```
seu-repo/
├── forgeflow-mini/
│   ├── .claude-plugin/
│   │   └── plugin.json          ✅ Agora correto!
│   ├── skills/
│   │   └── ... (11 skills)
│   └── README.md
└── README.md
```

#### Passo 2: Submeter para Revisão

1. Acesse: [claude.ai/settings/plugins/submit](https://claude.ai/settings/plugins/submit)
2. Preencha o formulário:
   - **Repository URL**: Sua URL do GitHub
   - **Plugin Path**: `/forgeflow-mini`
   - **Description**: Brain-driven development plugin
   - **Author**: ForgeFlow contributors

3. Aguarde revisão (2-7 dias)
4. Depois aparecerá em:
   ```bash
   /plugin search forgeflow-mini
   /plugin install forgeflow-mini@anthropic
   ```

---

## 📋 Comparação: Qual Opção Escolher?

| Opção | Quando Usar | Tempo | Distribuição |
|-------|------------|-------|--------------|
| **1: Direto** | Desenvolvimento local | 1 min | Apenas você |
| **2: GitHub** | Compartilhar com equipe | 10 min | Link ou GitHub |
| **3: Oficial** | Disponibilizar publicamente | 1 semana | Marketplace oficial |

---

## 🚀 Próximos Passos (Escolha uma)

### Se escolher Opção 1 (Direto):
```bash
/reload-plugins
/forgeflow-mini:brain-init
```

### Se escolher Opção 2 (GitHub):
```bash
# Criar repositório forgeflow-plugins em GitHub
# Copiar forgeflow-mini para lá
# Criar .claude-plugins/marketplace.json
# Push para GitHub
# Instalar via /plugin install <URL>
```

### Se escolher Opção 3 (Oficial):
```bash
# Acessar: claude.ai/settings/plugins/submit
# Submeter para revisão
# Aguardar aprovação
```

---

## ✅ Verificação Final

Após instalar/atualizar, verifique:

```bash
# Ver se plugin foi descoberto
/help | grep forgeflow-mini

# Ver todos os skills
/help

# Testar um skill
/forgeflow-mini:brain-status
```

**Esperado:**
```
forgeflow-mini:brain-init
forgeflow-mini:brain-task
forgeflow-mini:brain-map
forgeflow-mini:brain-plan
forgeflow-mini:brain-mckinsey
forgeflow-mini:brain-codex-review
forgeflow-mini:brain-document
forgeflow-mini:brain-lesson
forgeflow-mini:brain-decision
forgeflow-mini:brain-consolidate
forgeflow-mini:brain-status
```

---

## 🔍 Troubleshooting

### "Plugin not found"
- Verifique: `/reload-plugins`
- Reinicie Claude Code
- Confirme estrutura: `.claude-plugin/plugin.json`

### "Marketplace URL invalid"
- Use URL raw.githubusercontent.com
- Formato: `https://raw.githubusercontent.com/.../marketplace.json`

### "Installation failed"
- Verifique permissões em GitHub
- Confirme `plugin.json` é válido JSON
- Veja logs: `/help` ou restart

---

## 📚 Referências

- [Official Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Submit Plugin](https://claude.ai/settings/plugins/submit)
- [Create Marketplace](https://code.claude.com/docs/en/plugin-marketplaces)

---

## 🎯 Seu Plugin.json Agora Está:

✅ **Válido**
✅ **Padrão Oficial**
✅ **Pronto para Distribuição**

Escolha a opção que faz mais sentido para você!
