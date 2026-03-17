# Dashboard Design Skill

> **Quando usar:** ANTES de criar ou editar qualquer dashboard no Cortex.
> **Escopo:** Todos os dashboards exceto Comercial (Closers, SDRs, Vendas, Reunioes, Funil, RevenueGoals).
> **Spec completa:** `docs/superpowers/specs/2026-03-17-dashboard-design-system.md`

---

## Filosofia: "Dados respiram"

Cada elemento na tela deve justificar sua existencia. Se remover algo e ninguem sentir falta, nao deveria estar la. Referencia visual: Apple Health / Numbers.

---

## Hierarquia Visual (3 niveis)

| Nivel | Quantidade | Tratamento |
|-------|-----------|------------|
| **Hero** | 1-3 metricas | `text-2xl font-semibold`, sem card container, topo da pagina |
| **Supporting** | 3-6 metricas | Cards compactos `text-lg font-medium`, grid 3-4 colunas |
| **Detail** | Tabelas/breakdowns | Abaixo do fold, paginacao obrigatoria >20 linhas |

**Limite:** Maximo 8 KPIs visiveis sem scroll.

---

## Paleta e Cor (tokens exatos)

| Semantica | Light | Dark |
|-----------|-------|------|
| Positivo | `text-emerald-600` / `bg-emerald-50` | `text-emerald-400` / `bg-emerald-950/30` |
| Negativo | `text-red-600` / `bg-red-50` | `text-red-400` / `bg-red-950/30` |
| Atencao | `text-amber-600` / `bg-amber-50` | `text-amber-400` / `bg-amber-950/30` |
| Neutro | `text-gray-600` / `bg-gray-50` | `text-zinc-400` / `bg-zinc-800/30` |
| Card bg | `bg-white` | `bg-zinc-900` |
| Card border | `border-gray-100` | `border-zinc-800` |
| Borda semantica | `border-l-3 border-{color}-500` | `border-l-3 border-{color}-400` |

- Charts: 1 cor primaria + cinza. Max 3 cores por grafico.

---

## Componentes

### HeroMetric (novo)

```tsx
// Numero grande sem card container, direto no fundo da pagina
<div className="flex flex-col">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</p>
  <p className="text-2xl sm:text-3xl font-semibold text-foreground mt-1">R$ 487.230</p>
  <span className="text-sm font-medium mt-1 text-emerald-600 dark:text-emerald-400">▲ 3,2%</span>
</div>

// Layout: flex items-start gap-12 (desktop), grid grid-cols-1 gap-4 (mobile)
```

### StatsCard (usar StatsCardV2 para novos dashboards)

```tsx
// CORRETO
<div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg p-5">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</p>
  <p className="text-lg font-medium text-foreground mt-1">R$ 142.350</p>
  {trend && <TrendBadge />}
</div>
```

**PROIBIDO:**
- `bg-gradient-to-*` (gradientes)
- `backdrop-blur-*`
- `hover:scale-*`
- Icone decorativo a esquerda
- `useCountUpNumber` (animacao de contagem)
- Overlay transparente

**Variantes semanticas:** borda esquerda 3px (`border-l-3 border-emerald-500`), nao background colorido.

### Charts (Recharts)

```tsx
<ResponsiveContainer width="100%" height={300}>
  <CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
  <YAxis hide />
</ResponsiveContainer>
```

- Tooltip padrao:
  ```tsx
  className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700
             rounded-lg shadow-lg p-3 text-sm text-foreground"
  ```
- Limites de series:
  - Line/Area: max 2
  - Stacked bar: max 3
  - Heatmap: sem limite
- Legendas: abaixo do grafico, `text-xs text-muted-foreground`

### Tabelas

- Header fixo: `sticky top-0`
- Linhas alternadas: `even:bg-gray-50/50 dark:even:bg-zinc-800/30`
- Sem bordas verticais, apenas `border-b`
- Paginacao ou virtualizacao obrigatoria >20 linhas

### Filtros

- Linha unica no topo, abaixo do titulo
- Maximo 4 visiveis. Mais → "Mais filtros" com popover
- Defaults inteligentes pre-selecionados
- Botao "Limpar" so aparece com filtros ativos

---

## Anatomia de Pagina

```
Titulo + Filtros (max 4 visiveis)
─────────────────
Hero Metrics (1-3 numeros grandes, SEM card wrapper)
─────────────────
Supporting Cards (grid 3-4 cols)
─────────────────
Chart Principal (max 2 em grid-cols-2)
─────────────────
Tabela de Detalhamento (sempre por ultimo)
```

**Regras:**
- Fluxo top-down: Resumo → Contexto → Detalhe
- Hero metrics SEM container/card
- Sem tabs para esconder conteudo (exceto: alternar perspectiva dos mesmos dados)
- Espacamento: `gap-6` entre secoes, `gap-4` dentro de grids
- Border radius: `rounded-lg` uniforme

---

## Estados

### Loading
- Heroes: `<Skeleton className="h-8 w-32" />`
- Cards: `<Skeleton className="h-24 rounded-lg" />`
- Charts: `<Skeleton className="h-[300px] rounded-lg" />`
- Tabelas: 5 linhas de `<Skeleton className="h-4" />` com larguras variadas

### Error
- Mensagem inline na secao afetada, nunca quebrar a pagina inteira:
  ```tsx
  <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm">
    <AlertTriangle className="w-4 h-4 shrink-0" />
    <span>Erro ao carregar dados. Tente novamente.</span>
  </div>
  ```

### Empty
- Charts/tabelas: `<p className="text-sm text-muted-foreground text-center py-12">Sem dados para o periodo selecionado.</p>`
- Heroes/cards: mostrar "—" no valor, sem trend.

---

## Acessibilidade (minimo)

- Contraste >= 4.5:1 (WCAG AA)
- Trends: simbolo (▲/▼) + cor, nunca so cor
- Filtros/botoes: `aria-label` quando texto insuficiente
- Tabelas: `<th scope="col">`
- Charts: `aria-label` descritivo no container

---

## Regras por Dominio

### Financeiro
- **Heroes:** Receita Liquida, Resultado do Periodo, Saldo em Caixa
- Valores completos nos heroes (`R$ 142.350,00`), abreviados em supporting
- DRE/DFC = tabelas hierarquicas colapsiveis, NAO cards
- Orcado vs realizado = barra horizontal dupla
- PROIBIDO: pizza chart (receita → barra empilhada, despesas → tabela colapsivel)

### Growth
- **Heroes:** ROAS, CAC, Investimento Total
- Funil = barra horizontal decrescente com taxas entre etapas
- Plataformas em tabela comparativa, nao cards separados
- Budget = barra de progresso simples
- Periodo padrao: ultimos 30 dias
- PROIBIDO: impressoes/cliques como hero metrics

### Operacoes (MRR, Churn, Retencao, Squads)
- **Heroes:** MRR Total, Churn Rate (%), NRR (%)
- Evolucao MRR = area chart com tendencia
- Churn: separar MRR churned de logos churned
- Cohort = heatmap
- Squads = ranking tabela com sparkline
- PROIBIDO: listar contratos churned na tela principal

### Tech
- **Heroes:** Projetos Ativos, % On-Time, Capacity Utilizada
- Card de projeto: titulo + badge + deadline + progress bar
- 3 estados: verde/ambar/vermelho
- Capacity = barra empilhada por squad
- PROIBIDO: drawer/modal complexo para detalhes

### RH/Pessoas
- **Heroes:** Headcount, Turnover (%), Vagas Abertas
- Recrutamento = funil simples
- Colaboradores = tabela com filtros
- PROIBIDO: cards com foto de cada colaborador

---

## Checklist Pre-Deploy

Antes de considerar QUALQUER dashboard pronto:

### Hierarquia
- [ ] Max 3 hero metrics?
- [ ] Supporting cards <= 6?
- [ ] Fluxo top-down?

### Visual
- [ ] Zero gradientes em cards?
- [ ] Zero backdrop-blur?
- [ ] Zero hover:scale em nao-interativos?
- [ ] Cores so semanticas?
- [ ] Max 3 cores por grafico?

### Dados
- [ ] Cada KPI justifica presenca?
- [ ] Sem metricas redundantes?
- [ ] Filtros com defaults inteligentes?
- [ ] Tabelas paginadas >20 linhas?

### Estados
- [ ] Loading state com Skeleton?
- [ ] Error state isolado por secao?
- [ ] Empty state para periodo sem dados?

### Consistencia
- [ ] Valores monetarios formatados?
- [ ] Labels uppercase + tracking-wide?
- [ ] gap-6 secoes / gap-4 grids?
- [ ] Dark + light mode ok?
- [ ] Responsivo sm/md/lg?

### Acessibilidade
- [ ] Contraste >= 4.5:1?
- [ ] Trends com simbolo + cor?
- [ ] aria-labels em charts e filtros?

### Dominio
- [ ] Segue regras do dominio?
- [ ] Heroes corretos?
- [ ] Zero anti-patterns do dominio?

---

## Anti-Patterns Globais

| NUNCA | SEMPRE |
|-------|--------|
| Gradientes em cards | Background solido |
| `backdrop-blur` | Background opaco |
| `hover:scale` informativo | Hover so em clicaveis |
| Icone decorativo | Icone so para acao/status |
| >8 KPIs sem scroll | Priorizar + drill-down |
| Count-up animation | Valor final direto |
| Grafico de pizza | Barra horizontal |
| Tabs escondendo secoes | Paginas separadas |
| Multiplos DatePickers | 1 filtro global |
| Borda + shadow + gradient | Escolher UM |
| Emojis em labels | Texto limpo |
