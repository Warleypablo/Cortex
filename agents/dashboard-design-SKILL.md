# Dashboard Design Skill

> **Quando usar:** ANTES de criar ou editar qualquer dashboard no Cortex.
> **Escopo:** Todos os dashboards exceto Comercial (Closers, SDRs, Vendas).

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

## Paleta e Cor

Cor e **semantica**, nunca decorativa:

| Cor | Significado | Uso |
|-----|------------|-----|
| Verde (emerald) | Positivo / dentro da meta | Trends positivos, status ok |
| Vermelho (red) | Negativo / fora da meta | Trends negativos, alertas |
| Ambar (amber) | Atencao / limitrofe | Valores em zona de risco |
| Cinza (zinc/gray) | Neutro / sem julgamento | Dados informativos |

- Charts: 1 cor primaria + cinza para comparacao. Maximo 3 cores por grafico.

---

## Componentes

### StatsCard

```tsx
// CORRETO
<div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg p-5">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</p>
  <p className="text-lg font-medium text-foreground mt-1">R$ 142.350</p>
  {trend && <TrendBadge />}
</div>
```

**PROIBIDO no StatsCard:**
- `bg-gradient-to-*` (gradientes)
- `backdrop-blur-*`
- `hover:scale-*`
- Icone decorativo a esquerda
- `useCountUpNumber` (animacao de contagem)
- Overlay transparente

**Variantes semanticas:** via borda esquerda de 3px (`border-l-3 border-emerald-500`), nao background colorido.

### Charts (Recharts)

```tsx
<ResponsiveContainer width="100%" height={300}>
  {/* Grid lines apenas horizontais */}
  <CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
  {/* Sem eixo Y quando valores estao no tooltip */}
  <YAxis hide />
  {/* Maximo 2 series */}
</ResponsiveContainer>
```

- Tooltip com fundo solido, sem transparencia
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
Titulo + Filtros
─────────────────
Hero Metrics (1-3 numeros grandes, SEM card wrapper)
─────────────────
Supporting Cards (grid 3-4 cols)
─────────────────
Chart Principal (1 por viewport, max 2 em grid-cols-2)
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

## Regras por Dominio

### Financeiro
- **Heroes:** Receita Liquida, Resultado do Periodo, Saldo em Caixa
- Valores completos nos heroes (`R$ 142.350,00`), abreviados em supporting
- DRE/DFC = tabelas hierarquicas colapsiveis, NAO cards
- Orcado vs realizado = barra horizontal dupla
- PROIBIDO: grafico de pizza para composicao de receita

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

### Consistencia
- [ ] Valores monetarios formatados?
- [ ] Labels uppercase + tracking-wide?
- [ ] gap-6 secoes / gap-4 grids?
- [ ] Dark + light mode ok?
- [ ] Responsivo sm/md/lg?

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
