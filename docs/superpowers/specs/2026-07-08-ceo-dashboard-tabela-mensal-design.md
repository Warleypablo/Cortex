# CEO Dashboard — Visão tabela mês a mês

**Data:** 2026-07-08
**Tela:** `/ceo-dashboard` (`client/src/pages/CeoDashboard.tsx`)

## Problema

O CEO Dashboard mostra hoje uma grade de cards, um por indicador, do mês
selecionado no dropdown. Cada card mostra o realizado, o % da meta e um
sparkline. Isso é bom para ler **um** mês, mas ruim para **comparar** meses:
o CEO precisa trocar o dropdown e memorizar os números.

Pedido (Ichino, WhatsApp): transformar a visão numa **tabela** — colunas =
meses, linhas = os indicadores ("os pontos") — "igual uma tabela mesmo, para
poder comparar um mês com o outro".

## Decisões (aprovadas)

1. **Layout:** a tela vira a tabela mês a mês. A grade de cards sai. Clicar
   numa célula/linha ainda abre o drill de detalhe existente.
2. **Célula:** realizado (destaque) + **% da meta** (secundário), colorido
   pela mesma régua dos cards (`atingimentoTom`).
3. **Colunas:** janeiro até o mês selecionado no dropdown. O dropdown passa a
   definir a **última coluna** (selecionar Junho → colunas Jan…Jun).

## Arquitetura

Tabela **transposta**: linhas = os 11 indicadores na ordem atual dos cards
(Receita, Custos & Despesas, Lucro, Saldo de Caixa, Inadimplência, NPS, CAC,
LTV, Headcount, E-NPS, Receita/Cabeça); colunas = meses.

Reaproveita **a mesma fonte de dados dos cards** para bater número a número:
`computarBpReceitas(db)` já devolve, numa única chamada, `linhas[]` e
`metricasGerais[]` com o array `meses[{ mes, orcado, realizado, atingimento }]`
por métrica. Ou seja, a série mensal completa (realizado + meta + % por mês)
dos KPIs do BP já existe — só falta transpô-la.

### Backend

Novo endpoint `GET /api/ceo-dashboard/matriz?ate=2026-07`, mesmo guard
(`canAccessCeo`). Resposta:

```ts
interface CeoMatrizResponse {
  ate: string;                    // "2026-07"
  meses: { mes: number; label: string }[];   // 1..mesNum, label "Jan".."Jul"
  linhas: CeoMatrizLinha[];
}
interface CeoMatrizLinha {
  key: string; label: string; unidade: CeoUnidade; direcao: CeoDirecao;
  semMeta: boolean;               // true p/ inadimplência, ltv, enps, nps
  nota?: string;                  // ex.: "foto atual, sem histórico mensal"
  celulas: CeoMatrizCelula[];     // uma por mês (alinhada a `meses`)
}
interface CeoMatrizCelula {
  mes: number;
  valor: number | null;
  meta: number | null;
  atingimentoPct: number | null;  // já *100, 1 casa (mesma régua do card)
}
```

A montagem é uma função pura testável `montarMatrizCeo(sources)` em
`server/routes/ceoDashboard.matriz.helpers.ts` (mesmo padrão do
`ceoDashboard.helpers.ts`, que já é lógica pura testada). O endpoint fica em
`server/routes/ceoDashboard.matriz.ts` (IO: BP, inadimplência, ltv, enps),
registrado em `server/routes.ts` junto das outras rotas ceo.

### Tratamento por tipo de indicador

- **7 KPIs do BP** (receita [regime de caixa], custos, lucro, caixa, cac,
  headcount, receita/cabeça): série mensal completa via `meses[]`. Célula =
  realizado + % da meta, colorido. Mês sem realizado → `null` (renderiza "—").
- **Inadimplência:** tem série mensal por **mês de vencimento**
  (`getInadimplenciaResumo().evolucaoMensal`, `mes: "YYYY-MM"`). Usada como
  série (filtrada a 2026), sem meta, cor neutra. `nota` esclarece que é por
  mês de vencimento.
- **LTV, E-NPS:** são foto atual (snapshot, sem histórico mensal). Valor
  aparece **só na última coluna** (mês selecionado); demais → `null`. `nota`
  = "foto atual, sem histórico mensal".
- **NPS:** "em breve", sem fonte → todas as células `null`; rótulo marca
  "em breve".

### Frontend

- `CeoMatrizTabela.tsx` (novo): coluna "Indicador" fixa (sticky) à esquerda,
  cabeçalho com os meses, célula com realizado + % da meta pintados por
  `atingimentoTom` (reuso de `ceoFormat.ts`). Scroll horizontal em telas
  estreitas; dark/light mode.
- Clique numa célula abre o drawer `CeoKpiDetail` existente daquele KPI **no
  mês da célula** (mantém o drill auditável). Clique no rótulo da linha usa o
  mês selecionado.
- `CeoDashboard.tsx`: troca a grade de cards pela `<CeoMatrizTabela>`; o
  dropdown de mês passa a ser o mês final; mantém loading/erro e o drawer.

## Testes

`ceoDashboard.matriz.helpers.test.ts` (vitest): transposição BP,
KPI com meta (realizado+%+cor), inadimplência por mês, LTV/E-NPS só na última
coluna, NPS todas nulas, mês futuro/sem dado → null, alinhamento células↔meses.

## Fora de escopo (YAGNI)

Coluna de variação MoM explícita, destaque de melhor/pior mês, exportação,
reordenar/agrupar linhas. A cor por atingimento já dá a leitura comparativa.
