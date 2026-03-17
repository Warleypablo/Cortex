# Dashboard Design System — Spec

**Data:** 2026-03-17
**Status:** Aprovado
**Escopo:** Guia para criacao e reestruturacao de dashboards no Cortex

---

## 1. Objetivo

Criar um sistema de design de dashboards que garanta consistencia visual, minimalismo e boas praticas por dominio. O sistema vive em dois lugares:

- **Obsidian** (`Cortex 2.0/`) — referencia humana com principios e regras
- **Agent** (`agents/dashboard-design-SKILL.md`) — skill que o Claude consulta antes de criar/editar qualquer dashboard

**Referencia visual:** Apple Health / Numbers — minimalista, cor estrategica apenas para dados, fundo neutro.

### 1.1 Fora de Escopo (fase 1)

As seguintes paginas NAO serao reestruturadas nesta fase:

- `DashboardClosers.tsx` — Closers (comercial)
- `DashboardSDRs.tsx` — SDRs (comercial)
- `DetailClosers.tsx` — Detalhe Closer (comercial)
- `DetailSDRs.tsx` — Detalhe SDR (comercial)
- `AnaliseVendas.tsx` — Analise de Vendas (comercial)
- `DetalhamentoVendas.tsx` — Detalhamento de Vendas (comercial)
- `ComercialReunioes.tsx` — Reunioes Comerciais (comercial)
- `FunilVendas.tsx` — Funil de Vendas (comercial)
- `RevenueGoals.tsx` — Metas de Receita (comercial)

---

## 2. Principios Visuais Base

### 2.1 Filosofia: "Dados respiram"

Cada elemento na tela deve justificar sua existencia. Se remover algo e ninguem sentir falta, nao deveria estar la.

### 2.2 Hierarquia Visual (3 niveis)

| Nivel | O que e | Tratamento |
|-------|---------|------------|
| **Hero** | 1-3 metricas principais da tela | Fonte grande (2xl-3xl), posicao topo, sem card container — so numero + label |
| **Supporting** | 3-6 metricas complementares | Cards compactos, fonte medium, grid de 3 ou 4 colunas |
| **Detail** | Tabelas, breakdowns, drill-downs | Abaixo do fold, acessivel mas nao competindo com o hero |

**Regra de ouro:** Nenhuma tela deve ter mais de **8 KPIs visiveis** sem scroll.

### 2.3 Paleta e Cor

Cor e semantica, nao decorativa. Tokens exatos:

| Semantica | Light | Dark | Uso |
|-----------|-------|------|-----|
| Positivo | `text-emerald-600` / `bg-emerald-50` | `text-emerald-400` / `bg-emerald-950/30` | Trends positivos, dentro da meta |
| Negativo | `text-red-600` / `bg-red-50` | `text-red-400` / `bg-red-950/30` | Trends negativos, fora da meta |
| Atencao | `text-amber-600` / `bg-amber-50` | `text-amber-400` / `bg-amber-950/30` | Zona de risco, limitrofe |
| Neutro | `text-gray-600` / `bg-gray-50` | `text-zinc-400` / `bg-zinc-800/30` | Informativo, sem julgamento |
| Borda semantica (card left) | `border-l-3 border-{color}-500` | `border-l-3 border-{color}-400` | Variante de StatsCard |
| Background card | `bg-white` | `bg-zinc-900` | Todos os cards |
| Background pagina | `bg-gray-50` | `bg-zinc-950` | Fundo geral |
| Borda card | `border-gray-100` | `border-zinc-800` | Contorno de cards |

- Sem gradientes em cards. Background solido.
- Sem backdrop-blur.
- Charts: Uma cor primaria + cinza para comparacao. Maximo 3 cores por grafico.

### 2.4 Espacamento e Densidade

- Gap entre secoes: `gap-6` (24px)
- Gap dentro de grids de cards: `gap-4` (16px)
- Padding interno de cards: `p-5` (20px)
- Sem hover scale/shadow animations em elementos informativos
- Border radius uniforme: `rounded-lg`

### 2.5 Tipografia

- Hero values: `text-2xl font-semibold`
- Card values: `text-lg font-medium`
- Labels: `text-xs font-medium text-muted-foreground uppercase tracking-wide`
- Sem icones decorativos nos cards

---

## 3. Regras de Componentes

### 3.0 HeroMetric (novo componente)

Numero grande no topo da pagina, sem card container. Props:

```tsx
interface HeroMetricProps {
  label: string;         // ex: "MRR Total"
  value: string;         // ex: "R$ 487.230"
  trend?: {
    value: string;       // ex: "+3,2%"
    isPositive: boolean;
  };
  format?: "currency" | "percent" | "number"; // para formatacao automatica
}
```

**Styling:**
```tsx
<div className="flex flex-col">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    {label}
  </p>
  <p className="text-2xl sm:text-3xl font-semibold text-foreground mt-1">
    {value}
  </p>
  {trend && (
    <span className={cn(
      "text-sm font-medium mt-1",
      trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
    )}>
      {trend.isPositive ? "▲" : "▼"} {trend.value}
    </span>
  )}
</div>
```

**Layout dos heroes:** `flex items-start gap-12` em desktop, `grid grid-cols-1 gap-4` em mobile. Sem wrapper Card, direto no fundo da pagina.

### 3.1 StatsCard (reformulado)

**Estrutura visual:**
```
┌─────────────────────────┐
│  LABEL DO KPI           │
│  R$ 142.350             │
│  ▲ 3,2% vs mes anterior │
└─────────────────────────┘
```

**Eliminar:** icone decorativo, gradientes de background, backdrop-blur, hover:scale, overlay transparente.

**Manter:** trend indicator (cor semantica), tooltip com subtitle, variantes semanticas via borda esquerda colorida de 3px.

**Styling:** `bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg p-5`

**Nova interface de props:**
```tsx
interface StatsCardProps {
  title: string;
  value: string;
  trend?: { value: string; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "error";  // sem "info" e "status"
  subtitle?: string;        // tooltip content
}
// REMOVIDOS: icon, tooltipType, animateValue, rawValue, formatValue, statusActive
```

**Estrategia de migracao:**
1. Criar `StatsCardV2.tsx` com a nova interface (sem breaking changes no existente)
2. Migrar dashboards progressivamente, um por vez, substituindo import
3. Ao fim de cada dominio, verificar se nenhuma pagina ainda usa o StatsCard antigo
4. Quando 100% migrado, remover `StatsCard.tsx` e renomear V2 para StatsCard

### 3.2 Charts (Recharts)

- `ResponsiveContainer` com `height={300}` padrao
- Grid lines apenas horizontais, cor sutil
- Sem eixo Y visivel quando valores estao no tooltip
- Tooltip customizado:
  ```tsx
  className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700
             rounded-lg shadow-lg p-3 text-sm text-foreground"
  // Conteudo: label em text-xs text-muted-foreground, valor em font-medium
  ```
- Limites de series por tipo de grafico:
  - Line/Area charts: maximo 2 series
  - Stacked bar charts: maximo 3 series (ex: saudavel/atencao/critico)
  - Heatmaps: sem limite de series (sao dados tabulares)
- Legendas abaixo do grafico, inline, `text-xs text-muted-foreground`

### 3.3 Tabelas

- Header fixo com `sticky top-0`
- Linhas alternadas sutis: `even:bg-gray-50/50 dark:even:bg-zinc-800/30`
- Sem bordas verticais entre colunas — apenas `border-b` entre linhas
- Acoes via icone discreto no final da linha
- Paginacao ou virtualizacao obrigatoria acima de 20 linhas

### 3.4 Filtros

- Posicao: linha unica no topo, abaixo do titulo da pagina
- Maximo 4 filtros visiveis. Mais → botao "Mais filtros" com drawer/popover
- Estado padrao inteligente (mes atual, todos os squads, etc.)
- Botao "Limpar" visivel apenas quando ha filtros ativos

---

## 4. Layout de Pagina (Anatomia)

```
┌──────────────────────────────────────────────┐
│  Titulo da Pagina          [Filtro1] [Filtro2]│
├──────────────────────────────────────────────┤
│  HERO METRICS (1-3 numeros grandes)          │
│  R$ 487k        12,4%        R$ 38k          │
│  MRR Total      NRR          Churn MRR       │
├──────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Support │ │ Support │ │ Support │        │
│  │ Card 1  │ │ Card 2  │ │ Card 3  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
├──────────────────────────────────────────────┤
│  Chart principal (evolucao / composicao)     │
├──────────────────────────────────────────────┤
│  Tabela de detalhamento                      │
└──────────────────────────────────────────────┘
```

### Regras de layout

- Fluxo top-down: Resumo → Contexto → Detalhe. Nunca o inverso.
- Hero metrics sem container/card wrapper.
- Uma secao de chart por viewport. Se ha 2 charts, grid-cols-2. Se ha 3+, repensar.
- Tabela sempre por ultimo.
- Sem tabs para esconder conteudo. Excecao: tabs para alternar perspectiva dos mesmos dados (ex: MRR vs quantidade).

### Responsividade

- Desktop (lg+): Grid de 3-4 colunas para supporting cards
- Tablet (md): Grid de 2 colunas
- Mobile (sm): Stack vertical, hero metrics em 1 coluna

---

## 5. Regras por Dominio

### 5.1 Financeiro (DFC, Fluxo de Caixa, DRE, Inadimplencia)

**Hero metrics:** Receita Liquida, Resultado do Periodo, Saldo em Caixa

- Numeros financeiros com formatacao monetaria completa nos heroes (`R$ 142.350,00`)
- Valores abreviados (`R$ 142k`) apenas em cards supporting e tooltips
- Vermelho = negativo / despesa acima do orcado. Ambar se caiu mas ainda positivo.
- DRE e DFC: tabelas hierarquicas colapsiveis, nao cards
- Comparativo orcado vs realizado: barra horizontal dupla
- Anti-pattern: grafico de pizza para composicao de receita. Substituir por:
  - Composicao de receita (recorrente/pontual) → barra horizontal empilhada
  - Composicao de despesas por categoria → tabela hierarquica colapsivel

### 5.2 Growth (Ads, Funil, Plataformas, Keywords)

**Hero metrics:** ROAS, CAC, Investimento Total

- Funil de conversao: barra horizontal decrescente com taxas entre etapas
- Metricas de plataforma em tabela comparativa, nao cards separados
- Budget burn: barra de progresso simples (% consumido)
- Periodo padrao: ultimos 30 dias
- Anti-pattern: impressoes/cliques como hero metrics (vanity metrics)

### 5.3 Operacoes (MRR, Churn, Retencao, Squads, Saude da Base)

**Hero metrics:** MRR Total, Churn Rate (%), NRR (%)

- Evolucao de MRR: area chart com linha de tendencia
- Churn: separar churned MRR de churned logos
- Cohort de retencao: heatmap com % por mes de entrada
- Squads: ranking por MRR, tabela com sparkline
- Saude da base: barras horizontais empilhadas (saudavel/atencao/critico)
- Anti-pattern: listar todos os contratos churned na tela principal

### 5.4 Tech (Projetos, Capacity, Status)

**Hero metrics:** Projetos Ativos, % On-Time, Capacity Utilizada

- Cards de projeto: titulo + status badge + deadline + barra de progresso
- Timeline horizontal para marcos
- Status com 3 estados: no prazo (verde), atencao (ambar), atrasado (vermelho)
- Capacity: barra empilhada por pessoa/squad
- Anti-pattern: drawer/modal complexo para detalhes de projeto

### 5.5 RH/Pessoas (GeG, Recrutamento, Colaboradores)

**Hero metrics:** Headcount, Turnover (%), Vagas Abertas

- Recrutamento: funil simples (candidatos → entrevistas → ofertas → contratados)
- Analise de colaboradores: tabela com filtros, nao cards individuais
- Satisfacao/engajamento: numero unico com trend
- Anti-pattern: dashboard com foto de cada colaborador

---

## 6. Estados (Loading / Error / Empty)

Toda pagina de dashboard deve tratar 3 estados alem do happy path:

### Loading
- Hero metrics: `<Skeleton className="h-8 w-32" />` (um por hero)
- Supporting cards: `<Skeleton className="h-24 rounded-lg" />` dentro do grid
- Charts: `<Skeleton className="h-[300px] rounded-lg" />`
- Tabelas: 5 linhas de `<Skeleton className="h-4" />` com larguras variadas

### Error
- Substituir a secao afetada por:
  ```tsx
  <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm">
    <AlertTriangle className="w-4 h-4 shrink-0" />
    <span>Erro ao carregar dados. Tente novamente.</span>
  </div>
  ```
- Nunca quebrar a pagina inteira por erro de uma secao. Isolar falhas.

### Empty (sem dados para o periodo)
- Substituir chart/tabela por:
  ```tsx
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
    <p className="text-sm">Sem dados para o periodo selecionado.</p>
  </div>
  ```
- Heroes e supporting cards: mostrar "—" no lugar do valor, sem trend.

---

## 7. Acessibilidade (minimo)

- Contraste: todos os textos devem ter ratio >= 4.5:1 contra o background (WCAG AA)
- Trend indicators: nunca depender apenas de cor. Usar simbolo (▲/▼) + cor
- Filtros e botoes: `aria-label` descritivo quando o texto visual nao e suficiente
- Tabelas: usar `<th scope="col">` nos headers
- Charts: incluir `aria-label` descritivo no container do grafico (ex: "Grafico de evolucao do MRR nos ultimos 12 meses")
- Tooltips: acessiveis via keyboard focus (ja garantido pelo radix/shadcn)

---

## 8. Anti-Patterns Globais

| Anti-Pattern | Substituir por |
|---|---|
| Gradientes em backgrounds de cards | Background solido com opacidade |
| `backdrop-blur` | Background opaco |
| `hover:scale` em cards informativos | Hover sutil apenas em elementos clicaveis |
| Icone decorativo em todo card | Remover. Usar icone so se e acao ou status |
| Mais de 8 KPIs sem scroll | Priorizar, mover resto para drill-down |
| Count-up animation em valores | Renderizar valor final direto |
| Grafico de pizza/donut | Barra horizontal ou tabela |
| Tabs para esconder secoes inteiras | Paginas separadas ou scroll vertical |
| Multiplos DatePickers na mesma tela | Um filtro de periodo global por pagina |
| Cards com borda + shadow + gradient | Escolher UM: borda sutil OU shadow leve |
| Emojis em titulos/labels | Texto limpo, badge de status se necessario |

---

## 9. Checklist de Review (Pre-Deploy)

### Hierarquia
- [ ] Maximo 3 hero metrics?
- [ ] Supporting cards <= 6?
- [ ] Fluxo top-down (resumo → contexto → detalhe)?

### Visual
- [ ] Zero gradientes em cards?
- [ ] Zero backdrop-blur?
- [ ] Zero hover:scale em nao-interativos?
- [ ] Cores apenas com significado semantico?
- [ ] Maximo 3 cores por grafico?

### Dados
- [ ] Cada KPI justifica sua presenca?
- [ ] Sem metricas redundantes?
- [ ] Filtros com defaults inteligentes?
- [ ] Tabelas com paginacao se >20 linhas?

### Consistencia
- [ ] Valores monetarios formatados corretamente?
- [ ] Labels em uppercase + tracking-wide?
- [ ] Espacamento: gap-6 entre secoes, gap-4 dentro de grids?
- [ ] Funciona em dark e light mode?
- [ ] Responsivo em sm/md/lg?

### Dominio
- [ ] Segue regras especificas do dominio?
- [ ] Hero metrics corretos para o dominio?
- [ ] Nenhum anti-pattern do dominio presente?

---

## 10. Estrategia de Migracao

### Fase 0: Fundacao
1. Criar componente `HeroMetric.tsx`
2. Criar componente `StatsCardV2.tsx`
3. Criar componente `ChartTooltip.tsx` padronizado

### Fase 1: Operacoes (prioridade alta — dashboards mais usados)
1. `VisaoGeral.tsx`
2. `EvolucaoMensal.tsx`
3. `ChurnDetalhamento.tsx`
4. `ChurnPredicao.tsx`
5. `DashboardRetencao.tsx`
6. `SaudeBaseAtiva.tsx`

### Fase 2: Financeiro
1. `DashboardFinanceiro.tsx`
2. `DashboardDFC.tsx`
3. `FluxoCaixa.tsx`
4. `DRE.tsx`
5. `DashboardInadimplencia.tsx`
6. `NotasFiscais.tsx`

### Fase 3: Growth
1. `GrowthVisaoGeral.tsx`
2. `GrowthOrcadoRealizado.tsx`
3. `PerformancePlataformas.tsx`
4. `FunilConversaoGrowth.tsx`
5. `KeywordPerformance.tsx`
6. `Criativos.tsx`

### Fase 4: Tech + RH
1. `TechHub.tsx`
2. `Capacity.tsx`
3. `DashboardGeG.tsx`
4. `DashboardRecrutamento.tsx`
5. `DashboardInhire.tsx`

### Fase 5: Cleanup
1. Remover `StatsCard.tsx` antigo (quando 0 imports restantes)
2. Renomear `StatsCardV2` → `StatsCard`
3. Remover `useCountUpNumber` hook se nao usado em nenhum lugar

**Definition of done por dashboard:** Checklist da secao 9 100% marcado + funciona em dark/light mode + sem regressao visual.

---

## 11. Entregaveis

1. **Agent Skill** — `agents/dashboard-design-SKILL.md` (Claude consulta antes de criar/editar dashboards)
2. **Doc Obsidian** — `Cortex 2.0/Templates/dashboard-design-system.md` (referencia humana)
3. **Componentes base** — `HeroMetric.tsx`, `StatsCardV2.tsx`, `ChartTooltip.tsx`
4. **Reestruturacao progressiva** — 5 fases, dashboards existentes (exceto Comercial) refatorados seguindo este sistema
