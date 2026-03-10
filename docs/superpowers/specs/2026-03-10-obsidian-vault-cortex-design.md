# Spec: Obsidian Vault — Córtex 2.0

**Data:** 2026-03-10
**Status:** Aprovado

## Objetivo

Estruturar o vault do Obsidian como "second brain" de desenvolvimento do Cortex 2.0. O Obsidian serve para organizar roadmap, tasks, specs, decisões e rastrear progresso. O ClickUp continua sendo usado na operação do negócio.

## Decisões

| Aspecto | Decisão |
|---------|---------|
| Estrutura | Por domínio (9 pastas numeradas) |
| Tasks | Checkboxes markdown com tags, datas, prioridades |
| Templates | Épico, Decisão (ADR), Dashboard |
| Automação | Claude cria/atualiza tasks; Dataview renderiza |
| Plugins | Dataview + Tasks (mínimo necessário) |
| Escopo | Todos os domínios mapeados (~45 épicos) |

## Estrutura de Pastas

```
📂 Córtex 2.0/
├── 📋 Dashboard.md
├── 📂 01-Area-do-Cliente/
│   ├── 📋 _overview.md
│   ├── 📋 portal-cliente.md
│   ├── 📋 boletos-financeiro.md
│   ├── 📋 suporte-cx.md
│   ├── 📋 cancelamento-self-service.md
│   └── 📋 nps-feedback.md
├── 📂 02-Contratos/
│   ├── 📋 _overview.md
│   ├── 📋 crud-contratos.md
│   ├── 📋 assinatura-digital.md
│   ├── 📋 geracao-pdf.md
│   ├── 📋 card-cliente-automatico.md
│   ├── 📋 entregaveis-como-tasks.md
│   └── 📋 workflow-aprovacao.md
├── 📂 03-Financeiro/
│   ├── 📋 _overview.md
│   ├── 📋 dashboard-financeiro.md
│   ├── 📋 dre-fluxo-caixa.md
│   ├── 📋 inadimplencia.md
│   ├── 📋 integracao-conta-azul.md
│   ├── 📋 nf-processing.md
│   └── 📋 auto-billing.md
├── 📂 04-Churn-Retencao/
│   ├── 📋 _overview.md
│   ├── 📋 dashboard-churn.md
│   ├── 📋 predicao-churn.md
│   ├── 📋 dashboard-retencao.md
│   ├── 📋 relatorio-semanal-churn.md
│   └── 📋 alertas-automaticos-risco.md
├── 📂 05-Comercial/
│   ├── 📋 _overview.md
│   ├── 📋 dashboard-sdrs-closers.md
│   ├── 📋 analise-vendas-squads.md
│   ├── 📋 metas-squad.md
│   ├── 📋 okr-2026.md
│   ├── 📋 margem-cliente.md
│   └── 📋 funil-vendas-realtime.md
├── 📂 06-RH-Pessoas/
│   ├── 📋 _overview.md
│   ├── 📋 colaboradores.md
│   ├── 📋 onboarding-rh.md
│   ├── 📋 patrimonio.md
│   ├── 📋 calendario-ferias.md
│   ├── 📋 beneficios.md
│   └── 📋 integracao-inhire.md
├── 📂 07-Relatorios/
│   ├── 📋 _overview.md
│   ├── 📋 relatorio-mensal.md
│   ├── 📋 relatorio-semanal-financeiro.md
│   ├── 📋 auto-report.md
│   ├── 📋 investors-report.md
│   └── 📋 relatorio-performance-cliente.md
├── 📂 08-Infra-Seguranca/
│   ├── 📋 _overview.md
│   ├── 📋 phase1-sql-injection.md
│   ├── 📋 phase2-zod-rate-limiting.md
│   ├── 📋 modularizacao-rotas.md
│   ├── 📋 phase3-auth-rbac.md
│   └── 📋 monitoramento-alertas.md
├── 📂 09-Juridico/
│   ├── 📋 _overview.md
│   ├── 📋 processos-juridicos.md
│   ├── 📋 assistente-juridico-ai.md
│   └── 📋 clientes-juridicos.md
├── 📂 Decisoes/
└── 📂 Templates/
    ├── 📋 epico.md
    └── 📋 decisao.md
```

## Templates

### Template de Épico

```markdown
---
tipo: epico
dominio: {{dominio}}
status: 🟡 em-andamento | 🟢 concluido | 🔴 bloqueado | ⚪ planejado
criado: {{data}}
atualizado: {{data}}
---
# {{Nome do Épico}}

## Objetivo
{{Por que isso existe}}

## Tasks
- [ ] Task 1 #{{tag}} 📅 YYYY-MM-DD
- [ ] Task 2 #{{tag}} 📅 YYYY-MM-DD

## Notas
{{Contexto técnico, decisões, links relevantes}}
```

### Template de Decisão (ADR)

```markdown
---
tipo: decisao
dominio: {{dominio}}
data: {{data}}
status: aceita | substituida | em-discussao
---
# ADR: {{Título}}

## Contexto
{{Qual problema estávamos resolvendo}}

## Decisão
{{O que decidimos}}

## Consequências
{{O que muda por causa dessa decisão}}
```

### Dashboard.md

Usa queries Dataview para:
- Progresso por domínio (tasks feitas/pendentes por épico)
- Tasks urgentes (vencidas ou próximos 3 dias)
- Últimas 10 tasks completadas

## Formato de Task

```markdown
- [ ] Implementar tela de boletos #area-cliente 📅 2026-03-15 ⏫
- [x] Criar rota de autenticação do portal #area-cliente ✅ 2026-03-08
```

Componentes:
- `#tag-dominio` — para Dataview filtrar
- `📅 YYYY-MM-DD` — data de entrega
- `⏫` alta / `🔼` média / `🔽` baixa prioridade
- `✅ YYYY-MM-DD` — data de conclusão

## Domínios e Status

| # | Domínio | Status | Construídos | Em Andamento | Planejados |
|---|---------|--------|-------------|--------------|------------|
| 01 | Área do Cliente | 🔴 PRIORIDADE | 0 | 1 | 4 |
| 02 | Contratos | 🔴 PRIORIDADE | 3 | 0 | 3 |
| 03 | Financeiro | 🟢 ESTÁVEL | 4 | 1 | 1 |
| 04 | Churn/Retenção | 🟢 ESTÁVEL | 4 | 0 | 1 |
| 05 | Comercial | 🟡 ATIVO | 5 | 0 | 1 |
| 06 | RH/Pessoas | 🟢 ESTÁVEL | 6 | 0 | 0 |
| 07 | Relatórios | 🟢 ESTÁVEL | 4 | 0 | 1 |
| 08 | Infra/Segurança | 🟡 ATIVO | 2 | 1 | 2 |
| 09 | Jurídico | 🟢 ESTÁVEL | 3 | 0 | 0 |

## Automação do Claude

1. **Ao iniciar sessão** — ler vault para contexto
2. **Ao começar task** — marcar como em andamento no épico
3. **Ao completar** — marcar [x] com data de conclusão
4. **Decisões arquiteturais** — criar ADR em Decisoes/
5. **Feature nova** — adicionar épico na pasta do domínio
6. **Final de sessão** — atualizar _overview.md e Dashboard.md

## Plugins Obsidian Necessários

- **Dataview** — queries automáticas no Dashboard
- **Tasks** — renderização rica de checkboxes com datas e prioridades
- **Calendar** (opcional) — visualizar tasks por data
