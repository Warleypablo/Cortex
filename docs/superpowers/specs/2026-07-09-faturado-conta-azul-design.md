# Slide "Faturado" (Conta Azul) — Reporte Trimestral

**Data:** 2026-07-09
**Autor:** Ichino + Claude
**Status:** Aprovado

## Objetivo

Substituir o slide **Faturável** do deck `/reports/trimestral` por um slide
**Faturado**, com leitura contábil vinda do Conta Azul:

```
faturável (bruto emitido) − inadimplência = faturado (recebido)
```

Acrescenta barras de faturado por trimestre do ano e uma barra de progresso do
atingimento da meta anual de **R$ 25.000.000**.

## Decisões validadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Slide antigo | **Some.** O `SlideFaturavelTrimestre` (MRR ativo + pontual entregue, fonte ClickUp) é removido e o novo ocupa o slot `faturamento` |
| Fonte | `"Conta Azul".caz_parcelas`, `UPPER(tipo_evento) = 'RECEITA'`. **Não** `caz_receber` — ela não traz a TURBO FILIAL |
| Faturado | **`valor_pago`** — caixa efetivamente recebido. É o que a meta de R$25MM já mede no TV Leaderboard |
| Faturável | `valor_bruto` — o emitido |
| Inadimplência | `valor_bruto − valor_pago` das parcelas com status `ATRASADO` ou `PERDIDO` |
| Empresas | **Todas.** TURBO PARTNERS + TURBO FILIAL + PEIXOTO DEBBANE. Sem filtro de `empresa` |
| Régua temporal | `data_vencimento` (competência da cobrança), consistente com o painel Metas de Receita |
| Meta | R$ 25M, ano de 2026. Constante compartilhada, hoje duplicada em `useTvLeaderboardData.ts` |
| Barras | Um bar por trimestre **decorrido do ano do trimestre selecionado** (Q1..Qn) |
| Split MRR/Pontual | **Perdido**, por decisão explícita. Não existe no Conta Azul nessa forma; o deck já tem slides dedicados de Pontual e de MRR/Churn |

### Por que `valor_pago` e não `valor_bruto − inadimplência`

Os dois não fecham. Entre o bruto e o pago há, além do atrasado/perdido, os
status `RENEGOCIADO` e `RECEBIDO_PARCIAL`. No H1/2026: R$ 76k renegociados e
R$ 6k de parciais. Fazer `bruto − inadimplência` contaria esses R$ 82k como
faturado, sem que o dinheiro tenha entrado. A conta exibida no slide é, então:

```
faturável − inadimplência − (renegociado + parcial em aberto) = faturado
```

O slide mostra os três termos principais (faturável, inadimplência, faturado); o
resíduo de renegociado/parcial não ganha card próprio para não poluir, mas é o
que explica a diferença se alguém somar de cabeça.

## Números reais (validados em 2026-07-09)

Query contra `caz_parcelas`, receita, por `data_vencimento`, todas as empresas:

| Trimestre | Faturável | Inadimplência | Faturado (pago) |
|-----------|-----------|---------------|-----------------|
| Q1 2026 | R$ 4.197.627 | R$ 140.413 | R$ 3.995.537 |
| Q2 2026 | R$ 4.745.361 | R$ 278.565 | R$ 4.446.563 |

YTD faturado = **R$ 8.442.100** → **33,8%** da meta de R$ 25M, com 52% do ano
decorrido. O deck deve deixar essa defasagem visível, não escondê-la.

Nota: o faturável do Conta Azul em Q2 (R$ 4,745M) **não** é o número do slide
antigo (R$ 4,79M) — aquele vinha do ClickUp. A proximidade é coincidência de
ordem de grandeza, não identidade.

## Arquitetura

### Backend — `server/routes/reportsTrimestral.ts`

Novo bloco `faturado` no payload de `GET /api/reports/trimestral`, com uma query
única agrupando por trimestre do ano:

```sql
SELECT
  EXTRACT(QUARTER FROM data_vencimento)::int AS quarter,
  SUM(valor_bruto)                                          AS faturavel,
  SUM(valor_pago)                                           AS faturado,
  SUM(CASE WHEN status IN ('ATRASADO','PERDIDO')
           THEN valor_bruto - valor_pago ELSE 0 END)        AS inadimplencia
FROM "Conta Azul".caz_parcelas
WHERE UPPER(tipo_evento) = 'RECEITA'
  AND data_vencimento >= <1º de janeiro do ano>
  AND data_vencimento <  <w.dataEnd>          -- exclusivo, corta o tri selecionado
GROUP BY 1
ORDER BY 1
```

`w.dataEnd` como limite superior garante que um deck de Q2 não enxergue Q3.

Formato de resposta:

```ts
interface FaturadoTri {
  quarter: number;        // 1..4
  label: string;          // "Q1"
  faturavel: number;
  inadimplencia: number;
  faturado: number;
  parcial: boolean;       // true no trimestre em andamento
}

interface Faturado {
  ano: number;
  trimestres: FaturadoTri[];   // Q1..Qn do ano, até o selecionado
  atual: FaturadoTri | null;   // o trimestre do deck
  ytdFaturado: number;
  meta: number | null;         // 25_000_000 se ano === 2026; senão null
  pctMeta: number | null;
  pctAnoDecorrido: number | null; // ritmo esperado: dia do ano ÷ 365
  coberturaParcial: boolean;   // true se o ano pedido tem meses antes de out/2025
}
```

A constante da meta sai para `shared/metas.ts` (`META_FATURAMENTO_2026`), e o
`useTvLeaderboardData.ts` passa a importar de lá em vez de declarar a sua — hoje
o número vive duplicado.

### Frontend — `SlideFaturadoTrimestre.tsx`

Substitui `SlideFaturavelTrimestre.tsx`, que é **deletado** (nenhum outro
consumidor: só o slot `faturamento` do deck trimestral).

Herda a casca do slide antigo — cards à esquerda, gráfico à direita:

- Card grande: **Faturado no trimestre**.
- Dois cards menores: **Faturável** (bruto) e **Inadimplência** (com a taxa
  `inadimplencia / faturavel` em %).
- Gráfico: `BarChart` empilhado do Recharts, uma barra por trimestre do ano —
  faturado embaixo (verde), inadimplência em cima (âmbar). Altura total = faturável.
- Rodapé: barra de progresso da meta, com `R$ X de R$ 25M · Y%` e um marcador
  vertical no % do ano decorrido, que expõe se estamos atrás do ritmo.

O campo `faturavel` do payload sai do endpoint e do `types.ts` junto com o slide
antigo — não sobrevive nenhum outro consumidor.

## Casos de borda

- **Cobertura de `caz_parcelas`:** a tabela só tem dados a partir de set/2025
  (out/2025 é o 1º mês cheio). Um deck de trimestre de 2025 mostra barras
  zeradas/truncadas. O slide exibe um aviso discreto quando
  `coberturaParcial` é true.
- **Meta fora de 2026:** a meta de R$25M é de 2026. Para outros anos, `meta` vem
  `null` e a barra de progresso não é renderizada (nem o marcador de ritmo).
- **Trimestre em andamento:** o faturado é parcial por definição — parte das
  parcelas nem venceu. A barra do trimestre `parcial` recebe hachura e o label
  ganha `*`, seguindo o padrão de `w.parcial` já existente no deck.
- **Divisão por zero:** taxa de inadimplência e `pctMeta` guardam contra
  denominador zero (trimestre sem faturamento retorna 0).

## Testes

`server/routes/reportsTrimestral.faturado.test.ts` cobre o mapeamento de linhas
do banco para o payload, que é onde mora a lógica: agrupamento por trimestre,
marcação de `parcial`, `meta: null` fora de 2026, `pctMeta` com denominador zero.
A query em si é validada manualmente contra os números da tabela acima.

Verificação final: `npx tsc --noEmit` e navegação pelo deck (números batendo com
a tabela de números reais, barra de meta em 33,8%, export PDF íntegro).
