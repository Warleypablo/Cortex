# Tech Hub Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign visual do Tech Hub (3 tabs) + nova página de estatísticas por responsável.

**Architecture:** Rewrite dos 3 componentes de tab (TechOverview, TechProjetos, TechPerformance) com visual mais limpo, e criação de nova página TechResponsavel com rota /tech/responsavel. Backend: 1 novo endpoint para KPIs individuais por PO.

**Tech Stack:** React, TanStack Query, Recharts, Tailwind CSS, shadcn/ui, Express

---

### Task 1: Redesign TechHub.tsx (shell principal)

**Files:**
- Modify: `client/src/pages/TechHub.tsx`

**Step 1: Reescrever o componente**

O shell atual tem 58 linhas. Reescrever com visual mais clean:
- Header mais leve — remover font-bold do h1, usar font-medium text-base
- Tabs mais elegantes — underline style, sem ícones nos triggers (menos ruído)
- Background consistente — usar `bg-background` ao invés de bg-gray-50/bg-zinc-900
- Adicionar link para página de responsáveis no header (botão discreto "Por Responsável →")

**Step 2: Commit**

```bash
git add client/src/pages/TechHub.tsx
git commit -m "style(tech-hub): redesign shell with cleaner header and tabs"
```

---

### Task 2: Redesign TechOverview.tsx

**Files:**
- Modify: `client/src/pages/tech/TechOverview.tsx` (445 linhas)

**Step 1: Reescrever o componente**

Ler o arquivo completo primeiro. Depois reescrever mantendo a mesma lógica de dados mas com visual novo:

**KPIs (topo):** 4 cards em grid, estilo minimalista:
- Cada card: número grande (text-3xl font-light) + label pequeno (text-xs uppercase text-muted-foreground)
- Sem ícones pesados, sem backgrounds coloridos
- Cards: Projetos Ativos, Em Risco, Tempo Médio (dias), Taxa No Prazo (%)

**Pipeline Snapshot:** Barra horizontal única (stacked bar) mostrando % de projetos em cada fase. Abaixo da barra, labels com contagem. Usar cores do PHASE_CONFIG com opacity 0.7.

**Prazo por Status:** Chart horizontal com barras mais finas, cores sutis, sem grid pesado.

**Entregas por Trimestre:** BarChart com barras arredondadas, cores com opacity 0.6.

**Próximos Vencimentos:** Lista compacta (sem card wrapper), apenas dividers entre items. Cada item: nome do projeto, responsável, badge de urgência, data.

**Step 2: Commit**

```bash
git add client/src/pages/tech/TechOverview.tsx
git commit -m "style(tech-hub): redesign overview with cleaner KPIs and pipeline"
```

---

### Task 3: Redesign TechProjetos.tsx + ProjectCard.tsx

**Files:**
- Modify: `client/src/pages/tech/TechProjetos.tsx` (412 linhas)
- Modify: `client/src/components/tech/ProjectCard.tsx` (177 linhas)

**Step 1: Reescrever ProjectCard**

Card mais compacto:
- Remover borda colorida lateral
- Nome do projeto em font-medium (não bold)
- Status como badge pequeno discreto
- Prazo em text-xs text-muted-foreground
- Badge de urgência sutil (apenas dot colorido + texto)
- Padding reduzido (p-3 ao invés de p-4)

**Step 2: Reescrever TechProjetos**

- Filtros em linha (flex row com gaps) — não colapsáveis
- Search input menor e mais discreto
- Kanban com gaps maiores entre colunas
- Header de coluna: nome do PO + contagem, sem card pesado
- Lista view: tabela com linhas mais leves, sem alternância de cor

**Step 3: Commit**

```bash
git add client/src/pages/tech/TechProjetos.tsx client/src/components/tech/ProjectCard.tsx
git commit -m "style(tech-hub): redesign projects tab and card component"
```

---

### Task 4: Redesign TechPerformance.tsx

**Files:**
- Modify: `client/src/pages/tech/TechPerformance.tsx` (325 linhas)

**Step 1: Reescrever o componente**

Ler o arquivo completo. Reescrever com:

- Remover toggle Geral/Por PO (mover "Por PO" para a nova página de responsável)
- Period selector mais discreto (segmented control pequeno no canto superior direito)
- KPIs: 4 cards minimalistas (mesmo estilo do Overview)
- Charts em grid 2 colunas:
  - Col 1: Tempo Deploy por Trimestre (BarChart com barras arredondadas)
  - Col 2: Entregas por Trimestre (BarChart)
- Tempo por Fase: 5 cards horizontais compactos com barra de progresso interna
- Cores dos charts mais sutis (opacity 0.5-0.7)

**Step 2: Commit**

```bash
git add client/src/pages/tech/TechPerformance.tsx
git commit -m "style(tech-hub): redesign performance tab with 2-column chart grid"
```

---

### Task 5: Backend — Endpoint KPIs por responsável

**Files:**
- Modify: `server/routes/tech-hub.ts`

**Step 1: Adicionar endpoint**

```
GET /api/tech/responsavel/:nome/kpis
```

Retorna:
```json
{
  "projetosAtivos": 5,
  "projetosConcluidos": 12,
  "tempoMedioDeploy": 23.5,
  "taxaNoPrazo": 85.0,
  "carga": "media",
  "projetosAtivosList": [
    { "taskName": "...", "statusProjeto": "...", "faseProjeto": "...", "dataVencimento": "...", "urgencia": "no_prazo" }
  ]
}
```

Lógica:
- projetosAtivos: COUNT de cup_projetos_tech WHERE responsavel = :nome
- projetosConcluidos: COUNT de cup_projetos_tech_fechados WHERE responsavel = :nome
- tempoMedioDeploy: reutilizar lógica de /api/tech/tempo-deploy com filtro
- taxaNoPrazo: (ativos - atrasados) / ativos * 100
- carga: >7 = "alta", 4-7 = "media", <4 = "ok"
- projetosAtivosList: lista com classificação de urgência

**Step 2: Commit**

```bash
git add server/routes/tech-hub.ts
git commit -m "feat(tech-hub): add responsavel KPIs endpoint"
```

---

### Task 6: Nova página TechResponsavel.tsx

**Files:**
- Create: `client/src/pages/TechResponsavel.tsx`
- Modify: `client/src/App.tsx` (adicionar rota)

**Step 1: Criar a página**

**Header:**
- Título "Estatísticas por Responsável"
- Botão "← Tech Hub" para voltar
- Select de responsável (buscar lista de POs do /api/tech/board)

**Seção 1 — KPIs (4 cards grid):**
- Projetos Ativos, Concluídos, Tempo Médio Deploy, Taxa No Prazo
- Mesmo estilo minimalista do Overview (text-3xl font-light)
- Indicador de carga com badge (Alta = vermelho, Média = amarelo, OK = verde)

**Seção 2 — Projetos Ativos:**
- Lista/tabela dos projetos do PO selecionado
- Colunas: Nome, Status, Fase, Prazo, Urgência
- Cada linha clicável (navega para detalhe ou abre drawer)

**Seção 3 — Performance Histórica (grid 2 colunas):**
- Chart 1: Entregas por trimestre (BarChart) — dados de /api/tech/entregas-trimestre filtrado
- Chart 2: Tempo médio deploy por trimestre (BarChart) — dados de /api/tech/tempo-deploy?responsavel=

**Seção 4 — Tempo por Fase:**
- Barras horizontais mostrando média de dias em cada fase
- Dados de /api/tech/prazo-por-status?responsavel=

**Step 2: Adicionar rota no App.tsx**

Adicionar `<Route path="/tech/responsavel" component={TechResponsavel} />`.

**Step 3: Commit**

```bash
git add client/src/pages/TechResponsavel.tsx client/src/App.tsx
git commit -m "feat(tech-hub): add responsavel statistics page"
```
