# Tech Hub Redesign — Design Spec

## Resumo

Redesign completo da área de Tech do Cortex, consolidando em um **Hub centralizado** com 4 seções (Overview, Board, Projetos, Performance). Requer captura de histórico de status e comentários do ClickUp para habilitar métricas de prazo por status, timeline de contexto e detecção de bloqueios.

## Motivação

A área tech atual tem 4 páginas independentes (Dashboard, Projetos, Evolução, Financeiro) que não atendem às necessidades de:
- Acompanhar prazo real (a partir de "pronto para design")
- Visualizar tempo gasto em cada fase
- Ver contexto de projeto (comentários, bloqueios)
- Distribuir projetos por PO em formato board
- Medir performance de entrega por trimestre

## Requisitos

| # | Requisito | Fonte |
|---|-----------|-------|
| R1 | Prazo começa de "pronto para design" | Histórico de status (ClickUp API) |
| R2 | Prazo por status — tempo em cada fase | `cup_status_history` (nova tabela) |
| R3 | Comentários do projeto com contexto | `cup_comentarios` (nova tabela, ClickUp API) |
| R4 | Board Kanban por responsável (PO) | `cup_projetos_tech` agrupado por `responsavel` |
| R5 | Prazo Contrato e Lançamento Previsto | Custom fields ClickUp (já sincronizados) |
| R6 | Entregas por trimestre | Agregação de `cup_projetos_tech_fechados` |
| R7 | Tempo deploy por trimestre (geral + PO) | Calculado: "pronto p/ design" → "done" |
| R8 | Extração de tags de comentários (bloqueios, pendências) | Parsing de texto dos comentários |

## Arquitetura de Dados

### Tabelas Existentes (Referência)

#### `"Clickup".cup_projetos_tech` / `cup_projetos_tech_fechados`

Ambas com schema idêntico (abertos vs fechados):

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `clickup_task_id` | TEXT | PK — ID da task no ClickUp |
| `task_name` | TEXT | Nome do projeto |
| `status_projeto` | TEXT | Status atual (kickoff, design, dev, review, qa, deploy, done, closed) |
| `prioridade` | TEXT | Prioridade (urgente, alta, normal, baixa) |
| `data_vencimento` | TEXT | Data de vencimento (ISO string) |
| `lancamento` | TEXT | Data de lançamento previsto (custom field) |
| `tempo_total` | TEXT | Estimativa de horas (custom field) |
| `responsavel` | TEXT | Username do responsável no ClickUp |
| `fase_projeto` | TEXT | Fase do projeto (custom field dropdown) |
| `tipo` | TEXT | Tipo de projeto (custom field dropdown) |
| `tipo_projeto` | TEXT | Categoria do projeto (custom field) |
| `figma` | TEXT | Link do Figma (custom field URL) |
| `valor_p` | TEXT | Valor pontual em centavos (custom field currency) |
| `data_inicial` | TEXT | Data de início |
| `data_criada` | TEXT | Data de criação da task |
| `data_entregue` | TEXT | Data de entrega (custom field, projetos fechados) |

### Novas Tabelas

#### `"Clickup".cup_status_history`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | PK |
| `clickup_task_id` | TEXT | FK para o projeto |
| `status_anterior` | TEXT | Status de onde saiu (NULL para primeiro status) |
| `status_novo` | TEXT | Status para onde foi |
| `data_transicao` | TIMESTAMP | Quando mudou |
| `duracao_ms` | BIGINT | Tempo no status anterior em milissegundos (direto da API) |

**Transformação da API:** O endpoint `GET /task/bulk_time_in_status/task_ids` retorna por task um objeto `{status_id: {total_time: ms, orderindex, status_history: [{status, total_time, orderindex}]}}`. Para popular a tabela:
1. Para cada task, iterar a `status_history` de cada status
2. Ordenar todas as entradas por `orderindex` para reconstruir a sequência de transições
3. Mapear `status_id` para `status_name` usando o mapeamento de statuses da lista ClickUp
4. Cada par consecutivo (status_n, status_n+1) gera uma row: `status_anterior=status_n`, `status_novo=status_n+1`, `duracao_ms=total_time` do status_n

**Estratégia de sync:** TRUNCATE + re-insert (mesmo padrão das tabelas existentes). Sem dados manuais a preservar.

#### `"Clickup".cup_comentarios`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | PK |
| `clickup_task_id` | TEXT | FK para o projeto |
| `clickup_comment_id` | TEXT | UNIQUE — ID único do comentário no ClickUp |
| `autor` | TEXT | Quem comentou |
| `texto` | TEXT | Conteúdo do comentário |
| `data_criacao` | TIMESTAMP | Data de criação |
| `tags_extraidas` | TEXT[] | Tags detectadas por parsing |

**Constraint:** UNIQUE em `clickup_comment_id`. Sync usa `INSERT ... ON CONFLICT (clickup_comment_id) DO UPDATE` para deduplicação em re-syncs.

**Limitação conhecida:** A API de comentários do ClickUp (`GET /task/{task_id}/comment`) retorna apenas comentários top-level, não replies/threads. Comentários em threads não serão capturados. Isso é uma limitação da API e não impacta o fluxo principal.

### Sync Ampliado

O sync atual (`POST /api/tech/sync-clickup`) será expandido com **estratégia de rate limiting**:

**Volumes:** ~29 projetos abertos + ~472 fechados = ~501 tasks. ClickUp rate limit: 100 req/min.

**Estratégia:**
1. **Status History** — usar endpoint **bulk** `GET /task/bulk_time_in_status/task_ids` (aceita até 100 task IDs por request). Para 501 tasks = ~6 requests (em vez de 501). Truncate + re-insert.
2. **Comentários** — `GET /task/{task_id}/comment` (não há bulk endpoint). **Sync apenas projetos abertos** (~29 requests) no sync regular. Backfill histórico de fechados pode ser feito uma vez manualmente. Paginação: iterar com `start` + `start_id` até não haver mais resultados (max 25 por página).
3. **Tags** — parsing case-insensitive aplicado no momento do insert/upsert.
4. **Rate limiting** — batch de 80 requests com pause de 65s entre batches. Para sync regular (abertos): ~29 comments requests + 1 bulk status = ~30 requests total, sem necessidade de throttle.
5. **Campo `prazo_real`** — calculado a partir da data de entrada em "pronto para design" (history) até data de entrega ou NOW().

### Novos Endpoints

| Endpoint | Método | Params | Retorno |
|----------|--------|--------|---------|
| `/api/tech/board` | GET | `?status=&tipo=&prioridade=` | Projetos agrupados por `responsavel` com status, prazos, alertas, tags |
| `/api/tech/projeto/:id/historico` | GET | `?tipo=tudo\|comentarios\|status\|bloqueios` | Timeline: transições + comentários intercalados, ordenados por data |
| `/api/tech/projeto/:id/comentarios` | GET | — | Comentários com tags extraídas |
| `/api/tech/prazo-por-status` | GET | `?responsavel=` | Tempo médio em cada status. Sem filtro = geral; com filtro = por PO |
| `/api/tech/entregas-trimestre` | GET | `?meses=12` | Projetos entregues agrupados por trimestre. `meses` define janela (default 12) |
| `/api/tech/tempo-deploy` | GET | `?meses=12&responsavel=` | Tempo "pronto p/ design" → "done" por trimestre. Filtro opcional por PO |

**Erros:** Todos os endpoints retornam `{ error: string }` com status HTTP adequado (400, 404, 500). Sync retorna progresso parcial em caso de falha.

## Layout — Hub Centralizado

Página única (`/tech`) com sidebar interna de 4 seções.

### 1. Overview

- **5 KPIs**: Projetos Ativos, Em Risco, Tempo Médio, Taxa No Prazo %, Bloqueios Ativos
- **Prazo por Status (média)**: barras horizontais com tempo médio em Design/Dev/Review/QA/Deploy
- **Entregas por Trimestre**: barras verticais por quarter
- **Próximos Vencimentos**: lista ordenada por urgência (vermelho/amarelo/verde)

### 2. Board (Kanban por PO)

- **Colunas**: uma por responsável com iniciais (geradas do username, sem avatar externo), nome, contagem e indicador de carga
- **Filtros no topo**: Status, Tipo, Prioridade (passados como query params ao endpoint `/api/tech/board`)
- **Cards**: nome do projeto, fase atual (badge), prazo contrato + lançamento previsto, barra de progresso do prazo, alertas de bloqueio
- **Cor da borda lateral**: verde (no prazo), amarelo (em risco <3 dias), vermelho (atrasado)
- **Click no card**: abre drawer de detalhe (mesma view da seção Projetos)

### 3. Projetos (Lista + Drawer)

- **Lista à esquerda**: filtros (responsável, status, tipo), busca por nome, toggle abertos/fechados
- **Drawer lateral** ao clicar:
  - **Meta cards**: Prazo Contrato, Lançamento Previsto, Tempo Total
  - **Prazo por Status**: barra stacked horizontal com dias em cada fase
  - **Timeline unificada**: comentários + mudanças de status + bloqueios intercalados cronologicamente
  - **Filtros na timeline**: Tudo / Comentários / Status / Bloqueios

### 4. Performance

- **Toggle**: Geral / Por PO
- **Seletor de período**: 6, 12, 24 meses (define a janela; trimestres são calculados a partir dos últimos N meses completos — ex: "12 meses" = últimos 4 trimestres completos mais o trimestre atual parcial)
- **4 KPIs**: Tempo Médio Deploy, Entregas no Trimestre (atual), Taxa No Prazo, Gargalo Principal (fase com maior % do ciclo)
- **Tempo Deploy por Trimestre**: barras comparativas por quarter (trimestre atual com borda tracejada = parcial)
- **Entregas por Trimestre**: volume por quarter
- **Tempo Deploy por PO**: barras horizontais com iniciais, dias e variação % vs trimestre anterior
- **Tempo Médio por Fase**: 5 cards (Design/Dev/Review/QA/Deploy) com dias, % do ciclo, tendência e destaque de gargalo

## Regras de Negócio

### Cálculo de Prazo
- **Início do prazo**: data da primeira transição para "pronto para design" em `cup_status_history`
- **Fim do prazo**: `data_entregue` (projetos fechados) ou NOW() (projetos abertos)
- **Tempo deploy**: diferença em **dias corridos** entre início e fim (não dias úteis — simplifica cálculo e evita ambiguidade de calendário de feriados)

### Classificação de Urgência (Cards)
- **Atrasado** (vermelho): data atual > data_vencimento
- **Em risco** (amarelo): faltam ≤3 dias corridos para data_vencimento
- **No prazo** (verde): faltam >3 dias

### Indicador de Carga por PO
- **Alta**: >7 projetos ativos
- **Média**: 4-7 projetos ativos
- **OK**: <4 projetos ativos

### Extração de Tags dos Comentários
Parsing case-insensitive no texto do comentário:
- `bloqueio`: "bloqueio", "bloqueado", "impedimento", "impedido"
- `pendencia_cliente`: "pendência", "aguardando cliente", "aguardando aprovação"
- `alerta`: "atraso", "risco", "urgente", "crítico"

## Componentes Frontend

| Componente | Descrição |
|------------|-----------|
| `TechHub.tsx` | Página principal com sidebar + router interno (tabs state) |
| `TechOverview.tsx` | Seção Overview (KPIs, prazo por status, entregas, vencimentos) |
| `TechBoard.tsx` | Seção Board (Kanban por PO) |
| `TechProjetos.tsx` | Seção Projetos (lista + drawer) — reescreve o existente |
| `TechPerformance.tsx` | Seção Performance (métricas trimestrais) |
| `ProjectDrawer.tsx` | Drawer lateral de detalhe do projeto |
| `ProjectCard.tsx` | Card do projeto (usado no Board e na Lista) |
| `StatusTimeline.tsx` | Timeline unificada (comentários + status + bloqueios) |
| `PrazoStatusBar.tsx` | Barra stacked de prazo por status |

**Todos os componentes devem suportar dark/light mode** usando classes Tailwind `dark:` conforme padrão do projeto (CLAUDE.md).

## Migração

- Manter rotas legadas (`/dashboard/tech`, `/tech/projetos`, `/tech/evolucao`, `/tech/financeiro`) redirecionando para `/tech` com query param indicando a seção. Remover redirects quando confirmado que nenhum link externo aponta para as rotas antigas (decisão manual futura).
- Endpoints existentes podem ser mantidos; novos endpoints são aditivos
- Tabelas existentes (`cup_projetos_tech`, `cup_projetos_tech_fechados`) não sofrem alterações

## Wireframes

Wireframes detalhados em `.superpowers/brainstorm/11410-1773424362/`:
- `tech-hub-layout.html` — Overview
- `tech-hub-board.html` — Board Kanban
- `tech-hub-projetos.html` — Projetos + Drawer
- `tech-hub-performance.html` — Performance
