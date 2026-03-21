# 🤖 Claude.md - Documentação Completa de Dados

## 📊 Visão Geral

Este projeto utiliza uma arquitetura de dados robusta com banco externo
ao Replit, hospedado no **Google Cloud Platform (GCP)**.
O objetivo é integrar dados financeiros do **Conta Azul** com dados
operacionais do **ClickUp**, permitindo análises financeiras,
operacionais e de performance de clientes e contratos.

---

## 🏗️ Arquitetura

- Banco hospedado no **Google Cloud SQL**
- Integração entre:
  - **Conta Azul** (financeiro)
  - **ClickUp** (operações / contratos)
- Relacionamento principal via **CNPJ do cliente**
- Estrutura preparada para análises:
  - Receita recorrente
  - Receita pontual
  - Inadimplência
  - Churn
  - Saúde da conta

---

## 🗄️ Schemas

---

# 📘 Conta Azul

## caz_parcelas

Tabela de faturas e receitas do Conta Azul (integração via API).

**Colunas principais:**
- `id_parcela` - ID único da parcela
- `cnpj_cliente` - CNPJ do cliente (chave de relacionamento)
- `nome_cliente` - Nome do cliente
- `data_emissao` - Data de emissão da fatura
- `data_vencimento` - Data de vencimento
- `data_pagamento` - Data de pagamento (se pago)
- `valor` - Valor da parcela
- `status` - Status da parcela (ex: "PAGO", "PENDENTE", "VENCIDO")
- `tipo` - Tipo de receita ("RECORRENTE" ou "PONTUAL")
- `categoria` - Categoria da receita
- `descricao` - Descrição da parcela
- `observacoes` - Observações adicionais

---

## 🤖 Agentes de Desenvolvimento

Agentes especializados que servem como contexto para o Claude ao desenvolver features.
Localizados em `agents/`:

| Agente | Arquivo | Quando usar |
|--------|---------|-------------|
| DB Specialist | `agents/db-specialist.md` | Queries SQL, novas tabelas, relacionamentos, migracoes |
| Obsidian Sync | `agents/obsidian-sync-SKILL.md` | Invocado automaticamente pelo git-autopush para sincronizar progresso no vault |

Documentacao completa do banco: `DATABASE.md`

---

## ⚠️ Regra Obrigatória: Consultar Agentes

**ANTES** de iniciar qualquer alteração, **SEMPRE** consultar os arquivos em `agents/` para verificar se existe um agente especializado relevante para a tarefa. Ler o agente correspondente e seguir suas instruções/contexto antes de codificar.

## ⚠️ Regra Obrigatória: Git Auto-Push

**APÓS** toda alteração de código (edição, criação ou exclusão de arquivo), **SEMPRE** executar o workflow descrito em `agents/git-autopush-SKILL.md`: stage, commit (Conventional Commits) e push automaticamente. Nunca pular esse passo.

---

## 🔄 Workflow de Desenvolvimento — OBRIGATÓRIO

Todo desenvolvimento DEVE seguir estas 8 etapas na ordem. Não pular nenhuma.

### Etapa 1: ENTENDER
- Ler o código existente e entender o contexto antes de qualquer coisa
- Perguntar ao usuário se algo não está claro
- **SEMPRE** usar `superpowers:brainstorming` para features novas ou mudanças significativas
  - Explorar requisitos, perguntar uma pergunta por vez
  - Propor 2-3 abordagens com trade-offs
  - Obter aprovação do design antes de implementar
  - Isso aumenta a assertividade e evita retrabalho

### Etapa 2: PLANEJAR
- **SEMPRE** criar feature branch (`feature/nome-descritivo`) — nunca commitar direto em staging/main
- Para mudanças grandes, usar `superpowers:writing-plans` para criar plano de implementação
- Para mudanças pequenas, plano mental basta mas branch é obrigatória

### Etapa 3: INVESTIGAR
- **ANTES de escrever código**, investigar o terreno:
  - API externa? Fazer chamadas reais com curl/fetch primeiro
  - Banco de dados? Rodar queries reais para validar estrutura
  - Componente existente? Ler o código atual completamente
- Nunca assumir comportamento de APIs/sistemas externos — testar primeiro
- Usar `superpowers:systematic-debugging` quando investigando bugs

### Etapa 4: IMPLEMENTAR
- Código + testes mínimos para lógica de negócio
- Arquivos com mais de 500 linhas devem ser avaliados para extração de componentes
- Usar `superpowers:subagent-driven-development` para tasks independentes em paralelo
- Dark/light mode obrigatório (ver seção Temas abaixo)

### Etapa 5: TESTAR LOCAL
- Reiniciar dev server (`npm run dev`) após mudanças no backend
- Testar no browser antes de considerar pronto
- Verificar dark mode E light mode
- **Não é responsabilidade do usuário encontrar bugs básicos**

### Etapa 6: COMMIT
- Commits granulares — uma mudança lógica por commit
- Conventional Commits (feat, fix, style, refactor, chore)
- Nunca commitar direto em staging/main

### Etapa 7: REVIEW
- Revisar o diff completo antes de push
- Para features grandes, usar `superpowers:requesting-code-review`
- Corrigir issues encontrados antes de prosseguir

### Etapa 8: MERGE
- PR para staging com descrição clara
- CI deve passar antes de merge
- Usar `superpowers:finishing-a-development-branch` para fechar a branch

### Superpowers — Quando usar cada um

| Skill | Quando |
|-------|--------|
| `brainstorming` | Feature nova, mudança significativa, redesign |
| `writing-plans` | Implementação com 3+ tasks |
| `subagent-driven-development` | Executar plano com tasks independentes |
| `systematic-debugging` | Qualquer bug, erro ou comportamento inesperado |
| `test-driven-development` | Lógica de negócio crítica |
| `requesting-code-review` | Antes de merge de feature grande |
| `finishing-a-development-branch` | Após todos os testes passarem |

---

## 🎯 Diretrizes de Desenvolvimento

### Suporte a Temas (Dark/Light Mode)
**SEMPRE** adaptar componentes para suportar ambos os temas usando o padrão:
```tsx
import { useTheme } from "@/components/ThemeProvider";

// Cores para modo claro e escuro
className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
className="border-gray-200 dark:border-zinc-700"
className="text-gray-600 dark:text-zinc-400"
```

### Padrões de Código
- Usar TypeScript para type safety
- Componentes React funcionais com hooks
- Tailwind CSS para estilização
- Recharts para visualizações de dados
- React Query para gerenciamento de estado servidor

### Nomenclatura
- Componentes: PascalCase (ex: `EvolucaoMensal.tsx`)
- Funções: camelCase (ex: `formatCurrencyNoDecimals`)
- Constantes: UPPER_SNAKE_CASE (ex: `SQUAD_COLORS`)
- Arquivos: kebab-case ou PascalCase para componentes

### Commits
- Mensagens claras e descritivas
- Sempre incluir: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`
- Focar no "porquê" não apenas no "o quê"

---

## 📝 Notas Importantes

- **Sempre** verificar compatibilidade com tema claro/escuro
- **Nunca** hardcodar cores - usar classes Tailwind com dark: variant
- **Sempre** usar formatadores de moeda para valores monetários
- **Testar** em ambos os modos de tema antes de considerar completo
