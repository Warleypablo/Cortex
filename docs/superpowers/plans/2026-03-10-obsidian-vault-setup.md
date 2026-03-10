# Obsidian Vault Setup — Córtex 2.0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the Obsidian vault at `~/Documents/Obsidian Vault/Córtex 2.0/` with the full domain structure, templates, épicos, and dashboard.

**Architecture:** Direct file creation — all files are markdown written to the Obsidian vault directory. No code, no tests. Each task creates files for one domain or cross-cutting concern.

**Tech Stack:** Markdown, Obsidian Dataview query syntax, YAML frontmatter

**Vault root:** `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/`

**Spec:** `docs/superpowers/specs/2026-03-10-obsidian-vault-cortex-design.md`

---

## Chunk 1: Foundation (Templates + Dashboard)

### Task 1: Create folder structure

**Files:**
- Create: All domain directories and support directories

- [ ] **Step 1: Create all directories**

```bash
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/01-Area-do-Cliente"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/02-Contratos"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/03-Financeiro"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/04-Churn-Retencao"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/05-Comercial"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/06-RH-Pessoas"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/07-Relatorios"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/08-Infra-Seguranca"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/09-Juridico"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/Decisoes"
mkdir -p "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/Templates"
```

- [ ] **Step 2: Remove old test file**

```bash
rm -f "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/teste.md"
```

- [ ] **Step 3: Verify structure**

```bash
ls -la "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/"
```

Expected: 11 directories listed.

---

### Task 2: Create templates

**Files:**
- Create: `Templates/epico.md`
- Create: `Templates/decisao.md`

- [ ] **Step 1: Write épico template**

Write to `Templates/epico.md`:

```markdown
---
tipo: epico
dominio: "{{dominio}}"
status: ⚪ planejado
criado: "{{date}}"
atualizado: "{{date}}"
---
# {{Nome do Épico}}

## Objetivo
{{Por que isso existe}}

## Tasks
- [ ] Task 1 #{{tag}} 📅 YYYY-MM-DD

## Notas
{{Contexto técnico, decisões, links relevantes}}
```

- [ ] **Step 2: Write decisão (ADR) template**

Write to `Templates/decisao.md`:

```markdown
---
tipo: decisao
dominio: "{{dominio}}"
data: "{{date}}"
status: em-discussao
---
# ADR: {{Título}}

## Contexto
{{Qual problema estávamos resolvendo}}

## Decisão
{{O que decidimos}}

## Consequências
{{O que muda por causa dessa decisão}}
```

---

### Task 3: Create Dashboard.md

**Files:**
- Create: `Dashboard.md`

- [ ] **Step 1: Write Dashboard with Dataview queries**

Write to `Dashboard.md` with:
- Header with project name and last-updated date
- Dataview table: progress per domain (count tasks done/pending grouped by `dominio` frontmatter)
- Dataview task query: urgent tasks (due within 3 days)
- Dataview task query: last 10 completed tasks
- Quick-links section to each domain's `_overview.md`

---

## Chunk 2: Priority Domains (01 + 02)

### Task 4: Create 01-Area-do-Cliente épicos

**Files:**
- Create: `01-Area-do-Cliente/_overview.md`
- Create: `01-Area-do-Cliente/portal-cliente.md`
- Create: `01-Area-do-Cliente/boletos-financeiro.md`
- Create: `01-Area-do-Cliente/suporte-cx.md`
- Create: `01-Area-do-Cliente/cancelamento-self-service.md`
- Create: `01-Area-do-Cliente/nps-feedback.md`

- [ ] **Step 1: Write _overview.md**

Frontmatter: `tipo: overview`, `dominio: area-do-cliente`, `status: 🔴 prioridade`.
Content: description of the domain, link to each épico, summary of what's built vs planned.

- [ ] **Step 2: Write portal-cliente.md**

Frontmatter: `tipo: epico`, `dominio: area-do-cliente`, `status: 🟡 em-andamento`.
Tasks (all `#area-cliente`):
- [x] Criar página PortalCliente com layout base ✅ 2026-03-01
- [ ] Implementar autenticação do cliente (login separado do admin) ⏫
- [ ] Dashboard do cliente (resumo de serviços ativos) ⏫
- [ ] Visualização de performance dos serviços contratados 🔼
- [ ] Notificações e avisos para o cliente 🔽

- [ ] **Step 3: Write boletos-financeiro.md**

Frontmatter: `tipo: epico`, `dominio: area-do-cliente`, `status: ⚪ planejado`.
Tasks (all `#area-cliente`):
- [ ] Listar boletos/faturas do cliente (integração Conta Azul) ⏫
- [ ] Exibir status de pagamento por fatura 🔼
- [ ] Gerar 2ª via de boleto 🔼
- [ ] Histórico de pagamentos do cliente 🔽

- [ ] **Step 4: Write suporte-cx.md**

Frontmatter: `tipo: epico`, `dominio: area-do-cliente`, `status: ⚪ planejado`.
Tasks (all `#area-cliente`):
- [ ] Formulário de abertura de chamado 🔼
- [ ] Listagem de chamados abertos/resolvidos 🔼
- [ ] Canal de contato direto com CS responsável 🔼
- [ ] FAQ / Base de conhecimento do cliente 🔽

- [ ] **Step 5: Write cancelamento-self-service.md**

Frontmatter: `tipo: epico`, `dominio: area-do-cliente`, `status: ⚪ planejado`.
Tasks (all `#area-cliente`):
- [ ] Fluxo de solicitação de cancelamento 🔼
- [ ] Etapa de retenção (oferta, desconto, pesquisa de motivo) 🔼
- [ ] Confirmação e processamento do cancelamento 🔼
- [ ] Notificação ao CS e registro no sistema 🔽

- [ ] **Step 6: Write nps-feedback.md**

Frontmatter: `tipo: epico`, `dominio: area-do-cliente`, `status: ⚪ planejado`.
Tasks (all `#area-cliente`):
- [ ] Pesquisa NPS integrada ao portal 🔼
- [ ] Dashboard de resultados NPS (já existe página NpsPesquisa) 🔼
- [ ] Alertas de detratores para CS 🔽

---

### Task 5: Create 02-Contratos épicos

**Files:**
- Create: `02-Contratos/_overview.md`
- Create: `02-Contratos/crud-contratos.md`
- Create: `02-Contratos/assinatura-digital.md`
- Create: `02-Contratos/geracao-pdf.md`
- Create: `02-Contratos/card-cliente-automatico.md`
- Create: `02-Contratos/entregaveis-como-tasks.md`
- Create: `02-Contratos/workflow-aprovacao.md`

- [ ] **Step 1: Write _overview.md**

Frontmatter: `tipo: overview`, `dominio: contratos`, `status: 🔴 prioridade`.
Content: description, links to épicos, status summary (3 built, 3 planned).

- [ ] **Step 2: Write crud-contratos.md**

Frontmatter: `tipo: epico`, `dominio: contratos`, `status: 🟢 concluido`.
Tasks (all `#contratos`):
- [x] CRUD completo de contratos (criar, editar, listar, detalhar) ✅ 2026-02-15
- [x] Validação de campos com Zod ✅ 2026-02-20
- [x] Staging tables (staging.contratos, staging.entidades) ✅ 2026-02-25

- [ ] **Step 3: Write assinatura-digital.md**

Frontmatter: `tipo: epico`, `dominio: contratos`, `status: 🟢 concluido`.
Tasks (all `#contratos`):
- [x] Integração com Assinafy ✅ 2026-02-28
- [x] Envio de contrato para assinatura ✅ 2026-03-01
- [x] Webhook de status de assinatura ✅ 2026-03-02

- [ ] **Step 4: Write geracao-pdf.md**

Frontmatter: `tipo: epico`, `dominio: contratos`, `status: 🟢 concluido`.
Tasks (all `#contratos`):
- [x] Template de PDF do contrato ✅ 2026-02-20
- [x] Geração automática de PDF ✅ 2026-02-22
- [x] Download de PDF pelo usuário ✅ 2026-02-23

- [ ] **Step 5: Write card-cliente-automatico.md**

Frontmatter: `tipo: epico`, `dominio: contratos`, `status: ⚪ planejado`.
Tasks (all `#contratos`):
- [ ] Contrato assinado dispara criação de card de cliente ⏫
- [ ] Vincular dados do contrato ao card (serviços, valor, prazo) ⏫
- [ ] Atribuir CS responsável automaticamente 🔼
- [ ] Notificar squad de onboarding 🔽

- [ ] **Step 6: Write entregaveis-como-tasks.md**

Frontmatter: `tipo: epico`, `dominio: contratos`, `status: ⚪ planejado`.
Tasks (all `#contratos`):
- [ ] Mapear entregáveis por tipo de contrato/produto ⏫
- [ ] Gerar tasks de entrega automaticamente ao ativar contrato ⏫
- [ ] Dashboard de progresso de entregas por cliente 🔼
- [ ] Alertas de entrega atrasada 🔼

- [ ] **Step 7: Write workflow-aprovacao.md**

Frontmatter: `tipo: epico`, `dominio: contratos`, `status: ⚪ planejado`.
Tasks (all `#contratos`):
- [ ] Fluxo de aprovação multi-nível (comercial → financeiro → jurídico) 🔼
- [ ] Notificações de aprovação pendente 🔼
- [ ] Histórico de aprovações 🔽

---

## Chunk 3: Stable Domains (03-06)

### Task 6: Create 03-Financeiro épicos

**Files:**
- Create: `03-Financeiro/_overview.md`
- Create: `03-Financeiro/dashboard-financeiro.md`
- Create: `03-Financeiro/dre-fluxo-caixa.md`
- Create: `03-Financeiro/inadimplencia.md`
- Create: `03-Financeiro/integracao-conta-azul.md`
- Create: `03-Financeiro/nf-processing.md`
- Create: `03-Financeiro/auto-billing.md`

- [ ] **Step 1: Write _overview.md** — `status: 🟢 estável`, 4 built, 1 WIP, 1 planned.

- [ ] **Step 2: Write dashboard-financeiro.md** — `status: 🟢 concluido`. Tasks: MRR tracking ✅, receita recorrente vs pontual ✅, gráficos de evolução ✅.

- [ ] **Step 3: Write dre-fluxo-caixa.md** — `status: 🟢 concluido`. Tasks: DRE completo ✅, fluxo de caixa ✅, projeções ✅.

- [ ] **Step 4: Write inadimplencia.md** — `status: 🟢 concluido`. Tasks: Dashboard inadimplência ✅, alertas ✅, aging report ✅.

- [ ] **Step 5: Write integracao-conta-azul.md** — `status: 🟢 concluido`. Tasks: sync parcelas ✅, sync bancos ✅, sync clientes ✅.

- [ ] **Step 6: Write nf-processing.md** — `status: 🟡 em-andamento`. Tasks: extração de NF ✅, parsing de dados 🔼 (em progresso), validação automática 🔽 (planejado).

- [ ] **Step 7: Write auto-billing.md** — `status: ⚪ planejado`. Tasks: faturamento por contrato ⏫, integração com Conta Azul 🔼, recorrência automática 🔼.

---

### Task 7: Create 04-Churn-Retencao épicos

**Files:**
- Create: `04-Churn-Retencao/_overview.md` + 5 épico files

- [ ] **Step 1: Write _overview.md** — `status: 🟢 estável`, 4 built, 1 planned.

- [ ] **Step 2: Write dashboard-churn.md** — `status: 🟢 concluido`. Tasks: detalhamento ✅, motivos ✅, timeline ✅.

- [ ] **Step 3: Write predicao-churn.md** — `status: 🟢 concluido`. Tasks: ML risk scores ✅, fatores de risco ✅.

- [ ] **Step 4: Write dashboard-retencao.md** — `status: 🟢 concluido`. Tasks: métricas de retenção ✅, oportunidades ✅.

- [ ] **Step 5: Write relatorio-semanal-churn.md** — `status: 🟢 concluido`. Tasks: geração automática ✅, distribuição ✅.

- [ ] **Step 6: Write alertas-automaticos-risco.md** — `status: ⚪ planejado`. Tasks: notificações proativas de risco ⏫, integração com canal do CS 🔼.

---

### Task 8: Create 05-Comercial épicos

**Files:**
- Create: `05-Comercial/_overview.md` + 6 épico files

- [ ] **Step 1: Write _overview.md** — `status: 🟡 ativo`, 5 built, 1 planned.

- [ ] **Step 2-6: Write each épico** — SDRs/Closers ✅, Vendas/Squads ✅, Metas ✅, OKR 2026 ✅, Margem ✅, Funil realtime ⚪.

---

### Task 9: Create 06-RH-Pessoas épicos

**Files:**
- Create: `06-RH-Pessoas/_overview.md` + 6 épico files

- [ ] **Step 1: Write _overview.md** — `status: 🟢 estável`, all 6 built.

- [ ] **Step 2-7: Write each épico** — Colaboradores ✅, Onboarding ✅, Patrimônio ✅, Férias ✅, Benefícios ✅, Inhire ✅.

---

## Chunk 4: Remaining Domains (07-09) + First ADR

### Task 10: Create 07-Relatorios épicos

**Files:**
- Create: `07-Relatorios/_overview.md` + 5 épico files

- [ ] **Step 1: Write _overview.md** — `status: 🟢 estável`, 4 built, 1 planned.

- [ ] **Step 2-6: Write each épico** — Mensal ✅, Semanal Financeiro ✅, AutoReport ✅, Investors ✅, Performance Cliente ⚪.

---

### Task 11: Create 08-Infra-Seguranca épicos

**Files:**
- Create: `08-Infra-Seguranca/_overview.md` + 5 épico files

- [ ] **Step 1: Write _overview.md** — `status: 🟡 ativo`, 2 built, 1 WIP, 2 planned.

- [ ] **Step 2: Write phase1-sql-injection.md** — `status: 🟢 concluido`.

- [ ] **Step 3: Write phase2-zod-rate-limiting.md** — `status: 🟢 concluido`.

- [ ] **Step 4: Write modularizacao-rotas.md** — `status: 🟡 em-andamento`. Tasks: extrair jurídico ✅, extrair clientes ✅, extrair colaboradores ✅, extrair financeiro 🔼, extrair comercial 🔼, extrair RH 🔽.

- [ ] **Step 5: Write phase3-auth-rbac.md** — `status: ⚪ planejado`.

- [ ] **Step 6: Write monitoramento-alertas.md** — `status: ⚪ planejado`.

---

### Task 12: Create 09-Juridico épicos

**Files:**
- Create: `09-Juridico/_overview.md` + 3 épico files

- [ ] **Step 1: Write _overview.md** — `status: 🟢 estável`, all 3 built.

- [ ] **Step 2-4: Write each épico** — Processos ✅, Assistente AI ✅, Clientes Jurídicos ✅.

---

### Task 13: Create first ADR

**Files:**
- Create: `Decisoes/001-obsidian-como-second-brain.md`

- [ ] **Step 1: Write ADR**

```markdown
---
tipo: decisao
dominio: geral
data: 2026-03-10
status: aceita
---
# ADR-001: Obsidian como Second Brain de Desenvolvimento

## Contexto
O desenvolvimento do Córtex 2.0 cresceu para 90+ páginas e 9 domínios.
Precisávamos de uma forma de visualizar o progresso geral, rastrear
decisões e manter o roadmap organizado fora do código.

## Decisão
Usar o Obsidian como "second brain" de desenvolvimento com:
- Estrutura por domínio (9 pastas)
- Tasks em markdown com formato compatível com Dataview/Tasks
- Claude atualiza automaticamente conforme desenvolve
- ClickUp continua para operação do negócio

## Consequências
- Toda sessão de dev começa lendo o vault para contexto
- Decisões arquiteturais viram ADRs
- Progresso é visível no Dashboard.md via Dataview
```

---

## Chunk 5: Verification

### Task 14: Verify and list all created files

- [ ] **Step 1: List complete vault structure**

```bash
find "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0" -type f -name "*.md" | sort
```

Expected: ~50 markdown files across all directories.

- [ ] **Step 2: Verify frontmatter consistency**

```bash
grep -l "tipo: epico" "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0"/**/*.md | wc -l
```

Expected: ~40 épico files.

- [ ] **Step 3: Instruct user to install Obsidian plugins**

Tell user to install:
1. Dataview (community plugin)
2. Tasks (community plugin)
3. Open Dashboard.md to verify Dataview queries render
