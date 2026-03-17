# Dashboard Design System — Spec

**Data:** 2026-03-17
**Status:** Aprovado
**Escopo:** Guia para criacao e reestruturacao de dashboards no Cortex (exceto Comercial por enquanto)

---

## 1. Objetivo

Criar um sistema de design de dashboards que garanta consistencia visual, minimalismo e boas praticas por dominio. O sistema vive em dois lugares:

- **Obsidian** (`Cortex 2.0/`) — referencia humana com principios e regras
- **Agent** (`agents/dashboard-design-SKILL.md`) — skill que o Claude consulta antes de criar/editar qualquer dashboard

**Referencia visual:** Apple Health / Numbers — minimalista, cor estrategica apenas para dados, fundo neutro.

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

- Cor e semantica, nao decorativa:
  - Verde: positivo / dentro da meta
  - Vermelho: negativo / fora da meta
  - Ambar: atencao / limitrofe
  - Cinza: neutro / sem julgamento
- Sem gradientes em cards. Background solido: `bg-white dark:bg-zinc-900`
- Sem backdrop-blur
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

### 3.2 Charts (Recharts)

- `ResponsiveContainer` com `height={300}` padrao
- Grid lines apenas horizontais, cor sutil
- Sem eixo Y visivel quando valores estao no tooltip
- Tooltip customizado com fundo solido, sem transparencia
- Maximo 2 series por grafico
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
- Anti-pattern: grafico de pizza para composicao de receita

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

## 6. Anti-Patterns Globais

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

## 7. Checklist de Review (Pre-Deploy)

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

## 8. Entregaveis

1. **Agent Skill** — `agents/dashboard-design-SKILL.md` (Claude consulta antes de criar/editar dashboards)
2. **Doc Obsidian** — `Cortex 2.0/Templates/dashboard-design-system.md` (referencia humana)
3. **Reestruturacao progressiva** — dashboards existentes (exceto Comercial) refatorados seguindo este sistema
