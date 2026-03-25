# 📦 Setup para GitHub (Como Claude-Octopus)

## ✅ Arquivos Estão Corretos!

Seu plugin agora segue **EXATAMENTE** a estrutura do claude-octopus:

```
forgeflow-mini/
├── .claude-plugin/
│   ├── plugin.json           ✅ (8 linhas, padrão)
│   └── marketplace.json      ✅ (novo, com struktura correta)
├── skills/
│   ├── brain-init/SKILL.md
│   ├── brain-task/SKILL.md
│   └── ... (11 skills)
├── README.md
└── package.json (criar)
```

---

## 🚀 Passo-a-Passo: Subir para GitHub

### PASSO 1: Criar Repositório no GitHub

```bash
# Acesse: https://github.com/new
# Configurar assim:
#   - Repository name: forgeflow-mini
#   - Description: Brain-driven development plugin for Claude Code
#   - Public (importante!)
#   - Add a README file: SIM
```

### PASSO 2: Clonar Localmente

```bash
cd ~
git clone https://github.com/SEU_USERNAME/forgeflow-mini.git
cd forgeflow-mini
```

### PASSO 3: Copiar Arquivos do Plugin

```bash
# Copie toda a estrutura do forgeflow-mini local para o repo
cp -r ~/.claude/plugins/forgeflow-mini/* .

# Resultado esperado:
ls -la
# .claude-plugin/
# skills/
# README.md
# GITHUB_SETUP.md
# etc.
```

### PASSO 4: Criar package.json

Crie `package.json` na raiz:

```json
{
  "name": "forgeflow-mini",
  "version": "0.1.0",
  "description": "Brain-driven development plugin for Claude Code",
  "author": "ForgeFlow contributors",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/SEU_USERNAME/forgeflow-mini.git"
  },
  "homepage": "https://github.com/SEU_USERNAME/forgeflow-mini",
  "keywords": [
    "claude",
    "plugin",
    "brain",
    "knowledge",
    "development"
  ]
}
```

### PASSO 5: Criar .gitignore

```bash
cat > .gitignore << 'EOF'
node_modules/
.DS_Store
.env
.env.local
*.log
dist/
build/
.cache/
EOF
```

### PASSO 6: Commit e Push

```bash
git add .
git commit -m "feat: initial forgeflow-mini plugin setup"
git push origin main
```

### PASSO 7: Verificar no GitHub

Acesse: `https://github.com/SEU_USERNAME/forgeflow-mini`

Verifique que tem:
- ✅ `.claude-plugin/plugin.json`
- ✅ `.claude-plugin/marketplace.json`
- ✅ `skills/` com 11 diretórios
- ✅ `package.json`
- ✅ `README.md`

---

## 🔧 Instalar do GitHub (Exatamente como claude-octopus)

### Comando 1: Adicionar Marketplace

```bash
# TERMINAL (NÃO dentro do Claude Code)
claude plugin marketplace add https://github.com/SEU_USERNAME/forgeflow-mini.git
```

### Comando 2: Instalar Plugin

```bash
# TERMINAL (NÃO dentro do Claude Code)
claude plugin install brain-mini@forgeflow-plugins
```

### Resultado Esperado

Depois de instalar, no Claude Code:

```bash
# Listar skills disponíveis
/help | grep brain-mini

# Testar um skill
/brain-mini:brain-init

# Outros skills
/brain-mini:brain-task "create auth system"
/brain-mini:brain-status
/brain-mini:brain-mckinsey "pricing strategy"
```

---

## 📋 Comparação: Sua Estrutura vs Claude-Octopus

### Claude-Octopus
```
marketplace.name = "nyldn-plugins"
plugins[0].name = "octo"
install: octo@nyldn-plugins
```

### ForgeFlow-Mini (IGUAL)
```
marketplace.name = "forgeflow-plugins"
plugins[0].name = "brain-mini"
install: brain-mini@forgeflow-plugins
```

✅ **ESTRUTURA IDÊNTICA!**

---

## 🎯 Checklist Final (Antes de Fazer Commit)

- [ ] Repositório criado no GitHub
- [ ] `forgeflow-mini/` clonado localmente
- [ ] `.claude-plugin/plugin.json` presente
- [ ] `.claude-plugin/marketplace.json` presente
- [ ] `skills/` com 11 diretórios
- [ ] `package.json` criado
- [ ] `.gitignore` criado
- [ ] `README.md` presente e completo
- [ ] Nenhum arquivo `.env` ou sensível

```bash
# Verificar estrutura
tree -L 2 -a

# ou

find . -type f -name "plugin.json" -o -name "marketplace.json" -o -name "SKILL.md" | head -20
```

---

## 🚀 Resumo dos Comandos (Copiar e Colar)

```bash
# 1. Clonar repo (após criar no GitHub)
git clone https://github.com/SEU_USERNAME/forgeflow-mini.git
cd forgeflow-mini

# 2. Copiar arquivos
cp -r ~/.claude/plugins/forgeflow-mini/* .

# 3. Criar package.json
cat > package.json << 'EOF'
{
  "name": "forgeflow-mini",
  "version": "0.1.0",
  "description": "Brain-driven development plugin for Claude Code",
  "author": "ForgeFlow contributors",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/SEU_USERNAME/forgeflow-mini.git"
  },
  "homepage": "https://github.com/SEU_USERNAME/forgeflow-mini"
}
EOF

# 4. Criar .gitignore
echo "node_modules/
.DS_Store
.env
*.log" > .gitignore

# 5. Commit e Push
git add .
git commit -m "feat: forgeflow-mini plugin"
git push origin main

# 6. Instalar (NO TERMINAL, NÃO dentro do Claude Code)
claude plugin marketplace add https://github.com/SEU_USERNAME/forgeflow-mini.git
claude plugin install brain-mini@forgeflow-plugins

# 7. Testar (NO CLAUDE CODE)
/brain-mini:brain-init
```

---

## ✅ Status

**Estrutura**: ✅ PRONTA
**Plugin.json**: ✅ CORRETO
**Marketplace.json**: ✅ CRIADO
**Pronto para GitHub**: ✅ SIM!

Próximo passo: Execute os comandos acima! 🚀

---

**Lembre-se:**
- Substitua `SEU_USERNAME` pelo seu GitHub username
- Execute os comandos de instalação no **TERMINAL**, não no Claude Code
- Aguarde alguns segundos após `marketplace add`
- Se não funcionar, reinicie o terminal
