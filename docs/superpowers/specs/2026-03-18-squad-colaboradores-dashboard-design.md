# Design: Squad Colaboradores — Dashboard + Tabela Enriquecida

**Data:** 2026-03-18
**Escopo:** Aba "Colaboradores" dentro de `SquadDetalhe.tsx`
**Backend:** Zero mudancas — tudo frontend com dados ja existentes na response

---

## Contexto

A aba "Colaboradores" da analise de squads exibe apenas uma tabela plana com 9 colunas numericas. Faltam elementos visuais para leitura rapida e metricas de contexto como tendencia temporal, concentracao de receita e alertas de saude.

## Arquitetura

### Arquivo modificado
- `client/src/components/squads/SquadDetalhe.tsx` (1.122 linhas)

### Dados disponiveis (ja existem na `DetalheResponse`)
- `operadores[]` — MRR, contratos, clientes, churns, churnRate, mrrChurn, ticketMedio
- `operadoresAnterior[]` — MRR, contratos, clientes, churns, mrrChurn do mes anterior (sem churnRate)
- `evolucaoOperadores[]` — serie mensal `{ mes, operador, mrr }` (ultimos 12 meses)
- `totais` — agregados do squad (mrr, contratos, clientes, churns, churnRate, etc)
- `totaisAnterior` — agregados do mes anterior

### Imports Recharts a adicionar
- `LineChart` (nao importado atualmente — necessario para sparklines)
- `Line` ja esta importado na linha 20

### Constantes a definir (topo do arquivo)
```typescript
const CHURN_RATE_ALERT_THRESHOLD = 5;   // % acima do qual gera alerta vermelho
const MRR_DELTA_ALERT_THRESHOLD = 10;   // % queda MRR que gera alerta amarelo
const CONCENTRATION_ALERT_THRESHOLD = 40; // % MRR top 1 que gera alerta
```

### Componentes novos (inline no mesmo arquivo)
- `MiniSparkline` — Recharts LineChart 60x24px sem eixos
- `MrrProgressBar` — barra horizontal de % com label

---

## Design Detalhado

### 1. Painel Superior (3 Cards)

Layout: `grid grid-cols-1 lg:grid-cols-3 gap-4`, posicionado acima da tabela.

**Estados:**
- **Loading:** Nao renderizar o painel (segue o mesmo pattern do useQuery existente — a tabela inteira so renderiza apos data)
- **Vazio** (`operadores.length === 0`): Nao renderizar o painel

#### Card 1: Ranking MRR
- **Tipo:** BarChart horizontal (Recharts, `layout="vertical"`)
- **Dados:** `operadores` ordenados por MRR desc
- **Visual:** Todas as barras com a **mesma cor do squad** (monocromatico via `getSquadColor`) — ranking e diferenciado pela posicao/tamanho da barra, nao pela cor
- **Label:** nome a esquerda, valor formatado a direita
- **Altura:** ~200px (ou proporcional ao numero de operadores, min 150px)

#### Card 2: Concentracao de Receita
- **Calculo frontend:** para cada operador, `op.mrr / totais.mrr * 100`
- **Visual:** 3 barras horizontais mostrando os top 3 colaboradores com seus % de participacao
- **Alerta:** se top 1 colaborador > `CONCENTRATION_ALERT_THRESHOLD`% do MRR, badge amarelo "Alta concentracao"
- **"Outros":** calculado como `100 - sum(top3 percentages)`. Mostrado como linha `bg-gray-300 dark:bg-zinc-600` abaixo dos top 3. Se `operadores.length <= 3`, a linha "Outros" e **omitida** (0% restante)
- **Edge case:** se `totais.mrr === 0`, mostrar "Sem dados de MRR"

#### Card 3: Alertas de Saude
- **Regras (ambas per-operador):**
  - `operadores[].churnRate > CHURN_RATE_ALERT_THRESHOLD` → badge vermelho "Churn alto: {rate}%"
    - Usa o campo `churnRate` do mes **atual** (ja existe em `Operador`). Nao compara com mes anterior.
  - Delta MRR negativo > `MRR_DELTA_ALERT_THRESHOLD`%: calcula `((op.mrr - prev.mrr) / prev.mrr) * 100` usando o MRR **total** do operador (nao churn-specific). `prev` vem de `operadoresAnterior.find(p => p.nome === op.nome)`. Se `operadoresAnterior` for `undefined`, pular este check.
- **Fallback:** se nenhum alerta, mostra "Todos os indicadores saudaveis" com icone CheckCircle verde
- **Ordenacao global:** todos os alertas vermelhos (churn) primeiro, depois todos os amarelos (queda MRR). Cada item mostra o nome do operador.
- **Badges:** usar `<Badge>` do shadcn com `className` custom: vermelho = `bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400`, amarelo = `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`

### 2. Tabela Enriquecida

#### Colunas (ordem final)
1. **Nome** — texto, alinhado esquerda (existente)
2. **MRR** — moeda, alinhado direita (existente)
3. **Tendencia** — sparkline inline (NOVA)
4. **Delta MRR** — moeda colorida + % (existente)
5. **% MRR Squad** — barra de progresso + label (NOVA)
6. **Contratos** — numero (existente)
7. **Clientes** — numero (existente)
8. **Churns** — numero (existente)
9. **Churn Rate** — % colorido (existente)
10. **MRR Churn** — moeda (existente)
11. **Ticket Medio** — moeda (existente)

#### Coluna "Tendencia" (sparkline)
- Componente `MiniSparkline` recebe array de MRR mensais do operador
- **Join de dados:** `evolucaoOperadores.filter(e => e.operador === op.nome).map(e => e.mrr)`, ordenado por `mes` asc
- Se o array resultante tiver menos de 2 pontos, **nao renderizar** sparkline (celula vazia)
- Dimensoes: 60x24px
- Cor: emerald se ultimo valor > primeiro, rose se menor
- Recharts `LineChart` com `dot={false}`, sem XAxis/YAxis/Grid/Tooltip
- Escala automatica: Recharts faz auto-scale (min/max) por padrao, garantindo que a sparkline preencha visualmente o espaco disponivel

#### Coluna "% MRR Squad"
- Componente `MrrProgressBar` recebe `value` (0-100)
- Visual: div com background colorido proporcional ao %, label "{value}%" a direita
- **Cor:** derivada da variavel `squadColor` no escopo do componente pai (via `getSquadColor(squad)`), opacity 0.7
- Largura da barra: 80px max

#### Linha footer (Total)
- **Tendencia:** celula vazia (nao faz sentido sparkline agregada)
- **% MRR Squad:** mostrar "100%" como texto simples, sem barra
- Demais colunas: manter comportamento existente

#### Melhorias visuais nas linhas
- Hover: `hover:bg-gray-50 dark:hover:bg-zinc-800/50`
- **Separador visual Top 3:** aplicar `border-b-2 border-gray-300 dark:border-zinc-600` na 3a TableRow, **somente se `operadores.length >= 4`**. Se houver 3 ou menos operadores, nao aplicar separador.
- Linhas ordenadas por MRR desc (ja e o comportamento atual)

### 3. Grafico de Evolucao (ajuste menor)

- Manter AreaChart empilhado existente
- Trocar Top 6 por **Top 5** operadores para melhor legibilidade
- Atualizar o texto do CardTitle de "(Top 6)" para "(Top 5)" na linha ~704
- Atualizar o `.slice(0, 6)` para `.slice(0, 5)` na linha ~241

---

## Componentes

### MiniSparkline
```typescript
interface MiniSparklineProps {
  data: number[];  // array de MRR mensais (min 2 pontos)
  width?: number;  // default 60
  height?: number; // default 24
}
```
- Usa `LineChart` do Recharts (import a adicionar)
- Cor condicional: `#10b981` (emerald) se `data[last] >= data[0]`, `#f43f5e` (rose) se menor
- Sem interacao (tooltip/click)
- `<Line>` com `dot={false}`, `strokeWidth={1.5}`

### MrrProgressBar
```typescript
interface MrrProgressBarProps {
  value: number;   // 0-100 (percentual)
  color: string;   // cor da barra (passada explicitamente pelo pai)
}
```
- Container: `div` com `width: 80px`, `height: 8px`, `bg-gray-200 dark:bg-zinc-700`, `rounded-full`
- Barra interna: `div` com `width: {value}%`, `background: {color}`, `opacity: 0.7`, `rounded-full`
- Label: `<span>` ao lado com `{value.toFixed(1)}%`

---

## Temas (Dark/Light)

Todos os componentes seguem o padrao existente:
- Cards: `bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50`
- Textos: `text-gray-900 dark:text-white` (primario), `text-gray-600 dark:text-zinc-400` (secundario)
- Barras de progresso: `bg-gray-200 dark:bg-zinc-700` (track), cor do squad com opacity (fill)
- Sparklines: cores emerald/rose com hex fixo (funcionam em ambos os temas)

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Sparklines pesadas com muitos operadores | `evolucaoOperadores` ja vem limitado; sparkline e leve (sem tooltip) |
| Tabela muito larga com 11 colunas | overflow-x-auto ja existe; sparkline (60px) e barra (80px) sao compactas |
| `evolucaoOperadores` pode nao ter dados para operador especifico | Fallback: nao renderizar sparkline se array < 2 pontos |
| Nomes diferentes entre `operadores[].nome` e `evolucaoOperadores[].operador` | Join por igualdade exata; se nao encontrar, sparkline fica vazia (silencioso) |
| Squad com 1-2 operadores | Separador Top 3 nao renderiza; cards adaptam-se (ranking com 1-2 barras, concentracao sem "Outros") |
| `operadoresAnterior` undefined | Card 3 pula o check de delta MRR; alerta de churn ainda funciona |

---

## Fora de Escopo
- Sistema de metas (nao existe ainda)
- Drill-down ao clicar no colaborador
- Mudancas no backend
- Mudancas em outras abas (Visao Geral, Contratos, Churns)
