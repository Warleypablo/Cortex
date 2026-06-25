# Reconstrução da tela de Detalhamento de Churn

**Data:** 2026-06-25
**Rota:** `/dashboard/churn-detalhamento`
**Arquivo atual:** `client/src/pages/ChurnDetalhamento.tsx` (4.734 linhas)

## Objetivo

Reconstruir do zero a tela de detalhamento de churn como uma ferramenta de
**diagnóstico de causa-raiz**: responder *por que* perdemos clientes e priorizar
onde agir. Substituir a navegação por abas (fragmentada) por uma **página única
em scroll narrativo**, modular e mantível.

Público-alvo: Analista / RevOps investigando causas do churn.

## Decisões de produto

- **Foco:** diagnóstico de causa-raiz (não executivo, não operacional puro).
- **Ângulos (ordem de prioridade):** 1) Motivos & evitabilidade, 2) Voz do
  cliente (IA), 3) Segmentação/concentração, 4) Timing/jornada.
- **Estrutura:** scroll narrativo, leitura de cima pra baixo. Sem abas.
- **Drill-down:** contextual via **drawer** — clicar num motivo/tema/segmento
  abre painel lateral com os contratos daquele recorte.
- **Período padrão:** mês atual (com seletor para trocar) — mantém comportamento atual.
- **Relatório Semanal de Churn:** DESCARTADO. `RelatorioSemanalChurn` só existia
  embutido nessa aba (sem rota própria); o arquivo
  `client/src/pages/RelatorioSemanalChurn.tsx` será removido como órfão.
  (Não confundir com `/reports/semanal`, que é outro relatório e permanece.)

## Abordagem técnica

**Reconstrução modular reaproveitando os cálculos existentes.** Toda a lógica de
cálculo já validada (os `useMemo` de motivos, sentimento IA, evitabilidade,
segmentação, excesso de churn acumulado, NRR) é preservada e migrada — o que muda
é a **organização da apresentação** e a **quebra em componentes**. Não reescrever
cálculos do zero (lógica de evitabilidade/IA é sutil e está correta).

### Arquitetura de arquivos

```
client/src/pages/ChurnDetalhamento.tsx      orquestrador: fetch, período, filtros, estado do drawer
client/src/components/churn/
  ChurnControls.tsx        seletor de período + filtro de abono + painel de filtros colapsável
  ChurnKpisHero.tsx        KPIs do topo
  SecaoMotivos.tsx         motivo→submotivo, evitabilidade, tipo de erro
  SecaoVozCliente.tsx      sentimento, temas, mural de mensagens (IA)
  SecaoSegmentacao.tsx     squad, produto/serviço, faixa de ticket, responsável
  SecaoTiming.tsx          distribuição por lifetime, evolução mensal
  ChurnDrillDrawer.tsx     drawer reutilizável (lista contratos do recorte + ação de abonar)
```

Componentes locais reaproveitáveis (hoje dentro do arquivo): `ChurnGauge`,
`TechChartCard`, `SectionBlock`, `TechKpiCard`, `CustomTooltip`, `StatPill` →
extrair para módulo compartilhado (`components/churn/ui/` ou similar).

### Layout (scroll narrativo)

1. **Cabeçalho + controles** — período (default mês atual), filtro de abono
   (Todos / Não abonados / Abonados), painel de filtros colapsável (8 multi-selects
   atuais: squads, produtos, responsáveis, serviços, planos, clusters,
   evitabilidades, possibilidades_retencao).
2. **KPIs hero** — MRR perdido · Taxa de churn · Nº de logos perdidos · % evitável.
   Secundários: lifetime médio e ticket médio dos que saíram.
3. **Motivos & Evitabilidade** — motivo→submotivo, donut evitável/inevitável, tipo
   de erro (operação/CX/produto). Clique → drawer.
4. **Voz do Cliente (IA)** — distribuição de sentimento, temas recorrentes (ranking),
   mural de mensagens com filtros. Clique → drawer.
5. **Segmentação** — squad · produto/serviço · faixa de ticket (MRR) · responsável.
   Clique → drawer.
6. **Timing / Jornada** — distribuição por lifetime + evolução mensal do churn.
   Clique → drawer.

### Drawer de drill-down

Componente único `ChurnDrillDrawer`: recebe `{ titulo, contratos }` e lista os
contratos/clientes do recorte, com **ação de abonar inline** (migra o `Switch` de
abono que estava na aba Contratos; mutation `PATCH /api/churn/abonar/:taskId`).

### APIs (sem mudança de backend)

- `GET /api/analytics/churn-detalhamento?startDate&endDate` — dados principais
- `GET /api/analytics/nrr?startDate&endDate` — NRR
- `GET /api/okr2026/metric-series?metricKey=churn&start&end` — série p/ excesso acumulado
- `POST /api/analytics/churn-mensagens-ai` — análise IA das mensagens (Voz do Cliente)
- `PATCH /api/churn/abonar/:taskId` — ação de abonar (agora no drawer)

## Plano de fases (incremental, cada fase testável)

- **Fase 1 — Faxina:** remover abas `Contratos` e `Relatório Semanal` (mainTab) e
  sub-abas `Distribuição`/`Inteligência`. Tela fica só com o Resumo atual,
  funcionando. Remover import e arquivo `RelatorioSemanalChurn`.
- **Fase 2 — Esqueleto modular:** extrair UI compartilhada + criar orquestrador
  enxuto, `ChurnControls`, `ChurnKpisHero`.
- **Fase 3 — Motivos + Voz do Cliente + Drawer:** seções 3 e 4 + `ChurnDrillDrawer`.
- **Fase 4 — Segmentação + Timing:** seções 5 e 6.
- **Fase 5 — Polimento:** dark/light, responsivo, estados de loading/vazio,
  remoção de código morto remanescente.

## Riscos / atenção

- Arquivo de origem é grande; migrar `useMemo` sem alterar a semântica dos cálculos.
- Garantir dark/light mode em todos os componentes novos (regra do projeto).
- Confirmar que nenhum outro lugar importa `RelatorioSemanalChurn` antes de remover.
- O drawer precisa reaproveitar o estado `abonadoOverrides`/`pendingIds` (otimista)
  do fluxo de abono atual.

## Fora de escopo

- Mudanças no backend / queries SQL (reorganização é 100% frontend).
- Predição de churn, churn por produto, pontorrente, abonados (telas separadas).
