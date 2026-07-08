# Reporte Trimestral — Design

**Data:** 2026-07-08
**Autor:** Ichino + Claude
**Status:** Aprovado (aguardando review do spec)

## Objetivo

Criar uma variante **trimestral** do Reporte Mensal, vivendo ao lado dele em
`/reports/trimestral`. É um deck de slides (mesma casca do mensal — modo
apresentação fullscreen + export PDF) que conta a história de um **trimestre
fechado ou em andamento**, com foco em board/investidor: menos ruído
operacional, números agregados no trimestre e leitura de tendência
trimestre-a-trimestre.

O deck reaproveita os componentes de slide já existentes do Reporte Mensal
(alimentados com números agregados no trimestre) e adiciona poucos slides
novos de tendência. Não toca no endpoint mensal, que está em produção.

## Decisões validadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Natureza | **Híbrido** — reaproveita o deck mensal agregado no trimestre + slides novos de tendência |
| Escopo de seções | **Subconjunto estratégico** — corta ruído operacional/RH (aniversariantes, promoções, top reuniões SDR, Top Operadores) |
| Trimestre corrente | **Mostra parcial com aviso** (`*` + "trimestre em andamento") — permite selecionar o tri em andamento; agrega só meses fechados/decorridos. Mesmo padrão do CEO Dashboard |
| Comparação | **QoQ — vs trimestre anterior** (número + variação ▲/▼). YoY inviável hoje (histórico de snapshots só desde ~nov/2025) |
| Gráficos de evolução | Séries deixam de ser **mês-a-mês** e passam a ser **por trimestre** (eixo X = Q1, Q2, Q3…) |
| Como construir | **Endpoint dedicado** `server/routes/reportsTrimestral.ts` espelhando o mensal (não parametriza o mensal, não chama o mensal 3×) |
| NPS | Foto do **último mês** do trimestre + série por trimestre |
| Ranking Closers | Mantém (agregado no trimestre) |
| Top Operadores | Corta (operacional) |
| Highlights do trimestre | Fica para **v2** (depende de persistência/CRUD de slides custom) |

## Escopo

**Inclui (v1):**
- Tela `/reports/trimestral` (deck de slides, reusa a casca do `RelatorioMensal`)
- Endpoint consolidado `GET /api/reports/trimestral?trimestre=YYYY-Qn`
- Seletor de trimestre (últimos ~6–8 trimestres) com marcação de trimestre parcial
- Agregação por tipo de métrica (fluxo soma; estoque = foto de fim de tri; ratio recalculado)
- Slides novos: **Visão do Trimestre** (resumo QoQ) e **Evolução por Trimestre** (séries com eixo X = trimestres)
- Reuso dos slides existentes: MRR/Churn (`SlideTurboMetrics`), Squads (`SlideRankingSquads` + `SlideSquadSingle`), Pontual (`SlidePontual`), Tech (`SlideAreaTech`), NPS (`SlideNPS`), Financeiro YTD (`SlideFaturamentoYtd`), Ranking Closers (`SlideRankingClosers`)
- Registro em `nav-config.ts`, `App.tsx`, `routes.ts`
- Permissão reusa `reports.mensal`
- Dark/light mode (herda dos componentes reusados)

**Não inclui (fica para depois):**
- Highlights do trimestre editável (v2 — precisa do CRUD de slides custom por trimestre)
- Custom slides por trimestre (v2)
- Comparação YoY (quando houver histórico ≥ 1 ano)
- Seções cortadas: RH (novos, aniversariantes, aniversário de empresa, promoções), ranking SDR / top reuniões, Top Operadores, QR code, Turbo Store, Tópicos Finais

## Arquitetura

### Backend — endpoint dedicado

Novo arquivo `server/routes/reportsTrimestral.ts`, registrado em
`server/routes.ts` (import + `registerReportsTrimestralRoutes`, junto do
semanal por volta da linha 8556).

```
GET /api/reports/trimestral?trimestre=YYYY-Qn   (ex.: 2026-Q3; default = tri corrente)
```

- Valida `trimestre` com regex `^\d{4}-Q[1-4]$`.
- Deriva a janela (módulo isolado e testável):
  - `quarterStartMonth` = `(n-1)*3 + 1`
  - `quarterStart` = `YYYY-{quarterStartMonth}-01`
  - `quarterEnd` = 1º dia do mês seguinte ao fim do tri (**limite superior exclusivo**)
  - `mesesDoTri` = os 3 meses; se algum é futuro/corrente, marca `parcial`
  - `prevQuarter` = trimestre anterior (para QoQ), com sua própria janela
- Reaproveita a *lógica de query* das seções do subconjunto do
  `relatorioMensalSlides.ts`, extraindo helpers dos trechos compartilhados onde
  for limpo — mas a janela temporal e a regra de agregação ficam definidas num
  só lugar. **Não** modifica `relatorioMensalSlides.ts`.

**Por que endpoint dedicado (e não as alternativas):**
- *Parametrizar o mensal* (`granularidade=mes|trimestre`): o
  `relatorioMensalSlides.ts` tem 1.850+ linhas e está em produção; dois regimes
  de agregação no mesmo arquivo = risco real de regressão. Rejeitado.
- *Chamar o mensal 3×*: ~99 queries por request e, pior, rankings/séries do
  trimestre não são reconstituíveis a partir dos top-N mensais (top operador do
  tri ≠ concatenação dos tops; churn por cliente precisa deduplicar). Perde
  fidelidade. Rejeitado.

### Semântica de agregação (o coração)

Cada métrica agrega conforme seu tipo. Em trimestre parcial, agrega só sobre
os meses fechados/decorridos e a foto usa o snapshot mais recente disponível.

| Tipo | Regra | Métricas |
|------|-------|----------|
| **Fluxo** | **Soma** dos meses do tri | Vendas (MRR adicionado, pontual), nº contratos novos, churn R$ e count, entregas (pontual + tech), cross-sell/upsell, faturamento bruto/imposto/inadimplência |
| **Estoque / foto** | **Foto do fim do tri** (snapshot do 1º dia após o tri; se parcial, último mês fechado) | MRR ativo, clientes/contratos ativos, estoque pontual em aberto, pausados |
| **Ratio** | **Recalculado sobre os agregados** (nunca média de médias) | Ticket médio (MRR foto ÷ clientes foto), churn % (churn R$ tri ÷ base de início do tri), NRR, taxa de churn pontual |
| **Série por trimestre** | Cada ponto do eixo X é um trimestre inteiro, agregado pelas regras acima (fluxo soma o tri; estoque = foto de fim do tri) | Evolução MRR, vendas, churn — mostra os últimos ~4–6 trimestres |
| **QoQ** | Métricas-chave computadas também para `prevQuarter` → delta % | Slide Visão do Trimestre e badges |

> As colunas/filtros exatos de cada fonte serão confirmados na fase de
> INVESTIGAR (rodar queries reais), seguindo `agents/db-specialist.md` e as
> memórias de churn/MRR/pontual antes de escrever a query final. Ponto de
> atenção: as séries "12 meses" do mensal (`vendasSeries`,
> `receitaChurnSeries`) precisam ser **re-agregadas por trimestre**, não apenas
> fatiadas.

**Ambiguidade resolvida — NPS:** foto do **último mês** do trimestre (mês
fechado mais recente) + série por trimestre. Não é média dos 3 meses.

**Robustez:** as seções rodam em paralelo com tolerância a falha — uma seção
que falhar retorna `null`/vazio em vez de derrubar a resposta inteira
(try/catch por seção), igual ao mensal.

**Shape da resposta:** subconjunto do `RelatorioMensalData` (para os
componentes de slide existentes renderizarem sem adaptação) **+** um bloco novo:

```jsonc
{
  "trimestre": "2026-Q3",
  "label": "Q3 2026",
  "parcial": true,
  "mesesComputados": ["2026-07"],          // só meses fechados/decorridos
  "trend": {
    "series": [                             // eixo X = trimestres
      { "q": "2025-Q4", "label": "Q4'25", "mrr": 1200000, "vendas": 210000, "churn": 30000 },
      { "q": "2026-Q1", "label": "Q1'26", "mrr": 1310000, "vendas": 260000, "churn": 41000 },
      { "q": "2026-Q2", "label": "Q2'26", "mrr": 1400000, "vendas": 240000, "churn": 38000 }
    ],
    "qoq": {                                // tri atual vs anterior
      "mrr":    { "atual": 1420000, "anterior": 1400000, "betterDirection": "up" },
      "vendas": { "atual": 250000,  "anterior": 240000,  "betterDirection": "up" },
      "churn":  { "atual": 39000,   "anterior": 38000,   "betterDirection": "down" },
      "nrr":    { "atual": 1.04,    "anterior": 1.02,    "betterDirection": "up" }
    }
  },
  "turboMetrics": { /* ...mesmo shape do mensal, agregado no tri... */ },
  "squadDetails": [ /* ... */ ],
  "pontualData":  { /* ... */ },
  "techData":     { /* ... */ },
  "nps":          { /* foto do último mês + série por tri */ },
  "faturamentoYtd": { /* YTD até o fim do tri */ }
}
```

### Frontend — página

- `client/src/pages/RelatorioTrimestral.tsx` — container/deck, reusa a casca do
  `RelatorioMensal` (array de slots, navegação, modo apresentação, export PDF).
- `client/src/pages/relatorio-trimestral/useRelatorioTrimestral.ts` — hook React
  Query (`/api/reports/trimestral?trimestre=`), mesmo padrão de
  `useRelatorioMensal`.
- `client/src/pages/relatorio-trimestral/types.ts` — payload (subconjunto do
  `RelatorioMensalData` + bloco `trend`).
- **Componentes reaproveitados** (de `relatorio-mensal/`): `SlideCapa`,
  `SlideTurboMetrics`, `SlideRankingSquads`, `SlideSquadSingle`, `SlidePontual`,
  `SlideAreaTech`, `SlideNPS`, `SlideFaturamentoYtd`, `SlideRankingClosers`,
  `SlideFraseEncerramento`, primitivos `SlideLayout`/`SlideComponents`.
- **Componentes novos** (em `relatorio-trimestral/`):
  - `SlideVisaoTrimestre.tsx` — cards executivos com QoQ (MRR fim +Δ, Vendas +Δ,
    Churn R$/% +Δ, NRR, NPS). Cor da variação semântica pela `betterDirection`.
  - `SlideEvolucaoTrimestre.tsx` — gráficos de série com **eixo X = trimestres**
    (MRR, vendas, churn por trimestre; Recharts).

### Rota / menu / permissão

- `App.tsx`: import lazy (`RelatorioTrimestral`) + `<Route
  path="/reports/trimestral">` junto de `/reports/mensal` e `/reports/semanal`.
- `shared/nav-config.ts`: item `{ title: 'Reporte Trimestral', url:
  '/reports/trimestral', icon: 'CalendarRange', permissionKey:
  PERMISSION_KEYS.REPORTS.MENSAL }` no grupo Reports; adicionar o path ao mapa
  path→permissionKey.
- Permissão **reusa `reports.mensal`** (sem chave nova).

## Ordem dos slides do deck

`R` = reusa componente existente · `N` = novo:

1. **Capa** "Q3 2026" `R` (com marca de parcial se aplicável)
2. **Visão do Trimestre** `N` — resumo executivo com QoQ (slide de abertura)
3. **Vendas** `R` (agregado no tri) + **Evolução por Trimestre** `N`
4. **Ranking Closers** `R` (agregado no tri)
5. **Receita / MRR / Churn** `R` (`SlideTurboMetrics` tri) + série receita×churn por trimestre
6. **Ranking Squads** `R` + **Squad individual × N** `R` (`SlideSquadSingle`, tri)
7. **Pontual** `R` (`SlidePontual` tri)
8. **Tech** `R` (`SlideAreaTech` tri)
9. **NPS** `R` (foto do último mês + série por tri)
10. **Financeiro YTD** `R` (YTD até o fim do tri)
11. **Encerramento** `R`

## Seletor & trimestre parcial

- Dropdown com os últimos ~6–8 trimestres, label "Q3 2026", value `2026-Q3`,
  default = trimestre corrente. Ao trocar, reseta o slide atual para 0.
- Trimestre parcial (contém o mês corrente): seletor mostra `*`; um aviso no
  header/capa indica "Trimestre em andamento — parcial (meses computados: …)".
  Agregações usam só meses fechados/decorridos; a foto usa o snapshot mais
  recente ≤ hoje.

## Testes (mínimos)

- **Lógica de janela trimestral** (maior risco): `quarterStart`/`quarterEnd`,
  `prevQuarter`, detecção de trimestre parcial, virada de ano (Q1 vs Q4 do ano
  anterior), timezone São Paulo.
- **Shape do endpoint**: presença do bloco `trend` (series + qoq) e das seções
  do subconjunto; `parcial`/`mesesComputados` corretos.
- **Agregação por tipo**: um fluxo soma os meses; um estoque devolve a foto de
  fim de tri; um ratio é recalculado (spot-check contra o mensal para um tri
  fechado).

## Riscos e pontos de atenção

- **Séries por trimestre ≠ fatiar séries mensais:** as séries do mensal são
  mês-a-mês; para o eixo X trimestral é preciso re-agregar cada trimestre pelas
  regras de fluxo/estoque. Não somar MRR de meses (é estoque → foto de fim).
- **Foto de fim de tri via snapshot:** `cup_data_hist` tem snapshots diários,
  mas houve período com pipeline falho (jan/26). Se faltar o dia exato do fim
  do tri, usar o snapshot mais recente ≤ fim.
- **Trimestre parcial:** números crescem ao longo do tri; a marcação `*` e a
  comparação QoQ (tri anterior completo) precisam deixar claro que é parcial
  para não induzir leitura errada.
- **Histórico curto:** séries por trimestre terão poucos pontos em 2026
  (realisticamente Q1'26, Q2'26, Q3'26; Q4'25 parcial). QoQ funciona; YoY não.
- **Overrides manuais do mensal** (`VENDAS_EXPANSAO_POR_MES`,
  `CHURN_SQUAD_OVERRIDE` etc.) são por mês — decidir na implementação se/como
  se aplicam ao trimestre (provavelmente somar os meses cobertos).
